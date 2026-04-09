'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const mono  = "'Share Tech Mono', 'Courier New', monospace"
const bebas = "'Bebas Neue', 'Impact', sans-serif"

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

export default function HomePage() {
  const router = useRouter()
  const [lat, setLat] = useState('38.1290')
  const [lon, setLon] = useState('42.8080')
  const [from, setFrom] = useState('')
  const [to, setTo]   = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const latN = parseFloat(lat)
    const lonN = parseFloat(lon)
    if (isNaN(latN) || isNaN(lonN)) { setError('Geçerli koordinat girin'); return }
    if (latN < -90 || latN > 90)    { setError('Enlem -90 ile 90 arasında olmalı'); return }
    if (lonN < -180 || lonN > 180)  { setError('Boylam -180 ile 180 arasında olmalı'); return }
    setError('')
    router.push(`/scanner?lat=${latN}&lon=${lonN}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.85rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(100,180,220,0.15)',
    borderRadius: '7px', outline: 'none',
    fontFamily: mono, fontSize: '0.72rem',
    color: 'rgba(200,225,245,0.85)',
    letterSpacing: '0.08em',
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#000', fontFamily: mono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SnowCanvas />

      <div style={{ position: 'relative', zIndex: 10, width: '420px' }}>
        {/* Logo + Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <svg width="56" height="40" viewBox="0 0 80 60" fill="none" style={{ opacity: 0.85, filter: 'drop-shadow(0 0 8px rgba(120,200,240,0.45))', margin: '0 auto 1rem' }}>
            <polyline points="52,48 68,18 84,48" stroke="rgba(120,200,240,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
            <polyline points="4,48 28,8 44,32"   stroke="rgba(160,220,245,0.9)"  strokeWidth="1.8" strokeLinejoin="round" />
            <polyline points="44,32 58,14 76,48"  stroke="rgba(160,220,245,0.9)"  strokeWidth="1.8" strokeLinejoin="round" />
            <polyline points="24,14 28,8 32,14"   stroke="rgba(220,240,255,0.95)" strokeWidth="1.5" strokeLinejoin="round" />
            <polyline points="54,20 58,14 62,20"  stroke="rgba(220,240,255,0.95)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <p style={{ fontFamily: bebas, fontSize: '1.8rem', letterSpacing: '0.32em', color: 'rgba(200,225,245,0.9)' }}>TERRAINSCANNER</p>
          <p style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '0.22em', color: 'rgba(120,160,200,0.5)', marginTop: '0.25rem' }}>ARAZİ TARAYICI SİSTEMİ</p>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(100,180,220,0.1)',
          borderRadius: '14px',
          padding: '1.75rem',
        }}>
          <p style={{ fontFamily: bebas, fontSize: '0.75rem', letterSpacing: '0.28em', color: 'rgba(120,160,200,0.5)', marginBottom: '1.25rem', textAlign: 'center' }}>
            — ANALİZ KOORDİNATI —
          </p>

          {/* Lat / Lon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.16em', color: 'rgba(120,160,200,0.45)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Enlem (°K)</label>
              <input style={inp} value={lat} onChange={e => setLat(e.target.value)} placeholder="38.1290" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.16em', color: 'rgba(120,160,200,0.45)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Boylam (°D)</label>
              <input style={inp} value={lon} onChange={e => setLon(e.target.value)} placeholder="42.8080" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          </div>

          {/* Tarih aralığı (opsiyonel) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.16em', color: 'rgba(120,160,200,0.45)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Başlangıç (opsiyonel)</label>
              <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.16em', color: 'rgba(120,160,200,0.45)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Bitiş (opsiyonel)</label>
              <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {/* Hata */}
          {error && (
            <p style={{ fontFamily: mono, fontSize: '0.5rem', color: 'rgba(255,100,80,0.85)', letterSpacing: '0.1em', marginBottom: '0.75rem', textAlign: 'center' }}>{error}</p>
          )}

          {/* Başlat */}
          <button
            onClick={handleSubmit}
            style={{
              width: '100%', padding: '0.85rem',
              background: 'rgba(34,211,238,0.1)',
              border: '1px solid rgba(34,211,238,0.35)',
              borderRadius: '8px', cursor: 'pointer',
              fontFamily: bebas, fontSize: '0.95rem',
              letterSpacing: '0.28em', color: 'rgba(34,211,238,0.95)',
              textTransform: 'uppercase',
              transition: 'all 0.25s',
              boxShadow: '0 0 20px rgba(34,211,238,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.18)'; e.currentTarget.style.boxShadow = '0 0 28px rgba(34,211,238,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)' }}
          >
            Taramayı Başlat →
          </button>

          <p style={{ fontFamily: mono, fontSize: '0.44rem', color: 'rgba(120,160,200,0.3)', letterSpacing: '0.1em', textAlign: 'center', marginTop: '0.9rem', lineHeight: 1.8 }}>
            Backend: localhost:5001 · MapTiler API gerekli
          </p>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>
    </div>
  )
}
