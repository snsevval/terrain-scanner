'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, RotateCcw, RotateCw, Flame, Loader2, AlertTriangle, ScanLine } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapLibreScannerProps {
  lat: number
  lon: number
  onRiskZonesDetected: (zones: any[]) => void
  onPointSelect?: (point: any) => void
}

const mono  = "'Share Tech Mono', 'Courier New', monospace"
const bebas = "'Bebas Neue', 'Impact', sans-serif"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
console.log("BACKEND URL =", BACKEND);

export default function MapLibreScanner({
  lat, lon, onRiskZonesDetected, onPointSelect,
}: MapLibreScannerProps) {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const autoRotateRef = useRef<number | null>(null)
  const scanRotateRef = useRef<number | null>(null)
  const keysRef       = useRef<Set<string>>(new Set())
  const keyFrameRef   = useRef<number | null>(null)

  const [isLoaded,        setIsLoaded]        = useState(false)
  const [isAutoRotating,  setIsAutoRotating]  = useState(true)
  const [isScanning,      setIsScanning]      = useState(false)
  const [scanProgress,    setScanProgress]    = useState(0)
  const [showHeatmap,     setShowHeatmap]     = useState(false)

  const [highSlopePoints,     setHighSlopePoints]     = useState<any[]>([])
  const [isLoadingSlopes,     setIsLoadingSlopes]     = useState(false)
  const [selectedPoint,       setSelectedPoint]       = useState<any>(null)
  const [showAnalysisOptions, setShowAnalysisOptions] = useState(false)
  const [showConfirmModal,    setShowConfirmModal]    = useState(false)
  const [activeCard,          setActiveCard]          = useState<any>(null)
  const [slopeWarning,        setSlopeWarning]        = useState(false)

  const HEAT_SOURCE_ID = 'earthquakes'
  const HEAT_LAYER_ID  = 'earthquakes-heat'
  const POINT_LAYER_ID = 'earthquakes-point'

  const ensureHeatmapLayers = (map: any) => {
    if (!map.getSource(HEAT_SOURCE_ID)) {
      map.addSource(HEAT_SOURCE_ID, { type: 'geojson', data: 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson' })
    }
    if (!map.getLayer(HEAT_LAYER_ID)) {
      map.addLayer({ id: HEAT_LAYER_ID, type: 'heatmap', source: HEAT_SOURCE_ID, maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'mag'], 0, 0, 6, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 9, 6],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(33,102,172,0)', 0.02, 'rgb(103,169,207)', 0.05, 'rgb(209,229,240)',
            0.08, 'rgb(253,219,199)', 0.28, 'rgb(239,138,98)', 1, 'rgb(178,24,43)'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0],
        },
      } as any)
    }
    if (!map.getLayer(POINT_LAYER_ID)) {
      map.addLayer({ id: POINT_LAYER_ID, type: 'circle', source: HEAT_SOURCE_ID, minzoom: 7,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            7, ['interpolate', ['linear'], ['get', 'mag'], 1, 1, 6, 4],
            16, ['interpolate', ['linear'], ['get', 'mag'], 1, 5, 6, 50]],
          'circle-color': ['interpolate', ['linear'], ['get', 'mag'],
            1, 'rgba(33,102,172,0)', 2, 'rgb(103,169,207)', 3, 'rgb(209,229,240)',
            4, 'rgb(253,219,199)', 5, 'rgb(239,138,98)', 6, 'rgb(178,24,43)'],
          'circle-stroke-color': 'white', 'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1],
        },
      } as any)
    }
  }

  const setHeatmapVisibility = (map: any, visible: boolean) => {
    const v = visible ? 'visible' : 'none'
    if (map.getLayer(HEAT_LAYER_ID))  map.setLayoutProperty(HEAT_LAYER_ID,  'visibility', v)
    if (map.getLayer(POINT_LAYER_ID)) map.setLayoutProperty(POINT_LAYER_ID, 'visibility', v)
  }

  // ── Harita init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || isLoaded) return
    const initMap = async () => {
      const maplibregl = await import('maplibre-gl')
      const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
      if (!key) { console.error('❌ NEXT_PUBLIC_MAPTILER_KEY eksik!'); return }
      const map = new maplibregl.Map({
        container: mapContainer.current!,
        style: `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`,
        center: [lon, lat],
        zoom: 12,
        pitch: 75,
        bearing: 0,
        maxPitch: 85,
        attributionControl: false,
      } as any)
      map.on('load', () => {
        map.addSource('terrainSource', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`, tileSize: 256 } as any)
        map.setTerrain({ source: 'terrainSource', exaggeration: 1.6 } as any)
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }), 'top-right')
        const el = document.createElement('div')
        el.style.cssText = `width:20px;height:20px;background:#00E5FF;border:3px solid white;border-radius:50%;box-shadow:0 0 20px rgba(0,229,255,0.8);`
        new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
        ensureHeatmapLayers(map)
        setHeatmapVisibility(map, false)
        mapRef.current = map;(window as any).__map = map
        setIsLoaded(true); fetchHighSlopePoints()
      })
    }
    initMap()
    return () => {
      if (autoRotateRef.current) cancelAnimationFrame(autoRotateRef.current)
      if (scanRotateRef.current) cancelAnimationFrame(scanRotateRef.current)
      if (keyFrameRef.current)   cancelAnimationFrame(keyFrameRef.current)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [lat, lon, isLoaded])

  // ── Otomatik döndürme ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !isAutoRotating || isScanning) {
      if (autoRotateRef.current) { cancelAnimationFrame(autoRotateRef.current); autoRotateRef.current = null }
      return
    }
    const start = performance.now()
    const rotate = (t: number) => {
      mapRef.current?.rotateTo(((t - start) / 100) % 360, { duration: 0 })
      autoRotateRef.current = requestAnimationFrame(rotate)
    }
    autoRotateRef.current = requestAnimationFrame(rotate)
    return () => { if (autoRotateRef.current) { cancelAnimationFrame(autoRotateRef.current); autoRotateRef.current = null } }
  }, [isAutoRotating, isLoaded, isScanning])

  // ── 360° Tarama ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !isScanning) {
      if (scanRotateRef.current) { cancelAnimationFrame(scanRotateRef.current); scanRotateRef.current = null }
      return
    }
    setIsAutoRotating(false)
    const startBearing = mapRef.current.getBearing?.() ?? 0
    let angle = startBearing
    const tick = () => {
      angle = (angle + 0.2) % 360
      mapRef.current?.rotateTo(angle, { duration: 0 })
      const progress = ((angle - startBearing + 360) % 360) / 360 * 100
      setScanProgress(progress)
      if (progress >= 99.5) { setIsScanning(false); setScanProgress(100); onRiskZonesDetected([]); return }
      scanRotateRef.current = requestAnimationFrame(tick)
    }
    scanRotateRef.current = requestAnimationFrame(tick)
    return () => { if (scanRotateRef.current) { cancelAnimationFrame(scanRotateRef.current); scanRotateRef.current = null } }
  }, [isScanning, isLoaded, onRiskZonesDetected])

  // ── Klavye kontrolü ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault()
        keysRef.current.add(e.key)
        setIsAutoRotating(false)
        setIsScanning(false)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    const loop = () => {
      const map = mapRef.current
      if (map && keysRef.current.size > 0) {
        if (keysRef.current.has('ArrowLeft'))  map.rotateTo(map.getBearing() - 0.5, { duration: 0 })
        if (keysRef.current.has('ArrowRight')) map.rotateTo(map.getBearing() + 0.5, { duration: 0 })
        if (keysRef.current.has('ArrowUp'))    map.setPitch(Math.min(map.getPitch() + 1, 85))
        if (keysRef.current.has('ArrowDown'))  map.setPitch(Math.max(map.getPitch() - 1, 0))
      }
      keyFrameRef.current = requestAnimationFrame(loop)
    }
    keyFrameRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
      if (keyFrameRef.current) cancelAnimationFrame(keyFrameRef.current)
    }
  }, [isLoaded])

  useEffect(() => { setSlopeWarning(false) }, [activeCard])

  const resetView = () => {
    setIsScanning(false); setScanProgress(0)
    mapRef.current?.rotateTo(0, { duration: 800 })
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 12, pitch: 75, bearing: 0, duration: 900 })
  }

  const startScan = () => { setIsAutoRotating(false); setScanProgress(0); setIsScanning(true) }

  // ── Eğim noktalarını çek ─────────────────────────────────────────────────
  const fetchHighSlopePoints = async () => {
    setIsLoadingSlopes(true)
    const cacheKey = `highSlopes:${lat.toFixed(5)}:${lon.toFixed(5)}:r0.02:n20`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const points = JSON.parse(cached)
        if (Array.isArray(points) && points.length > 0) { setHighSlopePoints(points); addHighSlopeLayers(points); setIsLoadingSlopes(false); return }
      } catch {}
    }
    try {
      const response = await fetch(`${BACKEND}/api/terrain/high-slope-points`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon, radius_degrees: 0.02, top_n: 20 }),
      })
      if (!response.ok) throw new Error(`API Hatası: ${response.status}`)
      const data = await response.json()
      if (data.success) { sessionStorage.setItem(cacheKey, JSON.stringify(data.high_slope_points)); setHighSlopePoints(data.high_slope_points); addHighSlopeLayers(data.high_slope_points) }
    } catch (error: any) { console.error('Yüksek eğim noktaları hatası:', error) }
    finally { setIsLoadingSlopes(false) }
  }

  // ── Harita katmanları ────────────────────────────────────────────────────
  const addHighSlopeLayers = async (points: any[]) => {
    if (!mapRef.current) return
    const map = mapRef.current; const maplibregl = await import('maplibre-gl')
    if (map.getSource('high-slopes')) {
      ;(map.getSource('high-slopes') as any).setData({ type: 'FeatureCollection', features: points.map((p, i) => ({ type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { slope: p.slope, aspect_name: p.aspect_name, aspect_degrees: p.aspect_degrees || 0, lat: p.lat, lon: p.lon, index: i + 1 } })) })
      return
    }
    map.addSource('high-slopes', { type: 'geojson', data: { type: 'FeatureCollection', features: points.map((p, i) => ({ type: 'Feature', id: i, geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { slope: p.slope, aspect_name: p.aspect_name, aspect_degrees: p.aspect_degrees || 0, lat: p.lat, lon: p.lon, index: i + 1 } })) } })
    map.addLayer({ id: 'high-slopes-circles', type: 'circle', source: 'high-slopes', paint: { 'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 14, 10], 'circle-color': '#FCD34D', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9, 'circle-stroke-opacity': 1 } })
    map.addLayer({ id: 'high-slopes-labels', type: 'symbol', source: 'high-slopes', layout: { 'text-field': ['get', 'index'], 'text-size': 10, 'text-offset': [0, 0], 'text-anchor': 'center' }, paint: { 'text-color': '#1f2937', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } })
    let hoveredStateId: number | null = null; let currentPopup: any = null
    map.on('mousemove', 'high-slopes-circles', (e: any) => {
      if (e.features?.length > 0) {
        if (hoveredStateId !== null) map.setFeatureState({ source: 'high-slopes', id: hoveredStateId }, { hover: false })
        hoveredStateId = e.features[0].id as number
        map.setFeatureState({ source: 'high-slopes', id: hoveredStateId }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'
        if (currentPopup) currentPopup.remove()
        const props = e.features[0].properties
        currentPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 15, maxWidth: '250px', className: 'risk-tooltip' })
          .setLngLat([props.lon, props.lat])
          .setHTML(`<div class="risk-tooltip-inner"><div class="row"><span>Eğim</span><b>${Number(props.slope).toFixed(1)}°</b></div><div class="row"><span>Yön</span><b>${props.aspect_name}</b></div></div>`)
          .addTo(map)
      }
    })
    map.on('mouseleave', 'high-slopes-circles', () => {
      if (hoveredStateId !== null) map.setFeatureState({ source: 'high-slopes', id: hoveredStateId }, { hover: false })
      hoveredStateId = null; map.getCanvas().style.cursor = ''
      if (currentPopup) { currentPopup.remove(); currentPopup = null }
    })
  }

  const getOptimalBearing = (aspectName: string, aspectDegrees?: number) => {
    if (aspectDegrees !== undefined && aspectDegrees !== null) return aspectDegrees
    const m: { [k: string]: number } = { 'Kuzey': 0, 'Kuzeybatı': 315, 'Kuzeydoğu': 45, 'Güney': 180, 'Güneybatı': 225, 'Güneydoğu': 135, 'Batı': 270, 'Doğu': 90 }
    return m[aspectName] || 0
  }

  const handleCardClick = (card: any) => {
    setActiveCard(card)
    const bearing = card.index === 0 ? 0 : getOptimalBearing(card.aspect_name, card.aspect_degrees)
    mapRef.current?.flyTo({ center: [card.lon, card.lat], zoom: 14, pitch: 55, bearing, duration: 1200, essential: true })
  }

  const handleConfirmActive = async () => {
    if (!activeCard) return
    if (activeCard.index !== 0) {
      const slope = Number(activeCard.slope)
      if (slope < 25 || slope > 40) { setSlopeWarning(true); setTimeout(() => setSlopeWarning(false), 3500); return }
    }
    if (activeCard.index === 0) {
      try {
        const res = await fetch(`${BACKEND}/api/terrain/slope-aspect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lon }) })
        const data = await res.json()
        setSelectedPoint({ lat, lon, slope: data.slope || 0, aspect_name: data.aspect_name || 'N/A', aspect_degrees: data.aspect_degrees || 0, index: 0 })
      } catch { setSelectedPoint({ lat, lon, slope: 0, aspect_name: 'Bilinmiyor', aspect_degrees: 0, index: 0 }) }
    } else {
      setSelectedPoint({ ...activeCard })
    }
    setShowConfirmModal(true)
  }

  const isActive = (card: any) => activeCard && activeCard.lat === card.lat && activeCard.lon === card.lon
  const activeSlope = activeCard ? Number(activeCard.slope) : 0
  const isValidSlope = !activeCard || activeCard.index === 0 || (activeSlope >= 25 && activeSlope <= 40)

  return (
    <div className="relative w-full min-h-screen">
      <div className="relative w-full h-screen">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* ── SAĞ BUTONLAR ── */}
        <div style={{ position: 'absolute', top: '8rem', right: '1.5rem', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Otomatik döndür */}
          <button onClick={() => { setIsScanning(false); setIsAutoRotating(v => !v) }} title="Otomatik Döndür"
            style={{ width: 48, height: 48, borderRadius: 10, backdropFilter: 'blur(12px)', background: isAutoRotating ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.6)', border: isAutoRotating ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(100,180,220,0.15)', color: isAutoRotating ? 'rgba(34,211,238,1)' : 'rgba(160,210,235,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s' }}>
            {isAutoRotating ? <Pause size={18} /> : <RotateCw size={18} />}
          </button>

          {/* 360° Tarama */}
          <button onClick={() => isScanning ? (setIsScanning(false), setScanProgress(0)) : startScan()} title="360° Tarama"
            style={{ width: 48, height: 48, borderRadius: 10, backdropFilter: 'blur(12px)', background: isScanning ? 'rgba(252,211,77,0.15)' : 'rgba(0,0,0,0.6)', border: isScanning ? '1px solid rgba(252,211,77,0.5)' : '1px solid rgba(100,180,220,0.15)', color: isScanning ? 'rgba(252,211,77,1)' : 'rgba(160,210,235,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }}>
            <ScanLine size={18} />
            {isScanning && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(252,211,77,0.15)" strokeWidth="2" />
                <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(252,211,77,0.7)" strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - scanProgress / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 24 24)"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
              </svg>
            )}
          </button>

          {/* Isı haritası */}
          <button onClick={() => { const map = mapRef.current; if (!map) return; const next = !showHeatmap; setShowHeatmap(next); if (next) ensureHeatmapLayers(map); setHeatmapVisibility(map, next) }} title="Isı Haritası"
            style={{ width: 48, height: 48, borderRadius: 10, backdropFilter: 'blur(12px)', background: showHeatmap ? 'rgba(251,146,60,0.15)' : 'rgba(0,0,0,0.6)', border: showHeatmap ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(100,180,220,0.15)', color: showHeatmap ? 'rgba(251,146,60,1)' : 'rgba(160,210,235,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s' }}>
            <Flame size={18} />
          </button>
        </div>

        {/* ── KLAVYE İPUCU ── */}
        {isLoaded && !isScanning && (
          <div style={{ position: 'absolute', bottom: '5rem', right: '1.5rem', zIndex: 10 }}>
            <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(100,180,220,0.1)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><kbd style={kbdStyle}>↑</kbd></div>
              <div style={{ display: 'flex', gap: '0.25rem' }}><kbd style={kbdStyle}>←</kbd><kbd style={kbdStyle}>↓</kbd><kbd style={kbdStyle}>→</kbd></div>
              <p style={{ fontFamily: mono, fontSize: '0.38rem', color: 'rgba(120,160,200,0.35)', letterSpacing: '0.08em', marginTop: '0.1rem' }}>←→ döndür · ↑↓ eğim</p>
            </div>
          </div>
        )}

        {/* ── TARAMA PROGRESS ── */}
        {isScanning && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 25, pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: 12, padding: '1rem 1.5rem', textAlign: 'center' }}>
              <p style={{ fontFamily: bebas, fontSize: '0.85rem', letterSpacing: '0.25em', color: 'rgba(252,211,77,0.9)', marginBottom: '0.5rem' }}>360° TARAMA</p>
              <div style={{ width: 120, height: 3, background: 'rgba(252,211,77,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${scanProgress}%`, background: 'rgba(252,211,77,0.8)', borderRadius: 2, transition: 'width 0.1s linear' }} />
              </div>
              <p style={{ fontFamily: mono, fontSize: '0.5rem', color: 'rgba(252,211,77,0.5)', letterSpacing: '0.1em', marginTop: '0.4rem' }}>{Math.round(scanProgress)}%</p>
            </div>
          </div>
        )}

        {/* ── ALT PANEL ── */}
        {highSlopePoints.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, paddingBottom: '1.25rem', display: 'flex', alignItems: 'flex-end' }}>
            {activeCard && (
              <div style={{ position: 'absolute', right: '1.5rem', bottom: '5rem', zIndex: 30, animation: 'fadeUp 0.3s ease-out', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <button onClick={handleConfirmActive} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1.75rem', background: isValidSlope ? (activeCard.index === 0 ? 'rgba(34,211,238,0.15)' : 'rgba(252,211,77,0.15)') : 'rgba(255,100,80,0.15)', backdropFilter: 'blur(12px)', border: `1px solid ${isValidSlope ? (activeCard.index === 0 ? 'rgba(34,211,238,0.6)' : 'rgba(252,211,77,0.6)') : 'rgba(255,100,80,0.6)'}`, borderRadius: 10, cursor: 'pointer', color: isValidSlope ? (activeCard.index === 0 ? 'rgba(34,211,238,1)' : 'rgba(252,211,77,1)') : 'rgba(255,120,100,1)', fontFamily: bebas, fontSize: '0.95rem', letterSpacing: '0.22em', textTransform: 'uppercase', transition: 'all 0.25s', boxShadow: isValidSlope ? (activeCard.index === 0 ? '0 0 24px rgba(34,211,238,0.25),0 4px 20px rgba(0,0,0,0.6)' : '0 0 24px rgba(252,211,77,0.25),0 4px 20px rgba(0,0,0,0.6)') : '0 0 24px rgba(255,100,80,0.25),0 4px 20px rgba(0,0,0,0.6)' }}>
                  {activeCard.index === 0 ? 'Merkezi Seç' : `Bölge #${activeCard.index} Seç`} →
                </button>
                {slopeWarning && (
                  <div style={{ padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,100,80,0.4)', borderRadius: 8, animation: 'fadeUp 0.3s ease-out', maxWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <AlertTriangle size={13} style={{ color: 'rgba(255,120,100,0.9)', marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontFamily: bebas, fontSize: '0.78rem', color: 'rgba(255,120,100,0.95)', letterSpacing: '0.2em', margin: '0 0 4px 0' }}>BU EĞİMDE ÇIĞ OLUŞMAZ</p>
                        <p style={{ fontFamily: mono, fontSize: '0.46rem', color: 'rgba(160,200,220,0.55)', letterSpacing: '0.1em', lineHeight: 1.7, margin: 0 }}>
                          Çığ riski yalnızca <span style={{ color: 'rgba(200,230,245,0.8)' }}>25° – 40°</span> aralığında değerlendirilebilir.<br />
                          Mevcut eğim: <span style={{ color: 'rgba(255,150,130,0.9)' }}>{activeSlope.toFixed(1)}°</span>
                        </p>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', height: 2, background: 'rgba(255,100,80,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'rgba(255,100,80,0.5)', borderRadius: 2, animation: 'drainBar 3.5s linear forwards' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ width: '78%', marginLeft: '1rem', padding: '0.5rem 0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                {(() => {
                  const card = { lat, lon, slope: 0, aspect_name: 'Merkez', aspect_degrees: 0, index: 0 }
                  const active = isActive(card)
                  return (
                    <div key="center" onClick={() => handleCardClick(card)} style={{ flexShrink: 0, width: 155, borderRadius: 8, padding: '0.75rem 0.85rem', background: active ? 'rgba(34,211,238,0.1)' : 'rgba(0,0,0,0.82)', border: active ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(34,211,238,0.12)', boxShadow: active ? '0 0 16px rgba(34,211,238,0.1)' : 'none', transform: active ? 'translateY(-3px)' : 'none', backdropFilter: 'blur(16px)', transition: 'all 0.25s', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(34,211,238,0.8),rgba(59,130,246,0.8))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bebas, fontSize: '0.7rem', color: 'white', fontWeight: 700 }}>M</div>
                        <span style={{ fontFamily: bebas, fontSize: '0.75rem', letterSpacing: '0.18em', color: 'rgba(34,211,238,0.85)', textTransform: 'uppercase' }}>Merkez</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}><span style={lbl}>Eğim</span><span style={{ fontFamily: bebas, fontSize: '0.8rem', color: 'rgba(34,211,238,0.7)' }}>—</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}><span style={lbl}>Yön</span><span style={val}>Merkez</span></div>
                      <div style={{ borderTop: '1px solid rgba(100,180,220,0.07)', paddingTop: '0.35rem' }}>
                        <span style={{ fontFamily: mono, fontSize: '0.46rem', color: 'rgba(120,160,200,0.35)' }}>{lat.toFixed(4)}°K, {lon.toFixed(4)}°D</span>
                      </div>
                    </div>
                  )
                })()}
                {highSlopePoints.map((point, index) => {
                  const card = { ...point, index: index + 1 }
                  const active = isActive(card)
                  return (
                    <div key={index} onClick={() => handleCardClick(card)} style={{ flexShrink: 0, width: 155, borderRadius: 8, padding: '0.75rem 0.85rem', background: active ? 'rgba(252,211,77,0.09)' : 'rgba(0,0,0,0.82)', border: active ? '1px solid rgba(252,211,77,0.4)' : '1px solid rgba(252,211,77,0.1)', boxShadow: active ? '0 0 16px rgba(252,211,77,0.08)' : 'none', transform: active ? 'translateY(-3px)' : 'none', backdropFilter: 'blur(16px)', transition: 'all 0.25s', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(252,211,77,0.9),rgba(251,146,60,0.9))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bebas, fontSize: '0.7rem', color: '#1f2937', fontWeight: 700 }}>{index + 1}</div>
                        <span style={{ fontFamily: bebas, fontSize: '0.75rem', letterSpacing: '0.18em', color: 'rgba(252,211,77,0.8)', textTransform: 'uppercase' }}>Bölge #{index + 1}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}><span style={lbl}>Eğim</span><span style={{ fontFamily: bebas, fontSize: '0.8rem', color: 'rgba(252,211,77,0.9)' }}>{point.slope.toFixed(1)}°</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}><span style={lbl}>Yön</span><span style={val}>{point.aspect_name}</span></div>
                      <div style={{ borderTop: '1px solid rgba(100,180,220,0.07)', paddingTop: '0.35rem' }}>
                        <span style={{ fontFamily: mono, fontSize: '0.46rem', color: 'rgba(120,160,200,0.35)' }}>{point.lat.toFixed(4)}°K, {point.lon.toFixed(4)}°D</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ONAY MODALI ── */}
        {showConfirmModal && selectedPoint && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
            <div style={{ background: 'rgba(0,0,0,0.97)', border: '1px solid rgba(100,180,220,0.13)', borderRadius: 12, padding: '1.75rem', width: 420, fontFamily: mono }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <p style={{ fontFamily: bebas, fontSize: '1.1rem', letterSpacing: '0.18em', color: 'rgba(220,235,255,0.9)', marginBottom: '0.35rem' }}>Analiz Noktasını Onayla</p>
                <p style={{ fontSize: '0.52rem', color: 'rgba(120,160,200,0.5)', letterSpacing: '0.1em' }}>Bu konum için risk hesaplamasına devam edilecek</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,180,220,0.08)', borderRadius: 8, padding: '0.9rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedPoint.index === 0 ? 'linear-gradient(135deg,rgba(34,211,238,0.8),rgba(59,130,246,0.8))' : 'linear-gradient(135deg,rgba(252,211,77,0.9),rgba(251,146,60,0.9))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bebas, fontSize: '0.7rem', color: selectedPoint.index === 0 ? 'white' : '#1f2937', fontWeight: 700 }}>{selectedPoint.index === 0 ? 'M' : selectedPoint.index}</div>
                  <span style={{ fontFamily: bebas, fontSize: '0.88rem', letterSpacing: '0.15em', color: selectedPoint.index === 0 ? 'rgba(34,211,238,0.85)' : 'rgba(252,211,77,0.85)', textTransform: 'uppercase' }}>{selectedPoint.index === 0 ? 'Merkez Nokta' : `Bölge #${selectedPoint.index}`}</span>
                </div>
                {[['Eğim', `${selectedPoint.slope.toFixed(1)}°`], ['Yön', selectedPoint.aspect_name], ['Konum', `${selectedPoint.lat.toFixed(4)}°K, ${selectedPoint.lon.toFixed(4)}°D`]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={lbl}>{k}</span><span style={val}>{v}</span>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.52rem', color: 'rgba(120,160,200,0.45)', letterSpacing: '0.1em', marginBottom: '1rem' }}>Bu nokta için çığ riski analizi yapılsın mı?</p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => { setShowConfirmModal(false); setSelectedPoint(null) }} style={{ flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,180,220,0.1)', borderRadius: 7, cursor: 'pointer', color: 'rgba(160,210,235,0.5)', fontFamily: bebas, fontSize: '0.82rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>İptal</button>
                <button onClick={() => { setShowConfirmModal(false); setShowAnalysisOptions(true); if (onPointSelect) onPointSelect(selectedPoint) }} style={{ flex: 1, padding: '0.6rem', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 7, cursor: 'pointer', color: 'rgba(34,211,238,0.9)', fontFamily: bebas, fontSize: '0.82rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Onayla ve Devam Et →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALİZ TİPİ MODALI ── */}
        {showAnalysisOptions && selectedPoint && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
            <div style={{ background: 'rgba(0,0,0,0.97)', border: '1px solid rgba(100,180,220,0.13)', borderRadius: 12, padding: '1.75rem', width: 420, fontFamily: mono }}>
              <p style={{ fontFamily: bebas, fontSize: '1rem', letterSpacing: '0.28em', color: 'rgba(160,210,235,0.7)', textAlign: 'center', marginBottom: '1.25rem', textTransform: 'uppercase' }}>— Analiz Türü Seç —</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {[
                  { title: 'Hava Durumu Analizi', desc: 'Meteorolojik veri ve koşullar', accent: 'rgba(59,130,246,0.25)', onClick: () => { const p = new URLSearchParams(window.location.search); p.set('slope', selectedPoint.slope.toString()); p.set('aspect', selectedPoint.aspect_name); p.set('selectedLat', selectedPoint.lat.toString()); p.set('selectedLon', selectedPoint.lon.toString()); router.push(`/result/weather?${p.toString()}`) } },
                  { title: 'Snowpack Analizi', desc: 'Kar stabilitesi ve risk değerlendirmesi', accent: 'rgba(34,211,238,0.25)', onClick: () => { const cp = new URLSearchParams(window.location.search); const p = new URLSearchParams(); p.set('lat', selectedPoint.lat.toString()); p.set('lon', selectedPoint.lon.toString()); p.set('slope', selectedPoint.slope.toString()); p.set('aspect', selectedPoint.aspect_name); p.set('from', cp.get('from') || ''); p.set('to', cp.get('to') || ''); p.set('station', selectedPoint.index === 0 ? 'external' : `zone_${selectedPoint.index}`); p.set('stationName', selectedPoint.index === 0 ? `Merkez (${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lon.toFixed(4)})` : `Bölge #${selectedPoint.index}`); p.set('elevation', '0'); router.push(`/result/snowpack?${p.toString()}`) } },
                ].map(({ title, desc, onClick, accent }) => (
                  <button key={title} onClick={onClick} style={{ width: '100%', padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,180,220,0.08)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: mono }}
                    onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.borderColor = 'rgba(100,180,220,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(100,180,220,0.08)' }}>
                    <p style={{ fontFamily: bebas, fontSize: '0.9rem', letterSpacing: '0.12em', color: 'rgba(220,235,255,0.9)', marginBottom: '0.18rem' }}>{title}</p>
                    <p style={{ fontSize: '0.52rem', color: 'rgba(120,160,200,0.5)', letterSpacing: '0.06em' }}>{desc}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAnalysisOptions(false)} style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,180,220,0.08)', borderRadius: 7, cursor: 'pointer', color: 'rgba(120,160,200,0.45)', fontFamily: bebas, fontSize: '0.82rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>← Haritaya Dön</button>
            </div>
          </div>
        )}

        {/* Görünümü Sıfırla */}
        {isLoaded && (
          <div style={{ position: 'absolute', left: '1.5rem', bottom: '1.5rem', zIndex: 10 }}>
            <button onClick={resetView} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '5px 12px', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(100,180,220,0.1)', borderRadius: 6, cursor: 'pointer', color: 'rgba(160,210,235,0.5)', fontFamily: bebas, fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              <RotateCcw size={11} /> Görünümü Sıfırla
            </button>
          </div>
        )}

        {isLoadingSlopes && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'rgba(0,0,0,0.96)', border: '1px solid rgba(100,180,220,0.1)', borderRadius: 10, padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
              <Loader2 className="text-cyan-400 animate-spin" size={26} />
              <p style={{ fontFamily: bebas, fontSize: '0.95rem', letterSpacing: '0.25em', color: 'rgba(200,225,245,0.8)', textTransform: 'uppercase' }}>Arazi Analiz Ediliyor</p>
              <p style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'rgba(120,160,200,0.45)', textAlign: 'center' }}>Optimal eğimler aranıyor...</p>
            </div>
          </div>
        )}

        {!isLoaded && (
          <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mx-auto mb-4" />
              <p style={{ fontFamily: bebas, fontSize: '0.95rem', letterSpacing: '0.25em', color: 'rgba(120,160,200,0.5)', textTransform: 'uppercase' }}>3D Arazi Yükleniyor...</p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes drainBar { from { width:100%; } to { width:0%; } }
      `}</style>
    </div>
  )
}

const lbl: React.CSSProperties = { fontFamily: "'Share Tech Mono','Courier New',monospace", fontSize: '0.5rem', letterSpacing: '0.12em', color: 'rgba(217,225,233,0.48)', textTransform: 'uppercase' }
const val: React.CSSProperties = { fontFamily: "'Share Tech Mono','Courier New',monospace", fontSize: '0.6rem', color: 'rgba(200,225,245,0.75)' }
const kbdStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, background: 'rgba(100,180,220,0.08)', border: '1px solid rgba(100,180,220,0.15)', fontFamily: "'Share Tech Mono',monospace", fontSize: '0.55rem', color: 'rgba(160,210,235,0.5)' }