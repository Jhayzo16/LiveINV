import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { InventoryAsset } from '../lib/types'
import { isAssetAssigned } from '../lib/assignments'

export function InventoryTools({ mode, assets, onClose, onSelect, loading, error }: {
  mode: 'search' | 'alerts'
  assets: InventoryAsset[]
  onClose: () => void
  onSelect: (tag: string) => void
  loading: boolean
  error: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    const initialFocus = element?.querySelector('input') ?? element?.querySelector('button')
    initialFocus?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus() }
  }, [])
  const visible = assets.filter(asset => mode === 'alerts'
    ? asset.state === 'Broken' || asset.state === 'Maintenance' || !isAssetAssigned(asset)
    : [asset.tag, asset.qrId, asset.name, asset.category, asset.brand, asset.model, asset.location, asset.owner, asset.ip]
      .filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  return createPortal(<dialog ref={dialog} className="inventory-tools-dialog" aria-labelledby="inventory-tools-title" onCancel={onClose}>
    <header><h2 id="inventory-tools-title">{mode === 'search' ? 'Search inventory' : 'Inventory alerts'}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
    {mode === 'search'
      ? <label className="inventory-tools-search">Find an asset<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Asset tag, QR ID, name, room, or IP address" /></label>
      : <p>Devices needing maintenance, repair, or a room assignment. Open a record to review or update it.</p>}
    {loading ? <p role="status">Loading inventory…</p> : error ? <p role="alert">Inventory could not be refreshed. Close this panel and use Retry inventory to reload the latest records.</p> : null}
    {!loading && <p role="status">{visible.length ? `${visible.length} ${mode === 'search' ? `matching ${visible.length === 1 ? 'device' : 'devices'}` : `${visible.length === 1 ? 'device' : 'devices'} needing attention`}` : mode === 'search' ? 'No matching assets.' : error ? 'Alerts are unavailable.' : 'No inventory alerts. All devices are assigned and none need maintenance or repair.'}</p>}
    <div className="inventory-tools-results">{visible.map(asset => <button type="button" key={asset.tag} onClick={() => onSelect(asset.tag)}>
      <span><b>{asset.tag}</b><small>{asset.name} · {asset.location}</small></span>
      <span>{mode === 'alerts' ? [asset.state === 'Broken' || asset.state === 'Maintenance' ? asset.state : '', !isAssetAssigned(asset) ? 'Unassigned' : ''].filter(Boolean).join(' · ') : asset.category}<small>View record →</small></span>
    </button>)}</div>
  </dialog>, document.body)
}
