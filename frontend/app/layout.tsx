import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MeteoSens — Risk Tarayıcı',
  description: 'Çığ risk tarama ve arazi analiz sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
