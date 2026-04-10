"""
slope_calculator.py
Open-Elevation API kullanarak eğim (slope) ve bakı (aspect) hesaplar.
"""

import requests
import math

import logging

logger = logging.getLogger(__name__)

OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"

ASPECT_NAMES = [
    (22.5,  "Kuzey"),
    (67.5,  "Kuzeydoğu"),
    (112.5, "Doğu"),
    (157.5, "Güneydoğu"),
    (202.5, "Güney"),
    (247.5, "Güneybatı"),
    (292.5, "Batı"),
    (337.5, "Kuzeybatı"),
    (360.0, "Kuzey"),
]


def get_elevation_batch(locations: list[dict]) -> list[float]:
    """Open-Elevation API'den toplu yükseklik verisi al."""
    try:
        response = requests.post(
            OPEN_ELEVATION_URL,
            json={"locations": locations},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return [r["elevation"] for r in data["results"]]
    except Exception as e:
        logger.warning(f"Open-Elevation API hatası: {e}")
        return [0.0] * len(locations)


def calculate_slope_aspect(center_lat: float, center_lon: float, delta: float = 0.002):
    """
    Merkez nokta etrafında 3x3 grid ile eğim ve bakı hesapla.
    delta: yaklaşık 200m (0.002 derece ≈ 220m)
    """
    # 3x3 grid noktaları
    lats = [center_lat - delta, center_lat, center_lat + delta]
    lons = [center_lon - delta, center_lon, center_lon + delta]

    locations = [
        {"latitude": lat, "longitude": lon}
        for lat in lats
        for lon in lons
    ]

    elevations = get_elevation_batch(locations)

    # 3x3 matris oluştur
    z = []
    for i in range(3):
        row = []
        for j in range(3):
            row.append(float(elevations[i * 3 + j]))
        z.append(row)

    # Horn (1981) algoritması
    # dx = (z02 + 2*z12 + z22 - z00 - 2*z10 - z20) / (8 * cell_size)
    # dy = (z20 + 2*z21 + z22 - z00 - 2*z01 - z02) / (8 * cell_size)

    # cell_size metre cinsinden (yaklaşık)
    lat_m = delta * 111_000          # kuzey-güney metre
    lon_m = delta * 111_000 * math.cos(math.radians(center_lat))  # doğu-batı metre

    dz_dx = (
        (z[0][2] + 2 * z[1][2] + z[2][2])
        - (z[0][0] + 2 * z[1][0] + z[2][0])
    ) / (8 * lon_m)

    dz_dy = (
        (z[2][0] + 2 * z[2][1] + z[2][2])
        - (z[0][0] + 2 * z[0][1] + z[0][2])
    ) / (8 * lat_m)

    # Eğim (derece)
    slope_rad = math.atan(math.sqrt(dz_dx ** 2 + dz_dy ** 2))
    slope_deg = math.degrees(slope_rad)

    # Bakı (derece, kuzeyden saat yönünde)
    aspect_rad = math.atan2(-dz_dx, dz_dy)
    aspect_deg = math.degrees(aspect_rad)
    if aspect_deg < 0:
        aspect_deg += 360.0

    # Bakı adı
    aspect_name = "Düz"
    for threshold, name in ASPECT_NAMES:
        if aspect_deg < threshold:
            aspect_name = name
            break

    return {
        "slope": round(slope_deg, 2),
        "aspect_degrees": round(aspect_deg, 1),
        "aspect_name": aspect_name,
        "center_elevation": z[1][1],
    }


def get_slope_and_aspect(lat: float, lon: float) -> dict:
    """Ana wrapper — api.py'de kullanılan fonksiyon."""
    return calculate_slope_aspect(lat, lon)


def get_slope_from_open_elevation(lat: float, lon: float) -> float:
    """Sadece eğim değerini döndür."""
    result = calculate_slope_aspect(lat, lon)
    return result["slope"]


def get_high_slope_points(
    center_lat: float,
    center_lon: float,
    radius_degrees: float = 0.02,
    top_n: int = 20,
    grid_size: int = 10,
) -> list[dict]:
    """
    Verilen merkez etrafında grid tarayıp en yüksek eğimli noktaları döndür.
    Open-Elevation batch API kullanır (daha hızlı).
    """
    step = (radius_degrees * 2) / grid_size
    candidate_centers = []

    for i in range(grid_size):
        for j in range(grid_size):
            lat = center_lat - radius_degrees + (i * step)
            lon = center_lon - radius_degrees + (j * step)
            candidate_centers.append((round(lat, 5), round(lon, 5)))

    # Her merkez için 3x3 grid → toplu istek (9 * n nokta)
    # Performans için paralel değil sıralı ama batched
    delta = 0.002
    all_locations = []
    for clat, clon in candidate_centers:
        for dlat in [-delta, 0, delta]:
            for dlon in [-delta, 0, delta]:
                all_locations.append({
                    "latitude": round(clat + dlat, 6),
                    "longitude": round(clon + dlon, 6),
                })

    logger.info(f"Open-Elevation'a {len(all_locations)} nokta gönderiliyor...")

    # Batch'ler halinde çek (max 100/istek)
    batch_size = 100
    all_elevations = []
    for start in range(0, len(all_locations), batch_size):
        batch = all_locations[start: start + batch_size]
        elevs = get_elevation_batch(batch)
        all_elevations.extend(elevs)

    # Eğim hesapla
    results = []
    for idx, (clat, clon) in enumerate(candidate_centers):
        base = idx * 9
        elev_flat = all_elevations[base: base + 9]
        if len(elev_flat) < 9:
            continue

        z = [[float(elev_flat[i * 3 + j]) for j in range(3)] for i in range(3)]

        lat_m = delta * 111_000
        lon_m = delta * 111_000 * math.cos(math.radians(clat))

        dz_dx = (
            (z[0][2] + 2 * z[1][2] + z[2][2])
            - (z[0][0] + 2 * z[1][0] + z[2][0])
        ) / (8 * lon_m)
        dz_dy = (
            (z[2][0] + 2 * z[2][1] + z[2][2])
            - (z[0][0] + 2 * z[0][1] + z[0][2])
        ) / (8 * lat_m)

        slope_deg = math.degrees(math.atan(math.sqrt(dz_dx ** 2 + dz_dy ** 2)))

        aspect_rad = math.atan2(-dz_dx, dz_dy)
        aspect_deg = math.degrees(aspect_rad)
        if aspect_deg < 0:
            aspect_deg += 360.0

        aspect_name = "Düz"
        for threshold, name in ASPECT_NAMES:
            if aspect_deg < threshold:
                aspect_name = name
                break

        results.append({
            "lat": clat,
            "lon": clon,
            "slope": round(slope_deg, 2),
            "aspect_degrees": round(aspect_deg, 1),
            "aspect_name": aspect_name,
        })

    results.sort(key=lambda x: x["slope"], reverse=True)
    return results[:top_n]
