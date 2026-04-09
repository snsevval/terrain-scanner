'use client'

import { Suspense, useEffect, useMemo, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MapPin, AlertTriangle } from 'lucide-react'
import MapLibreScanner from '@/components/MapLibreScanner'

export default function RiskScannerPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(120,160,200,0.6)' }}>
            YÜKLENİYOR...
          </p>
        </div>
      }
    >
      <RiskScannerContent />
    </Suspense>
  )
}

function SnowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number
    let W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H
    const flakes = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.6 + 0.5,
      speed: Math.random() * 0.35 + 0.08,
      drift: Math.random() * 0.25 - 0.12,
      opacity: Math.random() * 0.25 + 0.08,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.012,
    }))
    function drawFlake(x: number, y: number, r: number, angle: number, opacity: number) {
      ctx!.save(); ctx!.translate(x, y); ctx!.rotate(angle)
      ctx!.globalAlpha = opacity; ctx!.strokeStyle = 'rgba(200,235,255,1)'
      ctx!.lineWidth = 0.5; ctx!.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const ax = Math.cos(a) * r * 4, ay = Math.sin(a) * r * 4
        ctx!.beginPath(); ctx!.moveTo(0, 0); ctx!.lineTo(ax, ay); ctx!.stroke()
        for (let b = 0.35; b <= 0.65; b += 0.3) {
          const bx = Math.cos(a) * r * 4 * b, by = Math.sin(a) * r * 4 * b
          const bl = r * 1.1
          const a1 = a + Math.PI / 3, a2 = a - Math.PI / 3
          ctx!.beginPath(); ctx!.moveTo(bx, by); ctx!.lineTo(bx + Math.cos(a1) * bl, by + Math.sin(a1) * bl); ctx!.stroke()
          ctx!.beginPath(); ctx!.moveTo(bx, by); ctx!.lineTo(bx + Math.cos(a2) * bl, by + Math.sin(a2) * bl); ctx!.stroke()
        }
      }
      ctx!.restore()
    }
    function tick() {
      ctx!.clearRect(0, 0, W, H)
      for (const f of flakes) {
        drawFlake(f.x, f.y, f.r, f.angle, f.opacity)
        f.y += f.speed; f.x += f.drift; f.angle += f.spin
        if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W }
        if (f.x > W + 10) f.x = -10
        if (f.x < -10) f.x = W + 10
      }
      animId = requestAnimationFrame(tick)
    }
    tick()
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.5 }} />
}

function RiskScannerContent() {
  const router = useRouter()
  const sp = useSearchParams()

  const latRaw = sp.get('lat')
  const lonRaw = sp.get('lon')
  const from = sp.get('from') || ''
  const to   = sp.get('to')   || ''

  const lat = useMemo(() => Number(latRaw), [latRaw])
  const lon = useMemo(() => Number(lonRaw), [lonRaw])
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon)

  const [picked, setPicked] = useState<any>(null)
  const [slopeWarning, setSlopeWarning] = useState(false)

  useEffect(() => {
    if (!hasValidCoords) router.replace('/')
  }, [hasValidCoords, router])

  useEffect(() => { setSlopeWarning(false) }, [picked])

  const mono  = "'Share Tech Mono', 'Courier New', monospace"
  const bebas = "'Bebas Neue', 'Impact', sans-serif"

  if (!hasValidCoords) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(120,160,200,0.6)' }}>
          KOORDİNAT EKSİK · YÖNLENDİRİLİYOR...
        </p>
      </div>
    )
  }

  const slopeValue = picked ? Number(picked.slope) : 0
  const isValidSlope = slopeValue >= 25 && slopeValue <= 40

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#000000', fontFamily: mono }}>
      <SnowCanvas />

      {/* ── HEADER ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem' }}>
          <div style={{
            background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(100,180,220,0.1)',
            borderRadius: '12px', padding: '0 1.25rem', height: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {/* Sol */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => router.push(`/?lat=${lat}&lon=${lon}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'none', border: '1px solid rgba(100,180,220,0.12)',
                  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                  color: 'rgba(160,210,235,0.6)',
                  fontFamily: bebas, fontSize: '0.82rem', letterSpacing: '0.28em',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(100,180,220,0.3)'; e.currentTarget.style.color = 'rgba(200,235,255,0.9)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(100,180,220,0.12)'; e.currentTarget.style.color = 'rgba(160,210,235,0.6)' }}
              >
                <ArrowLeft size={12} />
                GERİ
              </button>

              <div style={{ width: '1px', height: '14px', background: 'rgba(100,180,220,0.1)' }} />

              <svg width="28" height="20" viewBox="0 0 80 60" fill="none" style={{ opacity: 0.8, filter: 'drop-shadow(0 0 5px rgba(120,200,240,0.35))' }}>
                <polyline points="52,48 68,18 84,48" stroke="rgba(120,200,240,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
                <polyline points="4,48 28,8 44,32"   stroke="rgba(160,220,245,0.9)"  strokeWidth="1.8" strokeLinejoin="round" />
                <polyline points="44,32 58,14 76,48"  stroke="rgba(160,220,245,0.9)"  strokeWidth="1.8" strokeLinejoin="round" />
                <polyline points="24,14 28,8 32,14"   stroke="rgba(220,240,255,0.95)" strokeWidth="1.5" strokeLinejoin="round" />
                <polyline points="54,20 58,14 62,20"  stroke="rgba(220,240,255,0.95)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>

              <div>
                <p style={{ fontFamily: bebas, fontSize: '1rem', letterSpacing: '0.28em', color: 'rgba(200,225,245,0.9)', textTransform: 'uppercase' }}>
                  — Arazi Tarayıcı —
                </p>
                <p style={{ fontFamily: mono, fontSize: '0.5rem', color: 'rgba(120,160,200,0.45)', letterSpacing: '0.12em', marginTop: '1px' }}>
                  {lat.toFixed(4)}°K · {lon.toFixed(4)}°D · {from || '—'} → {to || '—'}
                </p>
              </div>
            </div>

            {/* Sağ */}
            {picked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <MapPin size={12} style={{ color: 'rgba(34,211,238,0.7)' }} />
                <span style={{ fontFamily: mono, fontSize: '0.5rem', color: 'rgba(120,160,200,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Seçilen:</span>
                <span style={{ fontFamily: bebas, fontSize: '0.85rem', letterSpacing: '0.1em', color: 'rgba(200,235,255,0.9)' }}>
                  {picked.index === 0 ? 'Merkez' : `Bölge #${picked.index}`}
                </span>
                <div style={{ width: '1px', height: '12px', background: 'rgba(100,180,220,0.12)' }} />
                <span style={{ fontFamily: mono, fontSize: '0.58rem', color: isValidSlope ? 'rgba(160,210,235,0.6)' : 'rgba(255,120,100,0.8)' }}>
                  {slopeValue.toFixed(1)}°
                </span>
                <div style={{ width: '1px', height: '12px', background: 'rgba(100,180,220,0.12)' }} />
                <span style={{ fontFamily: mono, fontSize: '0.58rem', color: 'rgba(160,210,235,0.6)' }}>{picked.aspect_name}</span>
              </div>
            ) : (
              <p style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '0.18em', color: 'rgba(120,160,200,0.4)', textTransform: 'uppercase' }}>
                Devam etmek için bir bölge seçin
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── HARİTA ── */}
      <MapLibreScanner
        lat={lat}
        lon={lon}
        onRiskZonesDetected={() => {}}
        onPointSelect={(point) => {
          setPicked(point)
          console.log('✅ onPointSelect:', point, { from, to })
        }}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drainBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  )
}
