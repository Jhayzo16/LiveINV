import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import QRCode from 'qrcode'
import { toast } from '@/components/ui/toast'
import keyboardDeviceImage from '@/assets/device-keyboard.png'
import monitorDeviceImage from '@/assets/device-monitor.png'
import printerDeviceImage from '@/assets/device-printer.jpeg'
import routerDeviceImage from '@/assets/device-router.png'
import scannerDeviceImage from '@/assets/device-scanner.jpg'
import systemUnitDeviceImage from '@/assets/device-system-unit.jpg'
import upsDeviceImage from '@/assets/device-ups.webp'
import registeredAssetsMetricIcon from '../assets/metrics/registered-assets.png'
import activeReadyMetricIcon from '../assets/metrics/active-ready.png'
import needsAttentionMetricIcon from '../assets/metrics/needs-attention.png'
import roomsVerifiedMetricIcon from '../assets/metrics/rooms-verified.png'
import '../device-workflow.css'

export type SystemModule = 'dashboard' | 'assets' | 'assignments' | 'qr' | 'network' | 'maintenance' | 'reports' | 'users' | 'manual'

type AssetState = 'Active' | 'Maintenance' | 'Broken' | 'Inactive'
type InventoryAsset = {
  tag: string
  qrId: string
  name: string
  category: string
  location: string
  owner: string
  state: AssetState
  ip: string
  brand?: string
  model?: string
  ramCapacityGb?: number
  ramModules?: number
  ssdCapacityGb?: number
  ssdCount?: number
  processor?: string
}

const assets: InventoryAsset[] = [
  { tag: 'PC-MRR-01', qrId: 'LIV-MRR0001', name: 'Dell OptiPlex 7090', category: 'System Unit', location: 'F5 · Medical Records', owner: 'IT Department', state: 'Active', ip: '10.20.5.31', brand: 'Dell', model: 'OptiPlex 7090', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 512, ssdCount: 1 },
  { tag: 'PRN-ACC-02', qrId: 'LIV-ACC0002', name: 'HP LaserJet Pro M404', category: 'Printer', location: 'F5 · Accounting', owner: 'Finance', state: 'Maintenance', ip: '10.20.5.52', brand: 'HP', model: 'LaserJet Pro M404' },
  { tag: 'MON-HR-04', qrId: 'LIV-HR00004', name: 'Dell P2422H Display', category: 'Monitor', location: 'F5 · HR Office', owner: 'Human Resources', state: 'Active', ip: '—', brand: 'Dell', model: 'P2422H Display' },
  { tag: 'PC-ER-12', qrId: 'LIV-ER00012', name: 'Lenovo ThinkCentre M80', category: 'System Unit', location: 'F1 · ER Reception', owner: 'Emergency', state: 'Broken', ip: '10.20.1.42', brand: 'Lenovo', model: 'ThinkCentre M80', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 256, ssdCount: 1 },
  { tag: 'AP-OR-03', qrId: 'LIV-OR00003', name: 'Aruba AP-515', category: 'Router', location: 'F2 · Operating Room', owner: 'IT Department', state: 'Active', ip: '10.20.2.11', brand: 'Aruba', model: 'AP-515' },
  { tag: 'UPS-LAB-02', qrId: 'LIV-LAB0002', name: 'APC Smart-UPS 1500', category: 'UPS', location: 'F1 · Laboratory', owner: 'Laboratory', state: 'Inactive', ip: '—', brand: 'APC', model: 'Smart-UPS 1500' },
  { tag: 'PC-NEW-07', qrId: 'LIV-NEW0007', name: 'Acer Veriton X', category: 'System Unit', location: 'Unassigned', owner: 'Unassigned', state: 'Active', ip: '—', brand: 'Acer', model: 'Veriton X', processor: 'Intel Core i5-12400', ramCapacityGb: 8, ramModules: 1, ssdCapacityGb: 512, ssdCount: 1 },
]

const SAVED_ASSETS_KEY = 'liveinv-registered-assets'
const createQrId = () => `LIV-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`

const devicePreviewImages: Record<string, string> = {
  Computer: systemUnitDeviceImage,
  Keyboard: keyboardDeviceImage,
  Monitor: monitorDeviceImage,
  Network: routerDeviceImage,
  Power: upsDeviceImage,
  Printer: printerDeviceImage,
  Router: routerDeviceImage,
  Scanner: scannerDeviceImage,
  'System Unit': systemUnitDeviceImage,
  UPS: upsDeviceImage,
}

const activity = [
  ['PC-MRR-01 verified', 'Medical Records · 8 minutes ago'],
  ['PRN-ACC-02 sent for maintenance', 'Accounting · 24 minutes ago'],
  ['MON-HR-04 reassigned', 'HR Office · 1 hour ago'],
  ['AP-OR-03 network profile updated', 'Operating Room · 2 hours ago'],
]

const moduleNames: Record<SystemModule, string> = {
  dashboard: 'Dashboard', assets: 'Asset registry', assignments: 'Assignments', qr: 'QR scanner',
  network: 'Network registry', maintenance: 'Maintenance', reports: 'Reports', users: 'Users & roles', manual: 'System manual',
}

export function SystemModulePage({ module }: { module: SystemModule }) {
  const [inventoryAssets, setInventoryAssets] = useState<InventoryAsset[]>(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_ASSETS_KEY)
      if (!saved) return assets
      const savedAssets = (JSON.parse(saved) as Array<InventoryAsset & { qrId?: string }>).map(item => ({ ...item, qrId: item.qrId || createQrId() }))
      window.localStorage.setItem(SAVED_ASSETS_KEY, JSON.stringify(savedAssets))
      return [...savedAssets, ...assets.filter(seed => !savedAssets.some(item => item.tag === seed.tag))]
    } catch {
      return assets
    }
  })
  const registerAsset = (asset: InventoryAsset) => {
    setInventoryAssets(current => {
      const next = [asset, ...current.filter(item => item.tag !== asset.tag)]
      window.localStorage.setItem(SAVED_ASSETS_KEY, JSON.stringify(next))
      return next
    })
  }
  const updateAsset = (originalTag: string, asset: InventoryAsset) => {
    setInventoryAssets(current => {
      const next = current.map(item => item.tag === originalTag ? asset : item)
      window.localStorage.setItem(SAVED_ASSETS_KEY, JSON.stringify(next))
      return next
    })
  }
  const page = {
    dashboard: <DashboardPage />,
    assets: <AssetsPage inventoryAssets={inventoryAssets} onRegister={registerAsset} onUpdate={updateAsset} />,
    assignments: <AssignmentsPage inventoryAssets={inventoryAssets} onAssign={registerAsset} />,
    qr: <QrPage inventoryAssets={inventoryAssets} onUpdate={updateAsset} />,
    network: <NetworkPage />,
    maintenance: <MaintenancePage />,
    reports: <ReportsPage />,
    users: <UsersPage />,
    manual: <ManualPage />,
  }[module]

  return <section className="workspace module-workspace" aria-label={moduleNames[module]}>{page}</section>
}

function ModuleHeading({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="module-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary-action" onClick={onAction}>＋ {action}</button>}</div>
}

function Metric({ label, value, note, tone = 'navy', icon }: { label: string; value: string; note: string; tone?: 'navy' | 'green' | 'maroon' | 'amber'; icon?: string }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-card-top">
      <span>{label}</span>
      {icon && <span className="metric-card-icon" style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }} />}
    </div>
    <b>{value}</b>
    <small>{note}</small>
  </article>
}

function DashboardPage() {
  return <>
    <ModuleHeading eyebrow="OPERATIONS OVERVIEW" title="Good morning, Inventory Team" description="A clear view of hospital assets, service risks, and inventory activity for today." action="Register asset" />
    <div className="metric-grid">
      <Metric label="Registered assets" value="648" note="+18 this month" icon={registeredAssetsMetricIcon} />
      <Metric label="Active and ready" value="521" note="80.4% of inventory" tone="green" icon={activeReadyMetricIcon} />
      <Metric label="Needs attention" value="127" note="86 maintenance · 41 broken" tone="maroon" icon={needsAttentionMetricIcon} />
      <Metric label="Rooms verified" value="109" note="23 rooms due this week" tone="amber" icon={roomsVerifiedMetricIcon} />
    </div>
    <div className="dashboard-grid">
      <article className="module-card asset-health"><CardTitle title="Asset health" subtitle="Current equipment condition" action="View registry" /><div className="health-layout"><div className="health-ring"><strong>80%</strong><span>operational</span></div><div className="health-legend"><StatusLine label="Active" value="521" color="green" /><StatusLine label="Maintenance" value="86" color="amber" /><StatusLine label="Broken" value="41" color="red" /></div></div></article>
      <article className="module-card floor-coverage"><CardTitle title="Verification coverage" subtitle="Rooms checked by floor" action="Open topology" />{[['Floor 1',88],['Floor 2',72],['Floor 3',94],['Floor 4',61],['Floor 5',79]].map(([floor,percent]) => <div className="coverage-row" key={String(floor)}><span>{floor}</span><div><i style={{width:`${percent}%`}} /></div><b>{percent}%</b></div>)}</article>
      <article className="module-card activity-card"><CardTitle title="Recent activity" subtitle="Latest inventory events" action="Audit log" />{activity.map(item => <div className="activity-row" key={item[0]}><i /><span><b>{item[0]}</b><small>{item[1]}</small></span></div>)}</article>
      <article className="module-card attention-card"><span className="attention-label">PRIORITY</span><h3>Six devices are overdue for verification</h3><p>Review equipment last verified more than 90 days ago before the next monthly inventory close.</p><button>Review overdue assets →</button></article>
    </div>
  </>
}

function AssetsPage({ inventoryAssets, onRegister, onUpdate }: { inventoryAssets: InventoryAsset[]; onRegister: (asset: InventoryAsset) => void; onUpdate: (originalTag: string, asset: InventoryAsset) => void }) {
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'system' | 'display' | 'printer' | 'network'>('all')
  const [statusFilter, setStatusFilter] = useState<'recent' | 'active' | 'maintenance'>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null)
  const [editingAsset, setEditingAsset] = useState<InventoryAsset | null>(null)
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleAssets = inventoryAssets.filter(item => {
    const matchesCategory = categoryFilter === 'all'
      || (categoryFilter === 'system' && item.category === 'System Unit')
      || (categoryFilter === 'display' && item.category === 'Monitor')
      || (categoryFilter === 'printer' && item.category === 'Printer')
      || (categoryFilter === 'network' && ['Router', 'Printer', 'System Unit'].includes(item.category))
    const matchesStatus = statusFilter === 'recent' || (statusFilter === 'active' && item.state === 'Active') || (statusFilter === 'maintenance' && item.state === 'Maintenance')
    const searchable = [item.tag, item.qrId, item.name, item.category, item.brand, item.model, item.location, item.owner, item.ip, item.processor, item.state].filter(Boolean).join(' ').toLowerCase()
    return matchesCategory && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery))
  })
  const systemUnitCount = inventoryAssets.filter(item => item.category === 'System Unit').length
  const displayCount = inventoryAssets.filter(item => item.category === 'Monitor').length
  const printerCount = inventoryAssets.filter(item => item.category === 'Printer').length
  const networkCount = inventoryAssets.filter(item => ['System Unit', 'Printer', 'Router'].includes(item.category)).length

  const categoryViews = [
    { key: 'system' as const, icon: '▥', label: 'System units', count: systemUnitCount },
    { key: 'display' as const, icon: '▰', label: 'Displays', count: displayCount },
    { key: 'printer' as const, icon: '▤', label: 'Printers', count: printerCount },
    { key: 'network' as const, icon: '⌁', label: 'Network equipment', count: networkCount },
  ]

  const viewTitle = categoryFilter === 'all' ? 'All devices' : categoryViews.find(view => view.key === categoryFilter)?.label || 'All devices'

  const exportRegistry = () => {
    const escapeCell = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const header = ['Asset tag', 'QR ID', 'Category', 'Brand', 'Model', 'Assignment', 'Department', 'IP address', 'Status', 'Processor', 'RAM modules', 'RAM GB per module', 'SSD drives', 'SSD GB per drive']
    const rows = visibleAssets.map(item => [item.tag, item.qrId, item.category, item.brand, item.model, item.location, item.owner, item.ip, item.state, item.processor, item.ramModules, item.ramCapacityGb, item.ssdCount, item.ssdCapacityGb])
    const csv = [header, ...rows].map(row => row.map(escapeCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `liveinv-assets-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveEditedAsset = (originalTag: string, updatedAsset: InventoryAsset) => {
    onUpdate(originalTag, updatedAsset)
    setSelectedAsset(updatedAsset)
    setEditingAsset(null)
  }

  return <>
    <header className="asset-gallery-heading">
      <div><span className="eyebrow">ASSET REGISTRY · FOCUSED VIEW</span><h1>{viewTitle}</h1><p>A visual overview of every registered equipment category across the hospital.</p></div>
      <div className="asset-gallery-actions"><span className="asset-total-pill">{inventoryAssets.length} total assets</span><button className="export-btn" onClick={exportRegistry}>Export</button><button className="primary-action" onClick={() => setRegistrationOpen(true)}>＋ Add device</button></div>
    </header>
    <nav className="asset-category-grid" aria-label="Asset categories">
      {categoryViews.map((view, index) => <button type="button" key={view.key} className={`asset-category-card ${(categoryFilter === view.key || (categoryFilter === 'all' && index === 0)) ? 'selected' : ''}`} aria-pressed={categoryFilter === view.key} onClick={() => setCategoryFilter(current => current === view.key ? 'all' : view.key)}><span>{view.icon}</span><div><b>{view.label}</b><small>{view.count} devices</small></div></button>)}
    </nav>
    <section className="module-card asset-gallery-toolbar" aria-label="Asset search and filters">
      <label className="search-field">⌕ <input aria-label="Search assets" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search all devices by asset tag, room, or model" /></label>
      <div className="filter-pills"><button className={statusFilter === 'recent' ? 'selected' : ''} onClick={() => setStatusFilter('recent')}>Recently updated</button><button className={statusFilter === 'active' ? 'selected' : ''} onClick={() => setStatusFilter('active')}>Active</button><button className={statusFilter === 'maintenance' ? 'selected' : ''} onClick={() => setStatusFilter('maintenance')}>Maintenance</button></div>
      <button className="export-btn asset-grid-mode" type="button" aria-label="Grid view selected">Grid ▦</button>
    </section>
    <AssetCardGrid inventoryAssets={visibleAssets} onSelect={setSelectedAsset} searchActive={Boolean(normalizedQuery || categoryFilter !== 'all' || statusFilter !== 'recent')} />
    {registrationOpen && <DeviceRegistrationDialog onClose={() => setRegistrationOpen(false)} onRegister={onRegister} />}
    {selectedAsset && <FullDeviceRecordDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} onEdit={() => { setEditingAsset(selectedAsset); setSelectedAsset(null) }} />}
    {editingAsset && <EditAssetDialog asset={editingAsset} onClose={() => setEditingAsset(null)} onSave={saveEditedAsset} />}
  </>
}

function AssetCardGrid({ inventoryAssets, onSelect, searchActive }: { inventoryAssets: InventoryAsset[]; onSelect: (asset: InventoryAsset) => void; searchActive: boolean }) {
  if (!inventoryAssets.length) return <div className="module-card asset-gallery-empty"><span>⌕</span><h3>No assets found</h3><p>{searchActive ? 'Try another search term or change the selected filter.' : 'No devices are registered yet.'}</p></div>

  return <div className="asset-device-grid">{inventoryAssets.map(item => <button type="button" className="asset-device-card" key={item.tag} onClick={() => onSelect(item)} aria-label={`Open full record for ${item.tag}`}>
    <div className="asset-device-visual"><DevicePreview asset={item} className="asset-card-preview" /><StatusBadge state={item.state} /></div>
    <div className="asset-device-copy"><span className="asset-device-category">{item.category}</span><h3>{item.tag}</h3><p>{item.name}</p><dl><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>Department</dt><dd>{item.owner}</dd></div></dl><footer><span className="mono">{item.ip === '—' ? 'No network' : item.ip}</span><b>View record →</b></footer></div>
  </button>)}</div>
}

function isAssetAssigned(asset: InventoryAsset) {
  return asset.location !== 'Unassigned' && asset.owner !== 'Unassigned'
}

function DevicePreview({ asset, className = '' }: { asset: InventoryAsset; className?: string }) {
  const previewImage = devicePreviewImages[asset.category]
  const categoryClass = `device-preview-${asset.category.toLowerCase().replaceAll(' ', '-')}`
  return <figure className={`device-preview ${categoryClass} ${className} ${previewImage ? '' : 'is-fallback'}`}>
    {previewImage ? <img src={previewImage} alt={`${asset.category} preview for ${asset.name}`} /> : <span aria-hidden="true">▣</span>}
  </figure>
}

const departmentsByFloor: Record<string, string[]> = {
  '1': ['Emergency Department', 'Laboratory Department', 'Radiology Department'],
  '2': ['Surgical Services', 'Women and Children', 'Diagnostics Department'],
  '3': ['Food and Nutrition', 'Diagnostics Department', 'Administration'],
  '4': ['Outpatient Clinics', 'Dental Services', 'Specialty Services'],
  '5': ['Medical Records', 'Finance Department', 'Human Resources'],
  '6': ['Inpatient Services', 'Surgical Services', 'Women and Children'],
  '7': ['Executive Offices', 'Administration', 'Inpatient Services'],
}

type DeviceDraft = {
  tag: string
  category: string
  brand: string
  model: string
  status: AssetState
  ip: string
  ramCapacityGb: string
  ramModules: string
  ssdCapacityGb: string
  ssdCount: string
  processor: string
}

const deviceCategories = ['Printer', 'Monitor', 'Keyboard', 'System Unit', 'UPS', 'Scanner', 'Router'] as const
const RECENT_PROCESSORS_KEY = 'liveinv-recent-processors'

function DeviceRegistrationDialog({ onClose, onRegister }: { onClose: () => void; onRegister: (asset: InventoryAsset) => void }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [registeredAsset, setRegisteredAsset] = useState<InventoryAsset | null>(null)
  const [recentProcessors, setRecentProcessors] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(RECENT_PROCESSORS_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState<DeviceDraft>({
    tag: '', category: 'System Unit', brand: '', model: '', status: 'Active', ip: '',
    processor: '', ramCapacityGb: '', ramModules: '', ssdCapacityGb: '', ssdCount: '',
  })

  const updateDraft = <K extends keyof DeviceDraft>(key: K, value: DeviceDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 1 && !saving) {
      const tag = draft.tag.trim().toUpperCase()
      const supportsIp = draft.category === 'System Unit' || draft.category === 'Printer' || draft.category === 'Router'
      const processor = draft.processor.trim()
      const asset: InventoryAsset = {
        tag,
        qrId: createQrId(),
        name: `${draft.brand} ${draft.model}`.trim(),
        category: draft.category,
        location: 'Unassigned',
        owner: 'Unassigned',
        state: draft.status,
        ip: supportsIp ? draft.ip.trim() || '—' : '—',
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        ...(draft.category === 'System Unit' ? {
          processor,
          ramCapacityGb: Number(draft.ramCapacityGb),
          ramModules: Number(draft.ramModules),
          ssdCapacityGb: Number(draft.ssdCapacityGb),
          ssdCount: Number(draft.ssdCount),
        } : {}),
      }
      setSaving(true)
      const registration = Promise.all([
        QRCode.toDataURL(`liveinv:qr:${asset.qrId}`, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#1B6C24', light: '#FFFFFF' },
        }),
        new Promise(resolve => window.setTimeout(resolve, 800)),
      ]).then(([generatedQr]) => {
        onRegister(asset)
        if (draft.category === 'System Unit' && processor) {
          setRecentProcessors(current => {
            const next = [processor, ...current.filter(item => item.toLowerCase() !== processor.toLowerCase())].slice(0, 8)
            window.localStorage.setItem(RECENT_PROCESSORS_KEY, JSON.stringify(next))
            return next
          })
        }
        setQrDataUrl(generatedQr)
        setRegisteredAsset(asset)
        setStep(2)
        return asset
      })

      try {
        await toast.promise(registration, {
          loading: 'Saving device and generating QR…',
          success: savedAsset => `${savedAsset.tag} saved. QR code generated.`,
          error: 'Could not save the device or generate its QR code.',
        })
      } catch {
        // The toast presents the error and the form remains available for retrying.
      } finally {
        setSaving(false)
      }
    }
  }

  const systemUnitReady = draft.category !== 'System Unit' || (draft.processor.trim() && Number(draft.ramCapacityGb) > 0 && Number(draft.ramModules) > 0 && Number(draft.ssdCapacityGb) > 0 && Number(draft.ssdCount) > 0)
  const descriptionReady = draft.tag.trim() && draft.brand.trim() && draft.model.trim() && systemUnitReady

  return <div className="device-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="device-dialog" role="dialog" aria-modal="true" aria-labelledby="device-registration-title">
      <header className="device-dialog-header"><div><span>DEVICE REGISTRATION</span><h2 id="device-registration-title">Add a new device</h2><p>Record the equipment details now. Its hospital location can be assigned separately.</p></div><button type="button" aria-label="Close device registration" onClick={onClose}>×</button></header>
      <div className="device-registration-steps" aria-label={`Registration step ${step} of 2`}>
        {['Device details', 'Generate QR'].map((label, index) => <div key={label} className={`${step === index + 1 ? 'current' : ''} ${step > index + 1 ? 'complete' : ''}`}><b>{step > index + 1 ? '✓' : index + 1}</b><span>{label}</span></div>)}
      </div>

      {step === 1 && <form className="device-form" onSubmit={submit}>
        <div className="device-form-grid">
          <label>Asset tag<input required value={draft.tag} onChange={event => updateDraft('tag', event.target.value)} placeholder="e.g. PC-MRR-015" /></label>
          <label>Device category<select value={draft.category} onChange={event => updateDraft('category', event.target.value)}>{deviceCategories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Brand name<input required value={draft.brand} onChange={event => updateDraft('brand', event.target.value)} placeholder="e.g. Dell, HP, APC" /></label>
          <label>Model<input required value={draft.model} onChange={event => updateDraft('model', event.target.value)} placeholder="e.g. OptiPlex 7090" /></label>
          <label>Status<select value={draft.status} onChange={event => updateDraft('status', event.target.value as AssetState)}><option>Active</option><option>Maintenance</option><option>Broken</option><option>Inactive</option></select></label>
          {draft.category === 'System Unit' && <>
            <div className="device-spec-heading wide"><span>SYSTEM UNIT SPECIFICATIONS</span><p>Record the installed memory and storage configuration.</p></div>
            <label className="wide">Processor <small>Type the complete processor model</small><input required list="recent-processor-suggestions" value={draft.processor} onChange={event => updateDraft('processor', event.target.value)} placeholder="e.g. Intel Core i5-12400 or AMD Ryzen 5 5600G" /><datalist id="recent-processor-suggestions">{recentProcessors.map(processor => <option key={processor} value={processor} />)}</datalist></label>
            <div className="processor-recent-suggestions wide"><span>RECENT PROCESSOR SUGGESTIONS</span>{recentProcessors.length ? <div>{recentProcessors.map(processor => <button type="button" key={processor} onClick={() => updateDraft('processor', processor)}>{processor}</button>)}</div> : <p>Recently entered processor specifications will appear here.</p>}</div>
            <label>RAM capacity per module <small>Gigabytes</small><input required type="number" min="1" value={draft.ramCapacityGb} onChange={event => updateDraft('ramCapacityGb', event.target.value)} placeholder="8" /></label>
            <label>RAM modules installed <small>Number of RAM sticks</small><input required type="number" min="1" value={draft.ramModules} onChange={event => updateDraft('ramModules', event.target.value)} placeholder="2" /></label>
            <label>SSD capacity per drive <small>Gigabytes</small><input required type="number" min="1" value={draft.ssdCapacityGb} onChange={event => updateDraft('ssdCapacityGb', event.target.value)} placeholder="512" /></label>
            <label>SSDs installed <small>Number of SSD drives</small><input required type="number" min="1" value={draft.ssdCount} onChange={event => updateDraft('ssdCount', event.target.value)} placeholder="1" /></label>
          </>}
          {(draft.category === 'System Unit' || draft.category === 'Printer' || draft.category === 'Router') && <label className="wide">IP address <small>Optional; can be assigned or updated later</small><input value={draft.ip} onChange={event => updateDraft('ip', event.target.value)} placeholder="10.20.x.x" /></label>}
        </div>

        <div className="registration-assignment-note"><AssignmentBadge assigned={false} /><p>The new device will enter the inventory as unassigned. Use the Assignments page when its floor, department, and room are known.</p></div>
        <footer className="device-form-actions"><button type="button" className="export-btn" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={!descriptionReady || saving}>{saving ? 'Saving & generating QR…' : 'Save device & generate QR →'}</button></footer>
      </form>}

      {step === 2 && registeredAsset && <div className="device-qr-complete">
        <div className="generated-qr">{qrDataUrl ? <img src={qrDataUrl} alt={`QR code for ${registeredAsset.tag}`} /> : <span>Generating QR…</span>}</div>
        <div className="device-qr-summary"><span>DEVICE REGISTERED</span><h3>{registeredAsset.tag}</h3><p>{registeredAsset.name}</p><dl><div><dt>QR fallback ID</dt><dd className="mono">{registeredAsset.qrId}</dd></div><div><dt>Assignment</dt><dd><AssignmentBadge assigned={false} /></dd></div><div><dt>Device status</dt><dd>{registeredAsset.state}</dd></div></dl><div className="qr-security-note qr-fallback-note"><b>Manual identification ID</b><p>If the printed QR code cannot be scanned, enter <strong>{registeredAsset.qrId}</strong> in the QR Scanner to identify this device.</p></div><div className="qr-security-note"><b>Secure QR label</b><p>The code contains only <code>liveinv:qr:{registeredAsset.qrId}</code>. Device details remain inside the inventory system.</p></div></div>
        <footer className="device-qr-actions"><button type="button" className="export-btn" onClick={() => window.print()}>Print label</button>{qrDataUrl && <a className="primary-action" href={qrDataUrl} download={`${registeredAsset.tag}-qr.png`}>Download QR</a>}<button type="button" className="primary-action" onClick={onClose}>Done</button></footer>
      </div>}
    </section>
  </div>
}

function EditAssetDialog({ asset, onClose, onSave }: { asset: InventoryAsset; onClose: () => void; onSave: (originalTag: string, asset: InventoryAsset) => void }) {
  const [recentProcessors, setRecentProcessors] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(RECENT_PROCESSORS_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState<DeviceDraft>({
    tag: asset.tag,
    category: asset.category,
    brand: asset.brand || '',
    model: asset.model || '',
    status: asset.state,
    ip: asset.ip === '—' ? '' : asset.ip,
    processor: asset.processor || '',
    ramCapacityGb: asset.ramCapacityGb ? String(asset.ramCapacityGb) : '',
    ramModules: asset.ramModules ? String(asset.ramModules) : '',
    ssdCapacityGb: asset.ssdCapacityGb ? String(asset.ssdCapacityGb) : '',
    ssdCount: asset.ssdCount ? String(asset.ssdCount) : '',
  })

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const updateDraft = <K extends keyof DeviceDraft>(key: K, value: DeviceDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const supportsIp = draft.category === 'System Unit' || draft.category === 'Printer' || draft.category === 'Router'
  const systemUnitReady = draft.category !== 'System Unit' || (draft.processor.trim() && Number(draft.ramCapacityGb) > 0 && Number(draft.ramModules) > 0 && Number(draft.ssdCapacityGb) > 0 && Number(draft.ssdCount) > 0)
  const formReady = draft.brand.trim() && draft.model.trim() && systemUnitReady

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formReady) return
    const processor = draft.processor.trim()
    const updatedAsset: InventoryAsset = {
      ...asset,
      name: `${draft.brand.trim()} ${draft.model.trim()}`,
      category: draft.category,
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      state: draft.status,
      ip: supportsIp ? draft.ip.trim() || '—' : '—',
      processor: draft.category === 'System Unit' ? processor : undefined,
      ramCapacityGb: draft.category === 'System Unit' ? Number(draft.ramCapacityGb) : undefined,
      ramModules: draft.category === 'System Unit' ? Number(draft.ramModules) : undefined,
      ssdCapacityGb: draft.category === 'System Unit' ? Number(draft.ssdCapacityGb) : undefined,
      ssdCount: draft.category === 'System Unit' ? Number(draft.ssdCount) : undefined,
    }
    if (draft.category === 'System Unit' && processor) {
      const next = [processor, ...recentProcessors.filter(item => item.toLowerCase() !== processor.toLowerCase())].slice(0, 8)
      window.localStorage.setItem(RECENT_PROCESSORS_KEY, JSON.stringify(next))
      setRecentProcessors(next)
    }
    onSave(asset.tag, updatedAsset)
  }

  return <div className="device-dialog-backdrop asset-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="device-dialog asset-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-edit-title">
      <header className="device-dialog-header"><div><span>EDIT DEVICE</span><h2 id="asset-edit-title">Update asset record</h2><p>Edit its description, status, and applicable technical specifications.</p></div><button type="button" aria-label="Close asset editor" onClick={onClose}>×</button></header>
      <form className="device-form" onSubmit={submit}>
        <div className="asset-edit-identity"><div><span>Asset tag</span><b>{asset.tag}</b></div><div><span>QR fallback ID</span><b className="mono">{asset.qrId}</b></div></div>
        <div className="device-form-grid">
          <label>Device category<select value={draft.category} onChange={event => updateDraft('category', event.target.value)}>{deviceCategories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Status<select value={draft.status} onChange={event => updateDraft('status', event.target.value as AssetState)}><option>Active</option><option>Maintenance</option><option>Broken</option><option>Inactive</option></select></label>
          <label>Brand name<input required value={draft.brand} onChange={event => updateDraft('brand', event.target.value)} placeholder="e.g. Dell, HP, APC" /></label>
          <label>Model<input required value={draft.model} onChange={event => updateDraft('model', event.target.value)} placeholder="e.g. OptiPlex 7090" /></label>
          {draft.category === 'System Unit' && <>
            <div className="device-spec-heading wide"><span>SYSTEM UNIT SPECIFICATIONS</span><p>Update the installed processor, memory, and storage configuration.</p></div>
            <label className="wide">Processor <small>Type the complete processor model</small><input required list="edit-processor-suggestions" value={draft.processor} onChange={event => updateDraft('processor', event.target.value)} placeholder="e.g. Intel Core i5-12400 or AMD Ryzen 5 5600G" /><datalist id="edit-processor-suggestions">{recentProcessors.map(processor => <option key={processor} value={processor} />)}</datalist></label>
            <div className="processor-recent-suggestions wide"><span>RECENT PROCESSOR SUGGESTIONS</span>{recentProcessors.length ? <div>{recentProcessors.map(processor => <button type="button" key={processor} onClick={() => updateDraft('processor', processor)}>{processor}</button>)}</div> : <p>Recently entered processor specifications will appear here.</p>}</div>
            <label>RAM capacity per module <small>Gigabytes</small><input required type="number" min="1" value={draft.ramCapacityGb} onChange={event => updateDraft('ramCapacityGb', event.target.value)} /></label>
            <label>RAM modules installed <small>Number of RAM sticks</small><input required type="number" min="1" value={draft.ramModules} onChange={event => updateDraft('ramModules', event.target.value)} /></label>
            <label>SSD capacity per drive <small>Gigabytes</small><input required type="number" min="1" value={draft.ssdCapacityGb} onChange={event => updateDraft('ssdCapacityGb', event.target.value)} /></label>
            <label>SSDs installed <small>Number of SSD drives</small><input required type="number" min="1" value={draft.ssdCount} onChange={event => updateDraft('ssdCount', event.target.value)} /></label>
          </>}
          {supportsIp && <label className="wide">IP address <small>Optional; leave blank if no address is assigned</small><input value={draft.ip} onChange={event => updateDraft('ip', event.target.value)} placeholder="10.20.x.x" /></label>}
        </div>
        <div className="asset-edit-assignment-note"><AssignmentBadge assigned={isAssetAssigned(asset)} /><p>Location and department are managed separately on the Assignments page, so editing this record will not move the device.</p></div>
        <footer className="device-form-actions"><button type="button" className="export-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-action" disabled={!formReady}>Save changes</button></footer>
      </form>
    </section>
  </div>
}

function AssignmentsPage({ inventoryAssets, onAssign }: { inventoryAssets: InventoryAsset[]; onAssign: (asset: InventoryAsset) => void }) {
  const unassignedAssets = inventoryAssets.filter(item => !isAssetAssigned(item))
  const [selectedTag, setSelectedTag] = useState(unassignedAssets[0]?.tag || '')
  const [floor, setFloor] = useState('1')
  const [department, setDepartment] = useState(departmentsByFloor['1'][0])
  const [room, setRoom] = useState('')
  const [message, setMessage] = useState('')
  const selectedAsset = unassignedAssets.find(item => item.tag === selectedTag) || unassignedAssets[0]

  useEffect(() => {
    if (!unassignedAssets.some(item => item.tag === selectedTag)) setSelectedTag(unassignedAssets[0]?.tag || '')
  }, [inventoryAssets, selectedTag, unassignedAssets])

  const assignDevice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAsset || !room.trim()) return
    onAssign({ ...selectedAsset, location: `F${floor} · ${room.trim()}`, owner: department })
    setMessage(`${selectedAsset.tag} is now assigned to Floor ${floor}, ${department}, ${room.trim()}.`)
    setRoom('')
  }

  return <>
    <ModuleHeading eyebrow="LOCATION CONTROL" title="Assign unassigned devices" description="Select a registered device, then give it a floor, department, and room when its destination is confirmed." />
    <div className="assignment-layout">
      <article className="module-card transfer-card">
        <div className="assignment-form-heading"><div><AssignmentBadge assigned={false} /><h3>Device assignment</h3><p>Only devices without a hospital location appear here.</p></div><strong>{unassignedAssets.length} waiting</strong></div>
        {selectedAsset ? <form onSubmit={assignDevice}>
          <label>Unassigned device<select value={selectedAsset.tag} onChange={event => { setSelectedTag(event.target.value); setMessage('') }}>{unassignedAssets.map(item => <option key={item.tag} value={item.tag}>{item.tag} — {item.name}</option>)}</select></label>
          <div className="selected-asset assignment-selected"><span>{selectedAsset.category.slice(0, 2).toUpperCase()}</span><p><b>{selectedAsset.tag}</b><small>{selectedAsset.name} · QR ID {selectedAsset.qrId}</small></p><AssignmentBadge assigned={false} /></div>
          <div className="form-grid"><label>Floor<select value={floor} onChange={event => { const nextFloor = event.target.value; setFloor(nextFloor); setDepartment(departmentsByFloor[nextFloor][0]) }}>{Object.keys(departmentsByFloor).map(item => <option key={item} value={item}>Floor {item}</option>)}</select></label><label>Department<select value={department} onChange={event => setDepartment(event.target.value)}>{departmentsByFloor[floor].map(item => <option key={item}>{item}</option>)}</select></label><label className="wide">Room or office<input required value={room} onChange={event => setRoom(event.target.value)} placeholder="e.g. Medical Records Archives Room" /></label></div>
          {message && <div className="assignment-success" role="status">✓ {message}</div>}
          <div className="form-actions"><button type="button" className="export-btn" onClick={() => setRoom('')}>Clear</button><button type="submit" className="primary-action" disabled={!room.trim()}>Assign device →</button></div>
        </form> : <div className="assignment-empty"><span>✓</span><h3>All registered devices are assigned</h3><p>Newly added devices will appear here automatically with an Unassigned label.</p></div>}
      </article>
      <article className="module-card move-summary unassigned-queue"><CardTitle title="Unassigned queue" subtitle="Devices ready for a confirmed location" />{unassignedAssets.length ? unassignedAssets.map((item, index) => <button type="button" className={item.tag === selectedAsset?.tag ? 'queue-device selected' : 'queue-device'} key={item.tag} onClick={() => { setSelectedTag(item.tag); setMessage('') }}><span>{index + 1}</span><div><b>{item.tag}</b><small>{item.name}</small></div><AssignmentBadge assigned={false} /></button>) : <p className="queue-complete">No devices are waiting for assignment.</p>}</article>
    </div>
  </>
}

function QrPage({ inventoryAssets, onUpdate }: { inventoryAssets: InventoryAsset[]; onUpdate: (originalTag: string, asset: InventoryAsset) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<IScannerControls | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [scannedAsset, setScannedAsset] = useState<InventoryAsset | null>(null)

  const resolveAssetCode = (rawCode: string) => {
    const normalized = rawCode.trim().replace(/^liveinv:(?:asset|qr):/i, '').toUpperCase()
    const match = inventoryAssets.find(item => item.tag.toUpperCase() === normalized || item.qrId.toUpperCase() === normalized)
    if (!match) {
      setScanMessage(`No registered device matches “${rawCode.trim()}”.`)
      setScannedAsset(null)
      return false
    }
    setScannedAsset(match)
    setScanMessage(`Device ${match.tag} identified successfully.`)
    setManualCode('')
    setManualOpen(false)
    return true
  }

  useEffect(() => {
    if (!scanning || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    let disposed = false
    reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
      if (!result || disposed) return
      if (resolveAssetCode(result.getText())) setScanning(false)
    }).then(controls => {
      if (disposed) controls.stop()
      else scannerControls.current = controls
    }).catch(() => {
      setScanning(false)
      setScanMessage('Camera access was unavailable. You can enter the asset tag manually.')
    })
    return () => {
      disposed = true
      scannerControls.current?.stop()
      scannerControls.current = null
    }
  }, [scanning, inventoryAssets])

  const submitManualCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (manualCode.trim()) resolveAssetCode(manualCode)
  }

  return <>
    <ModuleHeading eyebrow="QUICK IDENTIFICATION" title="QR scanner" description="Scan a liveINV device label to instantly view its description, floor, department, room, and current status." />
    <div className="scanner-layout">
      <article className={`scanner-card ${scanning ? 'is-scanning' : ''}`}>
        <div className="scanner-frame"><i /><i /><i /><i />{scanning ? <video ref={videoRef} muted playsInline aria-label="QR scanner camera preview" /> : <span>▦</span>}{scanning && <div className="scan-line"/>}</div>
        <h3>{scanning ? 'Scanning for a liveINV label…' : 'Scan a device QR label'}</h3>
        <p>QR labels resolve to the secured inventory record; device details are not embedded in the label.</p>
        <div className="scanner-actions"><button className="primary-action" onClick={() => setScanning(active => !active)}>{scanning ? 'Stop camera' : 'Start camera'}</button><button className="export-btn" onClick={() => setManualOpen(open => !open)}>Enter code manually</button></div>
        {manualOpen && <form className="manual-scan-form" onSubmit={submitManualCode}><input autoFocus value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder="Asset tag or QR ID (e.g. LIV-MRR0001)" aria-label="Asset tag or QR identification ID" /><button className="primary-action" type="submit">Find device</button></form>}
        {scanMessage && <div className={`scan-message ${scannedAsset ? 'success' : 'error'}`} role="status">{scanMessage}</div>}
      </article>

      <article className="module-card qr-information-panel">
        {scannedAsset ? <QrAssetDetails asset={scannedAsset} onClear={() => { setScannedAsset(null); setScanMessage('') }} onUpdate={(originalTag, updatedAsset) => { onUpdate(originalTag, updatedAsset); setScannedAsset(updatedAsset) }} /> : <><CardTitle title="Awaiting a QR scan" subtitle="The identified device record will appear here" /><div className="qr-empty-state"><span>▦</span><h3>No device scanned yet</h3><p>Start the camera, enter an asset tag, or choose one of the recent devices below.</p></div></>}
        <div className="recent-scan-section"><CardTitle title="Recent devices" subtitle="Select one to preview the scan result" />{inventoryAssets.slice(0,5).map(item => <button type="button" className="scan-row" key={item.tag} onClick={() => { setScannedAsset(item); setScanMessage(`Device ${item.tag} identified successfully.`) }}><span>▦</span><div><b>{item.tag}</b><small>{item.location}</small></div><StatusBadge state={item.state}/></button>)}</div>
        <div className="privacy-note"><b>Secure QR rule</b><p>Labels contain only an asset token—never passwords, IP addresses, or clinical information.</p></div>
      </article>
    </div>
  </>
}

function QrAssetDetails({ asset, onClear, onUpdate }: { asset: InventoryAsset; onClear: () => void; onUpdate: (originalTag: string, asset: InventoryAsset) => void }) {
  const [fullRecordOpen, setFullRecordOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const assigned = isAssetAssigned(asset)
  const [floorCode, roomName = 'Not assigned'] = asset.location.split(' · ')
  const floorLabel = assigned && /^F\d+$/i.test(floorCode) ? `Floor ${floorCode.slice(1)}` : 'Not assigned'
  return <div className="qr-asset-result">
    <header><div><span>DEVICE IDENTIFIED</span><h2>{asset.tag}</h2><p>{asset.name}</p></div><div className="qr-result-labels"><AssignmentBadge assigned={assigned} /><StatusBadge state={asset.state} /></div></header>
    <DevicePreview asset={asset} className="qr-device-preview" />
    <dl><div><dt>QR fallback ID</dt><dd className="mono">{asset.qrId}</dd></div><div><dt>Description</dt><dd>{asset.name}</dd></div><div><dt>Device category</dt><dd>{asset.category}</dd></div><div><dt>Brand</dt><dd>{asset.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{asset.model || asset.name}</dd></div><div><dt>Assignment</dt><dd>{assigned ? 'Assigned' : 'Unassigned'}</dd></div><div><dt>Floor</dt><dd>{floorLabel}</dd></div><div><dt>Room</dt><dd>{assigned ? roomName : 'Not assigned'}</dd></div><div><dt>Department</dt><dd>{assigned ? asset.owner : 'Not assigned'}</dd></div><div><dt>Status</dt><dd>{asset.state}</dd></div>{asset.category === 'System Unit' && <><div><dt>Processor</dt><dd>{asset.processor || 'Not recorded'}</dd></div><div><dt>RAM configuration</dt><dd>{asset.ramModules || 0} × {asset.ramCapacityGb || 0} GB</dd></div><div><dt>SSD configuration</dt><dd>{asset.ssdCount || 0} × {asset.ssdCapacityGb || 0} GB</dd></div></>}<div><dt>Network address</dt><dd className="mono">{asset.ip}</dd></div></dl>
    <div className="qr-result-actions"><button className="export-btn" onClick={onClear}>Scan another</button><button className="primary-action" onClick={() => setFullRecordOpen(true)}>Open full device record →</button></div>
    {fullRecordOpen && <FullDeviceRecordDialog asset={asset} onClose={() => setFullRecordOpen(false)} onEdit={() => { setFullRecordOpen(false); setEditing(true) }} />}
    {editing && <EditAssetDialog asset={asset} onClose={() => setEditing(false)} onSave={(originalTag, updatedAsset) => { onUpdate(originalTag, updatedAsset); setEditing(false); setFullRecordOpen(true) }} />}
  </div>
}

function FullDeviceRecordDialog({ asset, onClose, onEdit }: { asset: InventoryAsset; onClose: () => void; onEdit?: () => void }) {
  const assigned = isAssetAssigned(asset)
  const [floorCode, roomName = 'Not assigned'] = asset.location.split(' · ')
  const floorLabel = assigned && /^F\d+$/i.test(floorCode) ? `Floor ${floorCode.slice(1)}` : 'Not assigned'
  const supportsNetwork = asset.category === 'System Unit' || asset.category === 'Printer' || asset.category === 'Router'

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="device-record-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="device-record-dialog" role="dialog" aria-modal="true" aria-labelledby="device-record-title">
      <header className="device-record-header"><div><span>FULL DEVICE RECORD</span><h2 id="device-record-title">{asset.tag}</h2><p>{asset.name}</p></div><button type="button" aria-label="Close full device record" onClick={onClose}>×</button></header>
      <div className="device-record-status"><div><span>QR fallback ID</span><b className="mono">{asset.qrId}</b></div><div><span>Category</span><b>{asset.category}</b></div><div><span>Assignment</span><AssignmentBadge assigned={assigned} /></div><div><span>Status</span><StatusBadge state={asset.state} /></div></div>
      <div className="device-record-content">
        <section className="device-record-preview-card"><DevicePreview asset={asset} className="device-record-preview" /><div><span>DEVICE PREVIEW</span><h3>{asset.category}</h3><p>{asset.brand || 'Brand not recorded'} · {asset.model || asset.name}</p><small>Visual reference for quick equipment identification.</small></div></section>
        <section><h3>Device identity</h3><dl><div><dt>Asset tag</dt><dd>{asset.tag}</dd></div><div><dt>QR identification ID</dt><dd className="mono">{asset.qrId}</dd></div><div><dt>Brand</dt><dd>{asset.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{asset.model || asset.name}</dd></div></dl></section>
        <section><h3>Hospital assignment</h3><dl><div><dt>Assignment status</dt><dd>{assigned ? 'Assigned' : 'Unassigned'}</dd></div><div><dt>Floor</dt><dd>{floorLabel}</dd></div><div><dt>Room</dt><dd>{assigned ? roomName : 'Not assigned'}</dd></div><div><dt>Department</dt><dd>{assigned ? asset.owner : 'Not assigned'}</dd></div></dl></section>
        {asset.category === 'System Unit' && <section><h3>System specifications</h3><dl><div><dt>Processor</dt><dd>{asset.processor || 'Not recorded'}</dd></div><div><dt>RAM modules</dt><dd>{asset.ramModules || 0}</dd></div><div><dt>RAM per module</dt><dd>{asset.ramCapacityGb || 0} GB</dd></div><div><dt>Total RAM</dt><dd>{(asset.ramModules || 0) * (asset.ramCapacityGb || 0)} GB</dd></div><div><dt>SSD drives</dt><dd>{asset.ssdCount || 0}</dd></div><div><dt>SSD per drive</dt><dd>{asset.ssdCapacityGb || 0} GB</dd></div><div><dt>Total SSD storage</dt><dd>{(asset.ssdCount || 0) * (asset.ssdCapacityGb || 0)} GB</dd></div></dl></section>}
        <section><h3>Network information</h3><dl><div><dt>Network capable</dt><dd>{supportsNetwork ? 'Yes' : 'No'}</dd></div><div><dt>IP address</dt><dd className="mono">{supportsNetwork ? asset.ip : 'Not applicable'}</dd></div></dl></section>
      </div>
      <footer className="device-record-actions"><button type="button" className="export-btn" onClick={onClose}>Close</button>{onEdit && <button type="button" className="primary-action" onClick={onEdit}>Edit device</button>}</footer>
    </section>
  </div>
}

function NetworkPage() {
  return <>
    <ModuleHeading eyebrow="IT OPERATIONS" title="Network registry" description="Monitor address assignments and verification status for network-capable equipment." action="Add network profile" />
    <div className="network-summary"><article><span>Address pool</span><b>10.20.0.0/16</b><small>Hospital private network</small></article><article><span>Assigned addresses</span><b>355</b><div><i style={{width:'71%'}} /></div><small>71% of managed pool</small></article><article><span>Conflicts detected</span><b className="danger">2</b><small>Requires IT review</small></article></div>
    <article className="module-card registry-card"><div className="registry-toolbar"><label className="search-field">⌕ <input aria-label="Search network registry" placeholder="Search IP, hostname, MAC, or asset" /></label><div className="filter-pills"><button className="selected">All profiles</button><button>Verified</button><button>Conflict</button></div></div><div className="data-table network-table"><div className="table-row table-head"><span>Asset / hostname</span><span>IPv4 address</span><span>MAC address</span><span>Location</span><span>Last verified</span><span>Status</span></div>{assets.filter(a=>a.ip!=='—').map((item,index)=><div className="table-row" key={item.tag}><span className="asset-cell"><i>IP</i><span><b>{item.tag}</b><small>HOSP-{item.tag}</small></span></span><span className="mono">{item.ip}</span><span className="mono">00:1B:44:11:{30+index}:7B</span><span>{item.location}</span><span>{index+2} days ago</span><span><StatusBadge state={index===3?'Maintenance':'Active'}/></span></div>)}</div></article>
  </>
}

function MaintenancePage() {
  const tickets = [
    ['MT-0261','PRN-ACC-02','Paper feed assembly replacement','High','In progress','Aug 25'],
    ['MT-0258','PC-ER-12','No power after voltage event','Critical','For diagnosis','Aug 24'],
    ['MT-0254','UPS-LAB-02','Battery health below threshold','Medium','Waiting parts','Aug 23'],
    ['MT-0249','AP-OR-03','Quarterly preventive inspection','Low','Scheduled','Aug 28'],
  ]
  return <><ModuleHeading eyebrow="SERVICE OPERATIONS" title="Maintenance queue" description="Prioritize repairs, preventive inspections, and equipment return-to-service." action="Create work order" /><div className="metric-grid compact"><Metric label="Open work orders" value="18" note="4 created this week" /><Metric label="Critical" value="3" note="Immediate attention" tone="maroon" /><Metric label="Waiting for parts" value="5" note="Average 3.2 days" tone="amber" /><Metric label="Completed this month" value="42" note="94% within SLA" tone="green" /></div><div className="maintenance-layout"><article className="module-card work-orders"><CardTitle title="Active work orders" subtitle="Sorted by operational priority" action="Filters" /><div className="ticket-head"><span>Work order</span><span>Issue</span><span>Priority</span><span>Stage</span><span>Opened</span></div>{tickets.map(ticket => <button className="ticket-row" key={ticket[0]}><span><b>{ticket[0]}</b><small>{ticket[1]}</small></span><span>{ticket[2]}</span><span className={`priority ${ticket[3].toLowerCase()}`}>{ticket[3]}</span><span>{ticket[4]}</span><span>{ticket[5]}</span></button>)}</article><article className="module-card maintenance-schedule"><CardTitle title="This week" subtitle="Preventive maintenance schedule" />{['Network room inspection','Printer cleaning cycle','UPS battery test','Workstation security check'].map((item,index)=><div className="schedule-row" key={item}><time>AUG<br/><b>{26+index}</b></time><span><b>{item}</b><small>{3+index} assets · Floor {index+1}</small></span></div>)}</article></div></>
}

function ReportsPage() {
  return <><ModuleHeading eyebrow="ANALYTICS" title="Reports and exports" description="Turn inventory records into operational summaries for IT and hospital management." action="Create report" /><div className="report-catalog"><ReportTile icon="▦" title="Inventory master list" note="All assets with location and status" /><ReportTile icon="⌁" title="Network assignment" note="IP, hostname, and verification report" /><ReportTile icon="⚒" title="Maintenance performance" note="Work orders, downtime, and SLA" /><ReportTile icon="⇄" title="Movement audit" note="Assignment and transfer history" /></div><div className="reports-layout"><article className="module-card"><CardTitle title="Assets by floor" subtitle="Current registered inventory" action="Last 30 days" /><div className="bar-chart">{[78,112,148,96,131,64,44].map((value,index)=><div key={index}><span style={{height:`${value/1.7}px`}}/><b>F{index+1}</b><small>{value}</small></div>)}</div></article><article className="module-card exports-card"><CardTitle title="Recent exports" subtitle="Generated by authorized users" />{[['Inventory Master List','XLSX · 2.4 MB'],['Monthly Maintenance Summary','PDF · 780 KB'],['Network Registry','CSV · 96 KB']].map(item=><button key={item[0]}><span>⇩</span><div><b>{item[0]}</b><small>{item[1]} · Today</small></div><i>Download</i></button>)}</article></div></>
}

function UsersPage() {
  const users = [['AD','Admin','Administrator','Active']]
  return <><ModuleHeading eyebrow="ACCESS CONTROL" title="Administrator" description="The system currently uses one administrator account with full inventory access." /><div className="users-layout"><article className="module-card registry-card"><div className="registry-toolbar"><label className="search-field">⌕ <input aria-label="Search users" placeholder="Search user or role" /></label><div className="filter-pills"><button className="selected">All users</button><button>Active</button></div></div><div className="user-list">{users.map(user=><button key={user[1]}><span className="user-avatar">{user[0]}</span><span><b>{user[1]}</b><small>{user[2]}</small></span><StatusBadge state={user[3] as AssetState}/><i>•••</i></button>)}</div></article><article className="module-card role-panel"><CardTitle title="Role permissions" subtitle="Selected: Administrator" /><div className="permission"><span>View inventory and topology</span><b>✓</b></div><div className="permission"><span>Create and edit assets</span><b>✓</b></div><div className="permission"><span>Assign or move assets</span><b>✓</b></div><div className="permission"><span>Scan QR and view records</span><b>✓</b></div><div className="permission"><span>Manage users and roles</span><b>✓</b></div><div className="permission"><span>Generate reports</span><b>✓</b></div></article></div></>
}

const manualSteps = [
  { icon: '▦', title: 'Review the dashboard', text: 'Start on the Dashboard to check asset totals, equipment condition, verification coverage, and recent activity.' },
  { icon: '＋', title: 'Register a device', text: 'Open Assets, select Add device, enter its category, brand, model, status, and applicable technical specifications.' },
  { icon: '▣', title: 'Generate and attach its QR label', text: 'After saving a device, download or print its generated QR label. Keep the fallback QR ID available for manual identification.' },
  { icon: '⇄', title: 'Assign its hospital location', text: 'Open Assignments, choose an unassigned device, then select its floor, department, and room.' },
  { icon: '⌘', title: 'Find equipment through Topology', text: 'Open Topology, select a floor, then hover or click a room to see its assigned devices and full equipment details.' },
  { icon: '▤', title: 'Search and update records', text: 'Use the Asset Registry search and filters. Click any device row to open its full record, then select Edit device when changes are needed.' },
  { icon: '⌗', title: 'Identify a device with QR', text: 'Open QR Scanner and scan the label. If scanning fails, enter the asset tag or QR fallback ID manually.' },
  { icon: '▥', title: 'Track condition and reports', text: 'Update the device status from its full record, then use Reports for inventory and operational summaries.' },
]

function ManualPage() {
  return <>
    <ModuleHeading eyebrow="USER GUIDE" title="How to use liveINV" description="Follow this workflow to register, assign, locate, identify, and maintain hospital equipment records." />
    <article className="manual-intro module-card"><div><span>QUICK START</span><h2>From registration to daily inventory control</h2><p>Each device receives one permanent asset record and QR identification ID. Location assignment is handled separately so newly registered equipment can remain clearly marked as unassigned.</p></div><div className="manual-flow"><span>Register</span><i>→</i><span>Generate QR</span><i>→</i><span>Assign</span><i>→</i><span>Track</span></div></article>
    <div className="manual-step-grid">{manualSteps.map((step, index) => <article className="manual-step module-card" key={step.title}><div className="manual-step-number"><b>{String(index + 1).padStart(2, '0')}</b><span>{step.icon}</span></div><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div>
    <div className="manual-notes"><article className="module-card"><span>SECURITY REMINDER</span><h3>QR labels contain only an identification token</h3><p>Passwords, IP addresses, and hospital information remain inside liveINV and are never stored directly in the printed QR code.</p></article><article className="module-card"><span>ASSIGNMENT RULE</span><h3>Register first, assign when the destination is confirmed</h3><p>Use the Unassigned label and the Assignments page to avoid recording an incorrect floor, department, or room.</p></article></div>
  </>
}

function CardTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) { return <div className="card-title"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button>{action} →</button>}</div> }
function StatusLine({label,value,color}:{label:string;value:string;color:string}) { return <div><span><i className={color}/>{label}</span><b>{value}</b></div> }
function StatusBadge({state}:{state:AssetState}) { return <span className={`status-badge ${state.toLowerCase()}`}><i/>{state}</span> }
function AssignmentBadge({ assigned }: { assigned: boolean }) { return <span className={`assignment-badge ${assigned ? 'assigned' : 'unassigned'}`}><i />{assigned ? 'Assigned' : 'Unassigned'}</span> }
function ReportTile({icon,title,note}:{icon:string;title:string;note:string}) { return <button className="report-tile"><span>{icon}</span><div><b>{title}</b><small>{note}</small></div><i>→</i></button> }
