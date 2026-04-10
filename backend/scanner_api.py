"""
scanner_api.py
==============
MeteoSens Risk Tarayıcı — Sadece tarayıcı için gereken 2 endpoint.

Çalıştırma:
    pip install fastapi uvicorn requests
    python scanner_api.py
"""

import sys
import logging
from pathlib import Path

# risk_v1 modülünü path'e ekle
sys.path.insert(0, str(Path(__file__).parent / "risk_v1"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from risk_v1.slope_calculator import get_slope_and_aspect, get_high_slope_points

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MeteoSens Scanner API",
    description="Risk Tarayıcı için arazi analiz endpointleri",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://terrain-frontend-7vi0.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "MeteoSens Scanner API"}


@app.post("/api/terrain/slope-aspect")
async def terrain_slope_aspect(request: dict):
    """
    Tek nokta için eğim ve bakı hesapla.

    Request:  { "latitude": 38.129, "longitude": 42.808 }
    Response: { "slope": 28.5, "aspect_degrees": 225.0, "aspect_name": "Güneybatı", "center_elevation": 2341.0 }
    """
    lat = request.get("latitude")
    lon = request.get("longitude")

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="latitude ve longitude zorunlu")

    logger.info(f"📐 slope-aspect: ({lat}, {lon})")

    try:
        result = get_slope_and_aspect(lat, lon)
        logger.info(f"✅ slope={result['slope']}°, aspect={result['aspect_name']}")
        return result
    except Exception as e:
        logger.error(f"❌ slope-aspect hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/terrain/high-slope-points")
async def terrain_high_slope_points(request: dict):
    """
    Merkez nokta etrafındaki en yüksek eğimli noktaları bul.

    Request:
    {
        "latitude": 38.129,
        "longitude": 42.808,
        "radius_degrees": 0.02,   # opsiyonel, default 0.02
        "top_n": 20               # opsiyonel, default 20
    }

    Response:
    {
        "success": true,
        "center": { "lat": ..., "lon": ... },
        "high_slope_points": [
            { "lat": ..., "lon": ..., "slope": ..., "aspect_degrees": ..., "aspect_name": ... },
            ...
        ]
    }
    """
    lat = request.get("latitude")
    lon = request.get("longitude")
    radius = request.get("radius_degrees", 0.02)
    top_n = request.get("top_n", 20)

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="latitude ve longitude zorunlu")

    logger.info(f"🗺️ Yüksek eğim noktaları aranıyor: ({lat}, {lon}), r={radius}, n={top_n}")

    try:
        points = get_high_slope_points(
            center_lat=lat,
            center_lon=lon,
            radius_degrees=radius,
            top_n=top_n,
        )
        logger.info(f"✅ {len(points)} yüksek eğim noktası bulundu")
        return {
            "success": True,
            "center": {"lat": lat, "lon": lon},
            "radius_degrees": radius,
            "high_slope_points": points,
        }
    except Exception as e:
        logger.error(f"❌ high-slope-points hatası: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("🚀 MeteoSens Scanner API başlatılıyor...")
    print("📍 http://localhost:5001")
    print("📖 http://localhost:5001/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=5002, log_level="info")
