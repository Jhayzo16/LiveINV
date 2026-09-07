import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import './asset-qr-code.css'

export function AssetQrCode({ tag, qrId }: { tag: string; qrId?: string }) {
  const [result, setResult] = useState<{ id: string; url?: string; error?: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (qrId) {
      QRCode.toDataURL(`liveinv:qr:${qrId}`, {
        width: 320, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: '#1B6C24', light: '#FFFFFF' },
      }).then(url => {
        if (!cancelled) setResult({ id: qrId, url })
      }).catch(() => {
        if (!cancelled) setResult({ id: qrId, error: true })
      })
    }
    return () => { cancelled = true }
  }, [qrId])

  const current = result?.id === qrId ? result : null
  return <div className="asset-qr-label">
    {current?.url ? <img src={current.url} alt={`QR code for ${tag}`} width={160} height={160} />
      : <span className="asset-qr-placeholder" role="status">{!qrId ? 'No QR code recorded' : current?.error ? 'QR image unavailable. Use the QR number below.' : 'Loading QR code…'}</span>}
    <div className="asset-qr-copy"><span>QR number</span><strong>{qrId || 'Not recorded'}</strong><span>Asset number</span><b>{tag}</b><small>Scan with the QR scanner or enter the number manually.</small></div>
  </div>
}
