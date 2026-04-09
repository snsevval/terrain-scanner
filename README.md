# MeteoSens Risk Tarayıcı — Standalone

MeteoSens projesinden bağımsız çalışan Risk Tarayıcı modülü.

```
meteosens-scanner/
├── frontend/      ← Next.js 14 + MapLibre GL
└── backend/       ← FastAPI (sadece 2 terrain endpoint)
```

---

## Kurulum

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python scanner_api.py
# → http://localhost:5001
```

### 2. Frontend

```bash
cd frontend
npm install

# .env.local oluştur
cp .env.local.example .env.local
# NEXT_PUBLIC_MAPTILER_KEY= kısmını doldur

npm run dev
# → http://localhost:3000
```

---

## Kullanım

1. `http://localhost:3000` → Koordinat gir → **Taramayı Başlat**
2. 3D haritada sarı noktalardan bir **Bölge** seç
3. **Seç** butonuna tıkla → Onayla → Analiz türü seç

Analiz sayfaları (`/result/weather`, `/result/snowpack`) MeteoSens ana projesine bağlanır veya buraya eklenebilir.

---

## Çevre Değişkenleri

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler API anahtarı (zorunlu) |
| `NEXT_PUBLIC_BACKEND_URL` | Backend adresi (default: `http://localhost:5001`) |

---

## Endpoints (Backend)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/health` | Sağlık kontrolü |
| POST | `/api/terrain/slope-aspect` | Tek nokta eğim/bakı |
| POST | `/api/terrain/high-slope-points` | Grid tarama (top-N) |
