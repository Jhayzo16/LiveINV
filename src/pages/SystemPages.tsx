import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AssetRepository } from '../lib/repositories'
import { deviceRegistrationSchema, deviceAssignmentSchema, type DeviceRegistrationData, type DeviceAssignmentData } from '../lib/schemas'
import { type InventoryAsset, type AssetState, type DeviceCategory } from '../lib/types'
import { assignmentLocations } from '../lib/rooms'
import { assignAsset, floorIdFromLocation, isAssetAssigned, unassignAsset } from '../lib/assignments'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import QRCode from 'qrcode'
import { AssetQrCode } from '../components/ui/asset-qr-code'
import { toast } from '@/components/ui/toast'
import { EquipmentEmptyState, EquipmentIcon, type EquipmentKind } from '@/components/ui/equipment-empty-state'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
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
import { SystemUnitStockFields, stockChanges } from '../components/SystemUnitStockFields'
import { ConsumablesPage } from './ConsumablesPage'
import { PmsPage } from './PmsPage'

export type SystemModule = 'dashboard' | 'assets' | 'consumables' | 'pms' | 'assignments' | 'qr' | 'network' | 'maintenance' | 'reports' | 'users' | 'manual'
type AssetAction = { id: number; tag?: string; edit?: boolean }
export type AssignmentTarget = { floor: string; roomId: string; room: string; department: string }

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
  pms: 'Preventive Maintenance Service', dashboard: 'Dashboard', assets: 'Asset registry', consumables: 'Consumables', assignments: 'Assignments', qr: 'QR scanner',
  network: 'Network registry', maintenance: 'Maintenance', reports: 'Reports', users: 'Users & roles', manual: 'System manual',
}

export function SystemModulePage({ module, assignmentTarget, assetAction }: { module: SystemModule; assignmentTarget?: AssignmentTarget | null; assetAction?: AssetAction | null }) {
  const queryClient = useQueryClient()
  
  const { data: inventoryAssets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['assets'],
    queryFn: () => AssetRepository.getAll(),
  })

  const registerMutation = useMutation({
    mutationFn: (asset: InventoryAsset) => AssetRepository.save(asset),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['assets'] }), queryClient.invalidateQueries({ queryKey: ['consumable-receipts'] }), queryClient.invalidateQueries({ queryKey: ['consumable-movements'] })])
  })

  const updateMutation = useMutation({
    mutationFn: ({ tag, asset }: { tag: string, asset: InventoryAsset }) => AssetRepository.update(tag, asset),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['assets'] }), queryClient.invalidateQueries({ queryKey: ['consumable-receipts'] }), queryClient.invalidateQueries({ queryKey: ['consumable-movements'] })])
  })

  const registerAsset = async (asset: InventoryAsset) => {
    await registerMutation.mutateAsync(asset)
  }

  const updateAsset = async (originalTag: string, asset: InventoryAsset) => {
    await updateMutation.mutateAsync({ tag: originalTag, asset })
    return queryClient.getQueryData<InventoryAsset[]>(['assets'])?.find(row => row.tag === asset.tag)
  }

  if (isLoading) return <section className="workspace module-workspace"><div style={{ padding: '40px', color: '#666' }}>Loading inventory...</div></section>
  if (error && !inventoryAssets.length) return <section className="workspace module-workspace"><p role="alert">Shared inventory could not be loaded.</p><button type="button" onClick={() => void refetch()}>Retry</button></section>
  const page = {
    dashboard: <DashboardPage inventoryAssets={inventoryAssets} />,
    assets: <AssetsPage assetAction={assetAction} inventoryAssets={inventoryAssets} onRegister={registerAsset} onUpdate={updateAsset} />,
    consumables: <ConsumablesPage />,
    pms: <PmsPage inventoryAssets={inventoryAssets} />,
    assignments: <AssignmentsPage inventoryAssets={inventoryAssets} onAssign={async asset => { await updateAsset(asset.tag, asset) }} initialTarget={assignmentTarget} />,
    qr: <QrPage inventoryAssets={inventoryAssets} onUpdate={updateAsset} />,
    network: <NetworkPage inventoryAssets={inventoryAssets} />,
    maintenance: <MaintenancePage inventoryAssets={inventoryAssets} />,
    reports: <ReportsPage inventoryAssets={inventoryAssets} />,
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

function DashboardPage({ inventoryAssets }: { inventoryAssets: InventoryAsset[] }) {
  const total = inventoryAssets.length
  const active = inventoryAssets.filter(a => a.state === 'Active').length
  const maintenance = inventoryAssets.filter(a => a.state === 'Maintenance').length
  const broken = inventoryAssets.filter(a => a.state === 'Broken').length
  const needsAttention = maintenance + broken
  const activePercent = total > 0 ? Math.round((active / total) * 100) : 0
  const assigned = inventoryAssets.filter(isAssetAssigned).length

  const floorCounts: Record<string, number> = {}
  inventoryAssets.forEach(a => {
    const floorId = a.assignment?.floorId || floorIdFromLocation(a.location)
    if (floorId) floorCounts[floorId] = (floorCounts[floorId] || 0) + 1
  })
  const maxFloorCount = Math.max(...Object.values(floorCounts), 1)

  const recentAssets = inventoryAssets.slice(0, 4).map(a => [`${a.tag} — ${a.name}`, isAssetAssigned(a) ? `Assigned to ${a.location}` : 'Registered · awaiting assignment'])

  return <>
    <ModuleHeading eyebrow="OPERATIONS OVERVIEW" title="Good morning, Inventory Team" description="A clear view of hospital assets, service risks, and inventory activity for today." />
    <div className="metric-grid">
      <Metric label="Registered assets" value={String(total)} note={`${inventoryAssets.filter(a => !isAssetAssigned(a)).length} unassigned`} icon={registeredAssetsMetricIcon} />
      <Metric label="Active and ready" value={String(active)} note={`${activePercent}% of inventory`} tone="green" icon={activeReadyMetricIcon} />
      <Metric label="Needs attention" value={String(needsAttention)} note={`${maintenance} maintenance · ${broken} broken`} tone="maroon" icon={needsAttentionMetricIcon} />
      <Metric label="Assigned to rooms" value={String(assigned)} note={`${total - assigned} awaiting placement`} tone="amber" icon={roomsVerifiedMetricIcon} />
    </div>
    <div className="dashboard-grid">
      <article className="module-card asset-health"><CardTitle title="Asset health" subtitle="Current equipment condition" /><div className="health-layout"><div className="health-ring"><strong>{activePercent}%</strong><span>operational</span></div><div className="health-legend"><StatusLine label="Active" value={String(active)} color="green" /><StatusLine label="Maintenance" value={String(maintenance)} color="amber" /><StatusLine label="Broken" value={String(broken)} color="red" /></div></div></article>
      <article className="module-card floor-coverage"><CardTitle title="Assets by floor" subtitle="Distribution across hospital floors" />{Object.keys(floorCounts).length ? Object.entries(floorCounts).sort(([a],[b]) => a.localeCompare(b)).map(([floor, count]) => <div className="coverage-row" key={floor}><span>Floor {floor}</span><div><i style={{width:`${Math.round((count/maxFloorCount)*100)}%`}} /></div><b>{count}</b></div>) : <EquipmentEmptyState className="dashboard-empty" size="compact" kind="Monitor" title="No floor assignments yet" description="Assigned devices will appear here by floor." />}</article>
      <article className="module-card activity-card"><CardTitle title="Recent inventory" subtitle="Latest registered assets" />{recentAssets.length ? recentAssets.map(item => <div className="activity-row" key={item[0]}><i /><span><b>{item[0]}</b><small>{item[1]}</small></span></div>) : <EquipmentEmptyState className="dashboard-empty" size="compact" title="No recent inventory" description="Newly registered devices will appear here." />}</article>
      <article className="module-card attention-card"><span className="attention-label">PRIORITY</span><h3>{needsAttention > 0 ? `${needsAttention} device${needsAttention !== 1 ? 's need' : ' needs'} attention` : 'All devices are operational'}</h3><p>{needsAttention > 0 ? `${broken} broken and ${maintenance} under maintenance. Review equipment status and update records as needed.` : 'No broken or maintenance-flagged equipment at this time.'}</p></article>
    </div>
  </>
}

function AssetsPage({ inventoryAssets, onRegister, onUpdate, assetAction }: { assetAction?: AssetAction | null; inventoryAssets: InventoryAsset[]; onRegister: (asset: InventoryAsset) => Promise<void>; onUpdate: (originalTag: string, asset: InventoryAsset) => Promise<InventoryAsset | void> }) {
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const handledAction = useRef<number | null>(null)
  const [listView, setListView] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<'all' | DeviceCategory>('all')
  const [statusFilter, setStatusFilter] = useState<'recent' | 'active' | 'maintenance'>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null)
  const [editingAsset, setEditingAsset] = useState<InventoryAsset | null>(null)
  useEffect(() => {
    if (!assetAction || handledAction.current === assetAction.id) return
    handledAction.current = assetAction.id
    const record = inventoryAssets.find(asset => asset.tag === assetAction.tag) ?? null
    setEditingAsset(assetAction.edit ? record : null)
    setSelectedAsset(assetAction.edit ? null : record)
    setRegistrationOpen(!assetAction.tag)
  }, [assetAction, inventoryAssets])
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleAssets = inventoryAssets.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesStatus = statusFilter === 'recent' || (statusFilter === 'active' && item.state === 'Active') || (statusFilter === 'maintenance' && item.state === 'Maintenance')
    const searchable = [item.tag, item.qrId, item.name, item.category, item.brand, item.model, item.location, item.owner, item.ip, item.processor, item.state].filter(Boolean).join(' ').toLowerCase()
    return matchesCategory && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery))
  })
  const categoryViews: Array<{ key: 'all' | DeviceCategory; label: string; kind?: EquipmentKind; count: number }> = [
    { key: 'all', label: 'All assets', count: inventoryAssets.length },
    { key: 'System Unit', label: 'System Unit', kind: 'System Unit', count: inventoryAssets.filter(item => item.category === 'System Unit').length },
    { key: 'Monitor', label: 'Monitor', kind: 'Monitor', count: inventoryAssets.filter(item => item.category === 'Monitor').length },
    { key: 'UPS', label: 'UPS', kind: 'UPS', count: inventoryAssets.filter(item => item.category === 'UPS').length },
    { key: 'Printer', label: 'Printer', kind: 'Printer', count: inventoryAssets.filter(item => item.category === 'Printer').length },
    { key: 'Router', label: 'Router', kind: 'Router', count: inventoryAssets.filter(item => item.category === 'Router').length },
    { key: 'Keyboard', label: 'Keyboard', kind: 'Keyboard', count: inventoryAssets.filter(item => item.category === 'Keyboard').length },
    { key: 'Scanner', label: 'Scanner', kind: 'Scanner', count: inventoryAssets.filter(item => item.category === 'Scanner').length },
  ]

  const viewTitle = categoryViews.find(view => view.key === categoryFilter)?.label || 'All assets'

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

  const saveEditedAsset = async (originalTag: string, updatedAsset: InventoryAsset) => {
    const saved = await onUpdate(originalTag, updatedAsset)
    setSelectedAsset(saved || updatedAsset)
    setEditingAsset(null)
  }

  return <>
    <header className="asset-gallery-heading">
      <div><span className="eyebrow">ASSET REGISTRY · FOCUSED VIEW</span><h1>{viewTitle}</h1><p>A visual overview of every registered equipment category across the hospital.</p></div>
      <div className="asset-gallery-actions"><span className="asset-total-pill">{inventoryAssets.length} total assets</span><button className="export-btn" onClick={exportRegistry}>Export</button><button className="primary-action" onClick={() => setRegistrationOpen(true)}>＋ Add device</button></div>
    </header>
    <nav className="asset-category-grid" aria-label="Asset categories">
      {categoryViews.map(view => <button type="button" key={view.key} className={`asset-category-card ${categoryFilter === view.key ? 'selected' : ''}`} aria-pressed={categoryFilter === view.key} onClick={() => setCategoryFilter(view.key)}><span>{view.kind ? <EquipmentIcon kind={view.kind} /> : '▦'}</span><div><b>{view.label}</b><small>{view.count} {view.count === 1 ? 'device' : 'devices'}</small></div></button>)}
    </nav>
    <section className="module-card asset-gallery-toolbar" aria-label="Asset search and filters">
      <label className="search-field">⌕ <input aria-label="Search assets" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search all devices by asset tag, room, or model" /></label>
      <div className="filter-pills"><button className={statusFilter === 'recent' ? 'selected' : ''} onClick={() => setStatusFilter('recent')}>Recently updated</button><button className={statusFilter === 'active' ? 'selected' : ''} onClick={() => setStatusFilter('active')}>Active</button><button className={statusFilter === 'maintenance' ? 'selected' : ''} onClick={() => setStatusFilter('maintenance')}>Maintenance</button></div>
      <button className="export-btn asset-grid-mode" type="button" aria-label={listView ? "Switch to grid view" : "Switch to list view"} onClick={() => setListView(value => !value)}>{listView ? "Grid ▦" : "List ☷"}</button>
    </section>
    <AssetCardGrid listView={listView} inventoryAssets={visibleAssets} onSelect={setSelectedAsset} searchActive={Boolean(normalizedQuery || categoryFilter !== 'all' || statusFilter !== 'recent')} />
    {registrationOpen && <DeviceRegistrationDialog onClose={() => setRegistrationOpen(false)} onRegister={onRegister} />}
    {selectedAsset && <FullDeviceRecordDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} onEdit={() => { setEditingAsset(selectedAsset); setSelectedAsset(null) }} />}
    {editingAsset && <EditAssetDialog asset={editingAsset} onClose={() => setEditingAsset(null)} onSave={saveEditedAsset} />}
  </>
}

function AssetCardGrid({ inventoryAssets, onSelect, searchActive, listView = false }: { listView?: boolean; inventoryAssets: InventoryAsset[]; onSelect: (asset: InventoryAsset) => void; searchActive: boolean }) {
  if (!inventoryAssets.length) return <EquipmentEmptyState className="module-card asset-gallery-empty" title={searchActive ? 'No matching assets' : 'No assets registered'} description={searchActive ? 'Try another search term or change the selected filter.' : 'Add a device to begin building the hospital inventory.'} />

  return <div className={`asset-device-grid ${listView ? 'asset-list-view' : ''}`}>{inventoryAssets.map(item => <button type="button" className="asset-device-card" key={item.tag} onClick={() => onSelect(item)} aria-label={`Open full record for ${item.tag}`}>
    <div className="asset-device-visual"><DevicePreview asset={item} className="asset-card-preview" /><StatusBadge state={item.state} /></div>
    <div className="asset-device-copy"><span className="asset-device-category">{item.category}</span><h3>{item.tag}</h3><p>{item.name}</p><dl><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>Department</dt><dd>{item.owner}</dd></div></dl><footer><span className="mono">{item.ip === '—' ? 'No network' : item.ip}</span><b>View record →</b></footer></div>
  </button>)}</div>
}

function DevicePreview({ asset, className = '' }: { asset: InventoryAsset; className?: string }) {
  const previewImage = devicePreviewImages[asset.category]
  const categoryClass = `device-preview-${asset.category.toLowerCase().replaceAll(' ', '-')}`
  return <figure className={`device-preview ${categoryClass} ${className} ${previewImage ? '' : 'is-fallback'}`}>
    {previewImage ? <img src={previewImage} alt={`${asset.category} preview for ${asset.name}`} /> : <span aria-hidden="true">▣</span>}
  </figure>
}

type AssignmentLocation = { floor: string; roomId: string; room: string; department?: string; label?: string }
const assignmentLocationKey = (location: AssignmentLocation) => location.roomId

const deviceCategories: DeviceCategory[] = ['Printer', 'Monitor', 'Keyboard', 'System Unit', 'UPS', 'Scanner', 'Router']
const RECENT_PROCESSORS_KEY = 'liveinv-recent-processors'

function DeviceRegistrationDialog({ onClose, onRegister }: { onClose: () => void; onRegister: (asset: InventoryAsset) => Promise<void> }) {
  const dialogRef = useRef<HTMLElement>(null)
  const [step, setStep] = useState(1)
  useEffect(() => { if (dialogRef.current) dialogRef.current.scrollTop = 0 }, [step])
  const [saving, setSaving] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [saveError, setSaveError] = useState('')
  const [registeredAsset, setRegisteredAsset] = useState<InventoryAsset | null>(null)
  const [recentProcessors, setRecentProcessors] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(RECENT_PROCESSORS_KEY) || '[]') as string[] } catch { return [] }
  })

  const form = useForm<DeviceRegistrationData>({
    resolver: zodResolver(deviceRegistrationSchema),
    defaultValues: { tag: '', category: 'System Unit', brand: '', model: '', status: 'Active', ip: '', processor: '', ramCapacityGb: '0', ramModules: '0', ssdCapacityGb: '0', ssdCount: '0' },
    mode: 'onChange'
  })
  
  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = form
  const watchedCategory = watch('category')

  const submit = async (data: DeviceRegistrationData) => {
    if (step === 1 && !saving) {
      setSaveError('')
      const tag = data.tag.trim().toUpperCase()
      const supportsIp = data.category === 'System Unit' || data.category === 'Printer' || data.category === 'Router'
      const processor = data.processor?.trim()
      const asset: InventoryAsset = {
        ...stockChanges(data),
        tag,
        qrId: createQrId(),
        name: `${data.brand} ${data.model}`.trim(),
        category: data.category as DeviceCategory,
        location: 'Unassigned',
        owner: 'Unassigned',
        state: data.status as AssetState,
        ip: supportsIp && data.ip ? data.ip.trim() : '—',
        brand: data.brand.trim(),
        model: data.model.trim(),
        ...(data.category === 'System Unit' ? {
          processor,
          ramCapacityGb: Number(data.ramCapacityGb),
          ramModules: Number(data.ramModules),
          ssdCapacityGb: Number(data.ssdCapacityGb),
          ssdCount: Number(data.ssdCount),
        } : {}),
      }
      setSaving(true)
      const registration = Promise.all([
        QRCode.toDataURL(`liveinv:qr:${asset.qrId}`, { width: 320, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#1B6C24', light: '#FFFFFF' } }),
        new Promise(resolve => window.setTimeout(resolve, 800)),
      ]).then(async ([generatedQr]) => {
        await onRegister(asset)
        if (data.category === 'System Unit' && processor) {
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
        await toast.promise(registration, { loading: 'Saving device and generating QR…', success: savedAsset => `${savedAsset.tag} saved. QR code generated.`, error: 'Could not save the device or generate its QR code.' })
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Device could not be saved.')
      } finally {
        setSaving(false)
      }
    }
  }

  return <div className="device-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section ref={dialogRef} className="device-dialog" role="dialog" aria-modal="true" aria-labelledby="device-registration-title">
      <header className="device-dialog-header"><div><span>DEVICE REGISTRATION</span><h2 id="device-registration-title">Add a new device</h2><p>Record the equipment details now. Its hospital location can be assigned separately.</p></div><button type="button" aria-label="Close device registration" onClick={onClose} disabled={saving}>×</button></header>
      <div className="device-registration-steps" aria-label={`Registration step ${step} of 2`}>
        {['Device details', 'Generate QR'].map((label, index) => <div key={label} className={`${step === index + 1 ? 'current' : ''} ${step > index + 1 ? 'complete' : ''}`}><b>{step > index + 1 ? '✓' : index + 1}</b><span>{label}</span></div>)}
      </div>

      {step === 1 && <form className="device-form" onSubmit={handleSubmit(submit)}>
        <fieldset className="device-form-grid" disabled={saving}>
          <label>Asset tag<input {...register('tag')} placeholder="e.g. PC-MRR-015" />{errors.tag && <span className="field-error">{errors.tag.message}</span>}</label>
          <label>Device category<select {...register('category')}>{deviceCategories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Brand name<input {...register('brand')} placeholder="e.g. Dell, HP, APC" />{errors.brand && <span className="field-error">{errors.brand.message}</span>}</label>
          <label>Model<input {...register('model')} placeholder="e.g. OptiPlex 7090" />{errors.model && <span className="field-error">{errors.model.message}</span>}</label>
          <label>Status<select {...register('status')}><option>Active</option><option>Maintenance</option><option>Broken</option><option>Inactive</option></select></label>
          {watchedCategory === 'System Unit' && <>
            <div className="device-spec-heading wide"><span>SYSTEM UNIT SPECIFICATIONS</span><p>Record the installed memory and storage configuration.</p></div>
            <label className="wide">Processor <small>Type the complete processor model</small><input list="recent-processor-suggestions" {...register('processor')} placeholder="e.g. Intel Core i5-12400 or AMD Ryzen 5 5600G" /><datalist id="recent-processor-suggestions">{recentProcessors.map(processor => <option key={processor} value={processor} />)}</datalist>{errors.processor && <span className="field-error">{errors.processor.message}</span>}</label>
            <div className="processor-recent-suggestions wide"><span>RECENT PROCESSOR SUGGESTIONS</span>{recentProcessors.length ? <div>{recentProcessors.map(processor => <button type="button" key={processor} onClick={() => setValue('processor', processor, { shouldValidate: true })}>{processor}</button>)}</div> : <p>Recently entered processor specifications will appear here.</p>}</div>
          </>}
          <SystemUnitStockFields form={form} disabled={saving} />
          {(watchedCategory === 'System Unit' || watchedCategory === 'Printer' || watchedCategory === 'Router') && <label className="wide">IP address <small>Optional; can be assigned or updated later</small><input {...register('ip')} placeholder="10.20.x.x" />{errors.ip && <span className="field-error">{errors.ip.message}</span>}</label>}
        </fieldset>
        {saveError && <p className="consumable-save-error" role="alert">{saveError}</p>}

        <div className="registration-assignment-note"><AssignmentBadge assigned={false} /><p>The new device will enter the inventory as unassigned. Use the Assignments page when its floor, department, and room are known.</p></div>
        <footer className="device-form-actions"><button type="button" className="export-btn" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={!isValid || saving}>{saving ? 'Saving & generating QR…' : 'Save device & generate QR →'}</button></footer>
      </form>}

      {step === 2 && registeredAsset && <div className="device-qr-complete">
        <div className="generated-qr">{qrDataUrl ? <img src={qrDataUrl} alt={`QR code for ${registeredAsset.tag}`} /> : <span>Generating QR…</span>}</div>
        <div className="device-qr-summary"><span>DEVICE REGISTERED</span><h3>{registeredAsset.tag}</h3><p>{registeredAsset.name}</p><dl><div><dt>QR fallback ID</dt><dd className="mono">{registeredAsset.qrId}</dd></div><div><dt>Assignment</dt><dd><AssignmentBadge assigned={false} /></dd></div><div><dt>Device status</dt><dd>{registeredAsset.state}</dd></div></dl><div className="qr-security-note qr-fallback-note"><b>Manual identification ID</b><p>If the printed QR code cannot be scanned, enter <strong>{registeredAsset.qrId}</strong> in the QR Scanner to identify this device.</p></div><div className="qr-security-note"><b>Secure QR label</b><p>The code contains only <code>liveinv:qr:{registeredAsset.qrId}</code>. Device details remain inside the inventory system.</p></div></div>
        <footer className="device-qr-actions"><button type="button" className="export-btn" onClick={() => window.print()}>Print label</button>{qrDataUrl && <a className="primary-action" href={qrDataUrl} download={`${registeredAsset.tag}-qr.png`}>Download QR</a>}<button type="button" className="primary-action" onClick={onClose}>Done</button></footer>
      </div>}
    </section>
  </div>
}

function EditAssetDialog({ asset, onClose, onSave }: { asset: InventoryAsset; onClose: () => void; onSave: (originalTag: string, asset: InventoryAsset) => Promise<InventoryAsset | void> }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [recentProcessors, setRecentProcessors] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(RECENT_PROCESSORS_KEY) || '[]') as string[] } catch { return [] }
  })

  const form = useForm<DeviceRegistrationData>({
    resolver: zodResolver(deviceRegistrationSchema),
    defaultValues: {
      ramReceiptId: asset.ramReceiptId || '',
      ssdReceiptId: asset.ssdReceiptId || '',
      returnRamToStock: '',
      returnSsdToStock: '',
      tag: asset.tag,
      category: asset.category,
      brand: asset.brand || '',
      model: asset.model || '',
      status: asset.state,
      ip: asset.ip === '—' ? '' : asset.ip,
      processor: asset.processor || '',
      ramCapacityGb: asset.ramCapacityGb != null ? String(asset.ramCapacityGb) : '',
      ramModules: asset.ramModules != null ? String(asset.ramModules) : '',
      ssdCapacityGb: asset.ssdCapacityGb != null ? String(asset.ssdCapacityGb) : '',
      ssdCount: asset.ssdCount != null ? String(asset.ssdCount) : '',
    },
    mode: 'onChange'
  })

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = form
  const watchedCategory = watch('category')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const submit = async (data: DeviceRegistrationData) => {
    if (saving) return
    setSaving(true); setSaveError('')
    try {
      const processor = data.processor?.trim()
      const supportsIp = data.category === 'System Unit' || data.category === 'Printer' || data.category === 'Router'
      const updatedAsset: InventoryAsset = {
        ...asset,
        ...stockChanges(data, asset),
        name: `${data.brand.trim()} ${data.model.trim()}`,
        category: data.category as DeviceCategory,
        brand: data.brand.trim(),
        model: data.model.trim(),
        state: data.status as AssetState,
        ip: supportsIp && data.ip ? data.ip.trim() : '—',
        processor: data.category === 'System Unit' ? processor : undefined,
        ramCapacityGb: data.category === 'System Unit' ? Number(data.ramCapacityGb) : undefined,
        ramModules: data.category === 'System Unit' ? Number(data.ramModules) : undefined,
        ssdCapacityGb: data.category === 'System Unit' ? Number(data.ssdCapacityGb) : undefined,
        ssdCount: data.category === 'System Unit' ? Number(data.ssdCount) : undefined,
      }
      if (data.category === 'System Unit' && processor) {
        const next = [processor, ...recentProcessors.filter(item => item.toLowerCase() !== processor.toLowerCase())].slice(0, 8)
        window.localStorage.setItem(RECENT_PROCESSORS_KEY, JSON.stringify(next))
        setRecentProcessors(next)
      }
      await onSave(asset.tag, updatedAsset)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Asset and stock could not be saved. Please retry.')
    } finally { setSaving(false) }
  }

  return <div className="device-dialog-backdrop asset-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="device-dialog asset-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-edit-title">
      <header className="device-dialog-header"><div><span>EDIT DEVICE</span><h2 id="asset-edit-title">Update asset record</h2><p>Edit its description, status, and applicable technical specifications.</p></div><button type="button" aria-label="Close asset editor" onClick={onClose} disabled={saving}>×</button></header>
      <form className="device-form" onSubmit={handleSubmit(submit)}>
        <div className="asset-edit-identity"><div><span>Asset tag</span><b>{asset.tag}</b></div><div><span>QR fallback ID</span><b className="mono">{asset.qrId}</b></div></div>
        <fieldset className="device-form-grid" disabled={saving}>
          <input type="hidden" {...register('tag')} />
          <label>Device category<select {...register('category')}>{deviceCategories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Status<select {...register('status')}><option>Active</option><option>Maintenance</option><option>Broken</option><option>Inactive</option></select></label>
          <label>Brand name<input {...register('brand')} placeholder="e.g. Dell, HP, APC" />{errors.brand && <span className="field-error">{errors.brand.message}</span>}</label>
          <label>Model<input {...register('model')} placeholder="e.g. OptiPlex 7090" />{errors.model && <span className="field-error">{errors.model.message}</span>}</label>
          {watchedCategory === 'System Unit' && <>
            <div className="device-spec-heading wide"><span>SYSTEM UNIT SPECIFICATIONS</span><p>Update the installed processor, memory, and storage configuration.</p></div>
            <label className="wide">Processor <small>Type the complete processor model</small><input list="edit-processor-suggestions" {...register('processor')} placeholder="e.g. Intel Core i5-12400 or AMD Ryzen 5 5600G" /><datalist id="edit-processor-suggestions">{recentProcessors.map(processor => <option key={processor} value={processor} />)}</datalist>{errors.processor && <span className="field-error">{errors.processor.message}</span>}</label>
            <div className="processor-recent-suggestions wide"><span>RECENT PROCESSOR SUGGESTIONS</span>{recentProcessors.length ? <div>{recentProcessors.map(processor => <button type="button" key={processor} onClick={() => setValue('processor', processor, { shouldValidate: true })}>{processor}</button>)}</div> : <p>Recently entered processor specifications will appear here.</p>}</div>
          </>}
          <SystemUnitStockFields form={form} asset={asset} disabled={saving} />
          {(watchedCategory === 'System Unit' || watchedCategory === 'Printer' || watchedCategory === 'Router') && <label className="wide">IP address <small>Optional; leave blank if no address is assigned</small><input {...register('ip')} placeholder="10.20.x.x" />{errors.ip && <span className="field-error">{errors.ip.message}</span>}</label>}
        </fieldset>
        {saveError && <p className="consumable-save-error" role="alert">{saveError}</p>}
        <div className="asset-edit-assignment-note"><AssignmentBadge assigned={isAssetAssigned(asset)} /><p>Location and department are managed separately on the Assignments page, so editing this record will not move the device.</p></div>
        <footer className="device-form-actions"><button type="button" className="export-btn" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={!isValid || saving}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
      </form>
    </section>
  </div>
}

function AssignmentsPage({ inventoryAssets, onAssign, initialTarget }: { inventoryAssets: InventoryAsset[]; onAssign: (asset: InventoryAsset) => Promise<void>; initialTarget?: AssignmentTarget | null }) {
  const unassignedAssets = inventoryAssets.filter(item => !isAssetAssigned(item))
  const assignedAssets = inventoryAssets
    .filter(isAssetAssigned)
    .sort((left, right) => left.tag.localeCompare(right.tag, undefined, { numeric: true, sensitivity: 'base' }))
  const [selectedTag, setSelectedTag] = useState(unassignedAssets[0]?.tag || '')
  const [assignmentError, setAssignmentError] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [unassigningTag, setUnassigningTag] = useState('')
  const [confirmingUnassignTag, setConfirmingUnassignTag] = useState('')
  const [assignedFloorFilter, setAssignedFloorFilter] = useState('all')
  const [assignedCategoryFilter, setAssignedCategoryFilter] = useState('all')
  const [pendingTransferTag, setPendingTransferTag] = useState('')
  const roomLocations: AssignmentLocation[] = assignmentLocations
  const selectedAsset = unassignedAssets.find(item => item.tag === selectedTag) || unassignedAssets[0]

  const initialLocationKey = initialTarget ? assignmentLocationKey(initialTarget) : ''
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isValid } } = useForm<DeviceAssignmentData>({
    resolver: zodResolver(deviceAssignmentSchema),
    defaultValues: { floor: initialTarget?.floor ?? '', locationKey: initialLocationKey },
    mode: 'onChange'
  })

  const selectedFloor = watch('floor')
  const selectedLocationKey = watch('locationKey')
  const selectedLocation = roomLocations.find(location => assignmentLocationKey(location) === selectedLocationKey)
  const floorForAsset = (asset: InventoryAsset) => asset.assignment?.floorId || floorIdFromLocation(asset.location)
  const assignedFloorOptions = [...new Set(assignedAssets.map(floorForAsset).filter(Boolean))].sort((left, right) => Number(left) - Number(right))
  const assignedCategoryOptions = [...new Set(assignedAssets.map(asset => asset.category))].sort((left, right) => left.localeCompare(right))
  const filteredAssignedAssets = assignedAssets.filter(asset => (assignedFloorFilter === 'all' || floorForAsset(asset) === assignedFloorFilter) && (assignedCategoryFilter === 'all' || asset.category === assignedCategoryFilter))
  const activeAssignedFilters = Number(assignedFloorFilter !== 'all') + Number(assignedCategoryFilter !== 'all')
  const assetPendingUnassign = assignedAssets.find(asset => asset.tag === confirmingUnassignTag)
  const equipmentKind = (category: string): EquipmentKind => deviceCategories.includes(category as DeviceCategory) ? category as DeviceCategory : 'Other'

  useEffect(() => {
    if (initialTarget && assignmentLocations.some(room => room.roomId === initialTarget.roomId)) {
      setValue('floor', initialTarget.floor, { shouldValidate: true })
      setValue('locationKey', initialTarget.roomId, { shouldValidate: true })
    }
  }, [initialTarget, setValue])

  useEffect(() => {
    if (!unassignedAssets.some(item => item.tag === selectedTag)) setSelectedTag(unassignedAssets[0]?.tag || '')
  }, [inventoryAssets, selectedTag, unassignedAssets])

  useEffect(() => {
    if (!pendingTransferTag || !unassignedAssets.some(item => item.tag === pendingTransferTag)) return
    setSelectedTag(pendingTransferTag)
    setPendingTransferTag('')
  }, [pendingTransferTag, unassignedAssets])

  const assignDevice = async (data: DeviceAssignmentData) => {
    const location = roomLocations.find(item => item.floor === data.floor && assignmentLocationKey(item) === data.locationKey)
    if (!selectedAsset || !location) return
    const department = location.department ?? location.room
    setAssignmentError('')
    setIsAssigning(true)
    try {
      await toast.promise(onAssign(assignAsset(selectedAsset, {
        floorId: location.floor,
        roomId: location.roomId,
        roomName: location.room,
        departmentId: department,
        assignedBy: 'Admin',
        method: 'manual',
      })), {
        loadingTitle: 'Assigning device',
        loading: `Assigning ${selectedAsset.tag} to ${location.room}…`,
        successTitle: 'Device assigned',
        success: `${selectedAsset.tag} assigned to Floor ${location.floor}, ${location.room}.`,
        errorTitle: 'Assignment failed',
        error: `Could not assign ${selectedAsset.tag} to ${location.room}.`,
      })
      reset({ floor: data.floor, locationKey: data.locationKey })
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'The device could not be assigned. Please try again.')
    } finally {
      setIsAssigning(false)
    }
  }

  const unassignDevice = async (asset: InventoryAsset) => {
    setAssignmentError('')
    setUnassigningTag(asset.tag)
    try {
      await toast.promise(onAssign(unassignAsset(asset)), {
        loadingTitle: 'Unassigning device',
        loading: `Removing ${asset.tag} from ${asset.location}…`,
        successTitle: 'Device unassigned',
        success: `${asset.tag} is now unassigned and ready for transfer.`,
        errorTitle: 'Unassignment failed',
        error: `Could not unassign ${asset.tag}.`,
      })
      setPendingTransferTag(asset.tag)
      setConfirmingUnassignTag('')
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'The device could not be unassigned. Please try again.')
    } finally {
      setUnassigningTag('')
    }
  }

    return <>
    <ModuleHeading eyebrow="LOCATION CONTROL" title="Assign and transfer devices" description="Assign registered devices to a room, or unassign an existing device before moving it to a new location." />
    {assignmentError && <div className="assignment-page-feedback assignment-error" role="alert">{assignmentError}</div>}
    <div className="assignment-layout">
      <article className="module-card transfer-card">
        <div className="assignment-form-heading"><div><AssignmentBadge assigned={false} /><h3>Device assignment</h3><p>Only devices without a hospital location appear here.</p></div><strong>{unassignedAssets.length} waiting</strong></div>
        {selectedAsset ? <form onSubmit={handleSubmit(assignDevice)}>
          <label>Unassigned device<select value={selectedAsset.tag} onChange={event => { setSelectedTag(event.target.value); setAssignmentError('') }}>{unassignedAssets.map(item => <option key={item.tag} value={item.tag}>{item.tag} — {item.name}</option>)}</select></label>
          <div className="selected-asset assignment-selected"><span>{selectedAsset.category.slice(0, 2).toUpperCase()}</span><p><b>{selectedAsset.tag}</b><small>{selectedAsset.name} · QR ID {selectedAsset.qrId}</small></p><AssignmentBadge assigned={false} /></div>
          <div className="form-grid">
            <label className="wide">Floor<select {...register('floor')} onChange={event => { register('floor').onChange(event); setValue('locationKey', '', { shouldValidate: true }); setAssignmentError('') }}><option value="">Select a floor</option>{Array.from({ length: 7 }, (_, index) => String(index + 1)).map(floor => <option key={floor} value={floor}>Floor {floor}</option>)}</select>{errors.floor && <span className="field-error">{errors.floor.message}</span>}</label>
            {selectedFloor && <label className="wide">Room name or office<select {...register('locationKey')}><option value="">Select a room or office on Floor {selectedFloor}</option>{roomLocations.filter(location => location.floor === selectedFloor).map(location => <option key={assignmentLocationKey(location)} value={assignmentLocationKey(location)}>{location.label ?? location.room}</option>)}</select>{errors.locationKey && <span className="field-error">{errors.locationKey.message}</span>}</label>}
          </div>
          <div className="form-actions"><button type="button" className="export-btn" onClick={() => { reset({ floor: '', locationKey: '' }); setAssignmentError('') }}>Clear</button><button type="submit" className="primary-action" disabled={isAssigning || !isValid || !selectedLocation}>{isAssigning ? 'Assigning…' : 'Assign device →'}</button></div>
        </form> : <EquipmentEmptyState className="assignment-empty" title="All registered devices are assigned" description="Newly added devices will appear here automatically with an Unassigned label." />}
      </article>
      <article className="module-card move-summary unassigned-queue"><CardTitle title="Unassigned queue" subtitle="Devices ready for a confirmed location" />{unassignedAssets.length ? unassignedAssets.map((item, index) => <button type="button" className={item.tag === selectedAsset?.tag ? 'queue-device selected' : 'queue-device'} key={item.tag} onClick={() => setSelectedTag(item.tag)}><span>{index + 1}</span><div><b>{item.tag}</b><small>{item.name}</small></div><AssignmentBadge assigned={false} /></button>) : <EquipmentEmptyState className="queue-complete" size="compact" title="Assignment queue is clear" description="No devices are waiting for a room." />}</article>
    </div>
    <article className="module-card assigned-transfer-card">
      <div className="assigned-transfer-heading"><CardTitle title="Assigned devices" subtitle="Filter by floor or category, then remove a room assignment to prepare a transfer" /><strong>{activeAssignedFilters ? `${filteredAssignedAssets.length} of ${assignedAssets.length}` : assignedAssets.length} assigned</strong></div>
      {assignedAssets.length > 0 && <div className="assigned-transfer-filters">
        <label><span>Floor</span><select value={assignedFloorFilter} onChange={event => setAssignedFloorFilter(event.target.value)}><option value="all">All floors</option>{assignedFloorOptions.map(floor => <option key={floor} value={floor}>Floor {floor}</option>)}</select></label>
        <label><span>Device category</span><select value={assignedCategoryFilter} onChange={event => setAssignedCategoryFilter(event.target.value)}><option value="all">All categories</option>{assignedCategoryOptions.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        {activeAssignedFilters > 0 && <button type="button" onClick={() => { setAssignedFloorFilter('all'); setAssignedCategoryFilter('all') }}>Clear filters</button>}
      </div>}
      {filteredAssignedAssets.length ? <div className="assigned-transfer-list">{filteredAssignedAssets.map(item => {
        const isUnassigning = unassigningTag === item.tag
        return <div className="assigned-transfer-row" key={item.tag}>
          <span className="assigned-transfer-icon"><EquipmentIcon kind={equipmentKind(item.category)} /></span>
          <div className="assigned-transfer-device"><b>{item.tag}</b><small>{item.name}</small></div>
          <div className="assigned-transfer-location"><span>Current room</span><b>{item.location}</b><small>{item.owner}</small></div>
          <AssignmentBadge assigned />
          <button type="button" className="unassign-device-button" disabled={Boolean(unassigningTag)} onClick={() => { setConfirmingUnassignTag(item.tag); setAssignmentError('') }}>{isUnassigning ? 'Unassigning…' : 'Unassign'}</button>
        </div>
      })}</div> : <EquipmentEmptyState className="assigned-filter-empty" size="compact" kind={assignedCategoryFilter === 'all' ? 'System Unit' : equipmentKind(assignedCategoryFilter)} title={assignedAssets.length ? 'No assigned devices match these filters' : 'No assigned devices'} description={assignedAssets.length ? 'Try another floor or category, or clear the selected filters.' : 'Assigned devices will appear here with an option to prepare them for transfer.'} />}
    </article>
    <AlertDialog open={Boolean(assetPendingUnassign)} onOpenChange={open => { if (!open && !unassigningTag) setConfirmingUnassignTag('') }}>
      <AlertDialogContent className="unassign-alert-dialog">
        {assetPendingUnassign && <>
          <AlertDialogHeader>
            <span className="unassign-alert-icon" aria-hidden="true">✓</span>
            <AlertDialogTitle>Unassign {assetPendingUnassign.tag}?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the device from its current room. Its inventory record will stay intact, and it will return to the Unassigned queue ready for transfer.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="unassign-alert-summary"><span>Current assignment</span><b>{assetPendingUnassign.location}</b><small>{assetPendingUnassign.owner} · {assetPendingUnassign.category}</small></div>
          <AlertDialogFooter><AlertDialogCancel disabled={Boolean(unassigningTag)}>Cancel</AlertDialogCancel><AlertDialogAction disabled={Boolean(unassigningTag)} onClick={event => { event.preventDefault(); void unassignDevice(assetPendingUnassign) }}>{unassigningTag ? 'Processing…' : 'Confirm'}</AlertDialogAction></AlertDialogFooter>
        </>}
      </AlertDialogContent>
    </AlertDialog>
  </>
}

function QrPage({ inventoryAssets, onUpdate }: { inventoryAssets: InventoryAsset[]; onUpdate: (originalTag: string, asset: InventoryAsset) => Promise<InventoryAsset | void> }) {
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
        {scannedAsset ? <QrAssetDetails asset={scannedAsset} onClear={() => { setScannedAsset(null); setScanMessage('') }} onUpdate={async (originalTag, updatedAsset) => { const saved = await onUpdate(originalTag, updatedAsset); setScannedAsset(saved || updatedAsset); return saved }} /> : <><CardTitle title="Awaiting a QR scan" subtitle="The identified device record will appear here" /><EquipmentEmptyState className="qr-empty-state" size="compact" kind="Scanner" title="No device scanned yet" description="Start the camera, enter an asset tag, or choose one of the recent devices below." /></>}
        <div className="recent-scan-section"><CardTitle title="Recent devices" subtitle="Select one to preview the scan result" />{inventoryAssets.length ? inventoryAssets.slice(0,5).map(item => <button type="button" className="scan-row" key={item.tag} onClick={() => { setScannedAsset(item); setScanMessage(`Device ${item.tag} identified successfully.`) }}><span>▦</span><div><b>{item.tag}</b><small>{item.location}</small></div><StatusBadge state={item.state}/></button>) : <EquipmentEmptyState className="recent-devices-empty" size="inline" kind="Scanner" title="No recent devices" description="Register a device to make it available for scanning." />}</div>
        <div className="privacy-note"><b>Secure QR rule</b><p>Labels contain only an asset token—never passwords, IP addresses, or clinical information.</p></div>
      </article>
    </div>
  </>
}

function QrAssetDetails({ asset, onClear, onUpdate }: { asset: InventoryAsset; onClear: () => void; onUpdate: (originalTag: string, asset: InventoryAsset) => Promise<InventoryAsset | void> }) {
  const [fullRecordOpen, setFullRecordOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const assigned = isAssetAssigned(asset)
  const [floorCode, legacyRoomName = 'Not assigned'] = asset.location.split(' · ')
  const roomName = asset.assignment?.roomName || legacyRoomName
  const floorId = asset.assignment?.floorId || (/^F\d+$/i.test(floorCode) ? floorCode.slice(1) : '')
  const floorLabel = assigned && floorId ? `Floor ${floorId}` : 'Not assigned'
  return <div className="qr-asset-result">
    <header><div><span>DEVICE IDENTIFIED</span><h2>{asset.tag}</h2><p>{asset.name}</p></div><div className="qr-result-labels"><AssignmentBadge assigned={assigned} /><StatusBadge state={asset.state} /></div></header>
    <DevicePreview asset={asset} className="qr-device-preview" />
    <dl><div><dt>QR fallback ID</dt><dd className="mono">{asset.qrId}</dd></div><div><dt>Description</dt><dd>{asset.name}</dd></div><div><dt>Device category</dt><dd>{asset.category}</dd></div><div><dt>Brand</dt><dd>{asset.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{asset.model || asset.name}</dd></div><div><dt>Assignment</dt><dd>{assigned ? 'Assigned' : 'Unassigned'}</dd></div><div><dt>Floor</dt><dd>{floorLabel}</dd></div><div><dt>Room</dt><dd>{assigned ? roomName : 'Not assigned'}</dd></div><div><dt>Department</dt><dd>{assigned ? asset.owner : 'Not assigned'}</dd></div><div><dt>Status</dt><dd>{asset.state}</dd></div>{asset.category === 'System Unit' && <><div><dt>Processor</dt><dd>{asset.processor || 'Not recorded'}</dd></div><div><dt>RAM configuration</dt><dd>{asset.ramModules || 0} × {asset.ramCapacityGb || 0} GB</dd></div><div><dt>SSD configuration</dt><dd>{asset.ssdCount || 0} × {asset.ssdCapacityGb || 0} GB</dd></div></>}<div><dt>Network address</dt><dd className="mono">{asset.ip}</dd></div></dl>
    <div className="qr-result-actions"><button className="export-btn" onClick={onClear}>Scan another</button><button className="primary-action" onClick={() => setFullRecordOpen(true)}>Open full device record →</button></div>
    {fullRecordOpen && <FullDeviceRecordDialog asset={asset} onClose={() => setFullRecordOpen(false)} onEdit={() => { setFullRecordOpen(false); setEditing(true) }} />}
    {editing && <EditAssetDialog asset={asset} onClose={() => setEditing(false)} onSave={async (originalTag, updatedAsset) => { const saved = await onUpdate(originalTag, updatedAsset); setEditing(false); setFullRecordOpen(true); return saved }} />}
  </div>
}

export function FullDeviceRecordDialog({ asset, onClose, onEdit }: { asset: InventoryAsset; onClose: () => void; onEdit?: () => void }) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const assigned = isAssetAssigned(asset)
  const [floorCode, legacyRoomName = 'Not assigned'] = asset.location.split(' · ')
  const roomName = asset.assignment?.roomName || legacyRoomName
  const floorId = asset.assignment?.floorId || (/^F\d+$/i.test(floorCode) ? floorCode.slice(1) : '')
  const floorLabel = assigned && floorId ? `Floor ${floorId}` : 'Not assigned'
  const supportsNetwork = asset.category === 'System Unit' || asset.category === 'Printer' || asset.category === 'Router'

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return createPortal(<div className="device-record-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="device-record-dialog" role="dialog" aria-modal="true" aria-labelledby="device-record-title">
      <header className="device-record-header"><div><span>FULL DEVICE RECORD</span><h2 id="device-record-title">{asset.tag}</h2><p>{asset.name}</p></div><button type="button" aria-label="Close full device record" onClick={onClose}>×</button></header>
      <div className="device-record-status"><div><span>QR fallback ID</span><b className="mono">{asset.qrId}</b></div><div><span>Category</span><b>{asset.category}</b></div><div><span>Assignment</span><AssignmentBadge assigned={assigned} /></div><div><span>Status</span><StatusBadge state={asset.state} /></div></div>
      <div className="device-record-content">
        <AssetQrCode tag={asset.tag} qrId={asset.qrId} />
        <section className="device-record-preview-card"><DevicePreview asset={asset} className="device-record-preview" /><div><span>DEVICE PREVIEW</span><h3>{asset.category}</h3><p>{asset.brand || 'Brand not recorded'} · {asset.model || asset.name}</p><small>Visual reference for quick equipment identification.</small></div></section>
        <section><h3>Device identity</h3><dl><div><dt>Asset tag</dt><dd>{asset.tag}</dd></div><div><dt>QR identification ID</dt><dd className="mono">{asset.qrId}</dd></div><div><dt>Brand</dt><dd>{asset.brand || 'Not recorded'}</dd></div><div><dt>Model</dt><dd>{asset.model || asset.name}</dd></div></dl></section>
        <section><h3>Hospital assignment</h3><dl><div><dt>Assignment status</dt><dd>{assigned ? 'Assigned' : 'Unassigned'}</dd></div><div><dt>Floor</dt><dd>{floorLabel}</dd></div><div><dt>Room</dt><dd>{assigned ? roomName : 'Not assigned'}</dd></div><div><dt>Department</dt><dd>{assigned ? (asset.assignment?.departmentId || asset.owner) : 'Not assigned'}</dd></div>{asset.assignment && <><div><dt>Assigned by</dt><dd>{asset.assignment.assignedBy}</dd></div><div><dt>Assigned on</dt><dd>{new Date(asset.assignment.assignedAt).toLocaleString()}</dd></div><div><dt>Method</dt><dd>{asset.assignment.method === 'qr' ? 'QR scan' : 'Manual assignment'}</dd></div></>}</dl></section>
        {asset.category === 'System Unit' && <section><h3>System specifications</h3><dl><div><dt>Processor</dt><dd>{asset.processor || 'Not recorded'}</dd></div><div><dt>RAM modules</dt><dd>{asset.ramModules || 0}</dd></div><div><dt>RAM per module</dt><dd>{asset.ramCapacityGb || 0} GB</dd></div><div><dt>Total RAM</dt><dd>{(asset.ramModules || 0) * (asset.ramCapacityGb || 0)} GB</dd></div><div><dt>SSD drives</dt><dd>{asset.ssdCount || 0}</dd></div><div><dt>SSD per drive</dt><dd>{asset.ssdCapacityGb || 0} GB</dd></div><div><dt>Total SSD storage</dt><dd>{(asset.ssdCount || 0) * (asset.ssdCapacityGb || 0)} GB</dd></div></dl></section>}
        <section><h3>Network information</h3><dl><div><dt>Network capable</dt><dd>{supportsNetwork ? 'Yes' : 'No'}</dd></div><div><dt>IP address</dt><dd className="mono">{supportsNetwork ? asset.ip : 'Not applicable'}</dd></div></dl></section>
      </div>
      <footer className="device-record-actions"><button type="button" className="export-btn" onClick={onClose}>Close</button>{onEdit && <button type="button" className="primary-action" onClick={onEdit}>Edit device</button>}</footer>
    </section>
  </div>, document.body)
}

function NetworkPage({ inventoryAssets }: { inventoryAssets: InventoryAsset[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'maintenance'>('all')

  const networkAssets = inventoryAssets.filter(a => a.ip !== '—' && a.ip)
  const assignedCount = networkAssets.length
  const maintenanceCount = networkAssets.filter(a => a.state === 'Maintenance' || a.state === 'Broken').length

  const filtered = networkAssets.filter(a => {
    if (filter === 'active' && a.state !== 'Active') return false
    if (filter === 'maintenance' && a.state !== 'Maintenance' && a.state !== 'Broken') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return a.tag.toLowerCase().includes(q) || a.ip.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.location.toLowerCase().includes(q)
    }
    return true
  })

  return <>
    <ModuleHeading eyebrow="IT OPERATIONS" title="Network registry" description="Monitor address assignments and verification status for network-capable equipment." />
    <div className="network-summary"><article><span>Address pool</span><b>10.20.0.0/16</b><small>Hospital private network</small></article><article><span>Assigned addresses</span><b>{assignedCount}</b><div><i style={{width:`${Math.min(Math.round((assignedCount / Math.max(inventoryAssets.length, 1)) * 100), 100)}%`}} /></div><small>{assignedCount} network-capable devices</small></article><article><span>Needs review</span><b className={maintenanceCount > 0 ? 'danger' : ''}>{maintenanceCount}</b><small>{maintenanceCount > 0 ? 'Devices not in active state' : 'All network devices active'}</small></article></div>
    <article className="module-card registry-card"><div className="registry-toolbar"><label className="search-field">⌕ <input aria-label="Search network registry" placeholder="Search IP, hostname, MAC, or asset" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></label><div className="filter-pills"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All profiles</button><button className={filter === 'active' ? 'selected' : ''} onClick={() => setFilter('active')}>Active</button><button className={filter === 'maintenance' ? 'selected' : ''} onClick={() => setFilter('maintenance')}>Needs review</button></div></div><div className="data-table network-table"><div className="table-row table-head"><span>Asset / hostname</span><span>IPv4 address</span><span>Category</span><span>Location</span><span>Owner</span><span>Status</span></div>{filtered.length ? filtered.map(item => <div className="table-row" key={item.tag}><span className="asset-cell"><i>IP</i><span><b>{item.tag}</b><small>{item.name}</small></span></span><span className="mono">{item.ip}</span><span>{item.category}</span><span>{item.location}</span><span>{item.owner}</span><span><StatusBadge state={item.state}/></span></div>) : <EquipmentEmptyState className="registry-empty network-empty" size="compact" kind="Router" title="No network devices found" description="Try another search or change the selected status filter." />}</div></article>
  </>
}

function MaintenancePage({ inventoryAssets }: { inventoryAssets: InventoryAsset[] }) {
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null)
  const maintenanceAssets = inventoryAssets.filter(a => a.state === 'Maintenance')
  const brokenAssets = inventoryAssets.filter(a => a.state === 'Broken')
  const activeAssets = inventoryAssets.filter(a => a.state === 'Active')
  const totalIssues = maintenanceAssets.length + brokenAssets.length

  const tickets = [
    ...brokenAssets.map(a => [a.tag, a.tag, `${a.name} — requires diagnosis`, 'Critical', 'For diagnosis']),
    ...maintenanceAssets.map(a => [a.tag, a.tag, `${a.name} — scheduled service`, 'Medium', 'In progress']),
  ].slice(0, 8)

  return <><ModuleHeading eyebrow="SERVICE OPERATIONS" title="Maintenance queue" description="Prioritize repairs, preventive inspections, and equipment return-to-service." /><div className="metric-grid compact"><Metric label="Open work orders" value={String(totalIssues)} note={`${brokenAssets.length} critical`} /><Metric label="Critical" value={String(brokenAssets.length)} note="Immediate attention" tone="maroon" /><Metric label="Under maintenance" value={String(maintenanceAssets.length)} note="Scheduled service" tone="amber" /><Metric label="Active devices" value={String(activeAssets.length)} note={`${Math.round((activeAssets.length / Math.max(inventoryAssets.length, 1)) * 100)}% operational`} tone="green" /></div><div className="maintenance-layout"><article className="module-card work-orders"><CardTitle title="Active work orders" subtitle="Sorted by operational priority" /><div className="ticket-head"><span>Asset</span><span>Issue</span><span>Priority</span><span>Stage</span></div>{tickets.length ? tickets.map(ticket => <button className="ticket-row" key={ticket[0]} onClick={() => setSelectedAsset(inventoryAssets.find(asset => asset.tag === ticket[0]) ?? null)}><span><b>{ticket[0]}</b><small>{ticket[1]}</small></span><span>{ticket[2]}</span><span className={`priority ${ticket[3].toLowerCase()}`}>{ticket[3]}</span><span>{ticket[4]}</span></button>) : <EquipmentEmptyState className="maintenance-empty" size="compact" kind="System Unit" title="No maintenance needed" description="There are no open work orders right now." />}</article><article className="module-card maintenance-schedule"><CardTitle title="Equipment status" subtitle="Devices needing attention" />{[...brokenAssets, ...maintenanceAssets].slice(0, 4).map((item, index) => <div className="schedule-row" key={item.tag}><time><b>{item.state === 'Broken' ? '⚠' : '⚒'}</b></time><span><b>{item.tag} — {item.name}</b><small>{item.location} · {item.state}</small></span></div>)}{totalIssues === 0 && <EquipmentEmptyState className="maintenance-empty" size="compact" kind="UPS" title="All equipment is operational" description="No devices currently need attention." />}</article></div>{selectedAsset && <FullDeviceRecordDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}</>
}

function ReportsPage({ inventoryAssets }: { inventoryAssets: InventoryAsset[] }) {
  const floorCounts: number[] = [0, 0, 0, 0, 0, 0, 0]
  inventoryAssets.forEach(a => {
    const floorId = a.assignment?.floorId || floorIdFromLocation(a.location)
    if (floorId) floorCounts[parseInt(floorId) - 1] = (floorCounts[parseInt(floorId) - 1] || 0) + 1
  })
  const unassigned = inventoryAssets.filter(a => !isAssetAssigned(a)).length
  const maxBar = Math.max(...floorCounts, 1)

  const reportAssets: Record<string, InventoryAsset[]> = {
    'Inventory Master List': inventoryAssets,
    'Network Devices': inventoryAssets.filter(a => Boolean(a.ip?.trim()) && a.ip !== '—'),
    'Maintenance Report': inventoryAssets.filter(a => a.state === 'Maintenance' || a.state === 'Broken'),
    'Unassigned Devices': inventoryAssets.filter(a => !isAssetAssigned(a)),
  }
  const downloadCsv = (title: string) => {
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`
    const rows = [['Tag', 'Name', 'Category', 'Assignment status', 'Floor', 'Room', 'Department', 'Assigned at', 'Assigned by', 'Method', 'State', 'IP'].join(',')]
    reportAssets[title].forEach(a => {
      const assigned = isAssetAssigned(a)
      const [, legacyRoom = ''] = a.location.split(' · ')
      rows.push([
        a.tag, a.name, a.category, assigned ? 'Assigned' : 'Unassigned',
        assigned ? (a.assignment?.floorId || floorIdFromLocation(a.location)) : '',
        assigned ? (a.assignment?.roomName || legacyRoom) : '',
        assigned ? (a.assignment?.departmentId || a.owner) : '',
        a.assignment?.assignedAt || '', a.assignment?.assignedBy || '', a.assignment?.method || '', a.state, a.ip,
      ].map(value => csvCell(String(value))).join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <><ModuleHeading eyebrow="ANALYTICS" title="Reports and exports" description="Turn inventory records into operational summaries for IT and hospital management." /><div className="report-catalog"><ReportTile icon="▦" title="Inventory master list" onClick={() => downloadCsv('Inventory Master List')} note={`${inventoryAssets.length} assets total`} /><ReportTile icon="⌁" title="Network assignment" onClick={() => downloadCsv('Network Devices')} note={`${reportAssets['Network Devices'].length} network devices`} /><ReportTile icon="⚒" title="Maintenance status" onClick={() => downloadCsv('Maintenance Report')} note={`${inventoryAssets.filter(a => a.state === 'Maintenance' || a.state === 'Broken').length} needing attention`} /><ReportTile icon="⇄" title="Unassigned devices" onClick={() => downloadCsv('Unassigned Devices')} note={`${unassigned} awaiting placement`} /></div><div className="reports-layout"><article className="module-card"><CardTitle title="Assets by floor" subtitle="Current registered inventory" /><div className="bar-chart">{floorCounts.map((value, index) => <div key={index}><span style={{height:`${Math.round((value / maxBar) * 87)}px`}}/><b>F{index+1}</b><small>{value}</small></div>)}</div></article><article className="module-card exports-card"><CardTitle title="Export inventory data" subtitle="Download current records as CSV" />{Object.entries(reportAssets).map(([title, assets]) => [title, `${assets.length} devices`]).map(item => <button key={item[0]} onClick={() => downloadCsv(item[0])}><span>⇩</span><div><b>{item[0]}</b><small>{item[1]}</small></div><i>Download</i></button>)}</article></div></>
}

function UsersPage() {
  return <><ModuleHeading eyebrow="ACCESS CONTROL" title="Administrator" description="Administrator accounts are managed by the system administrator." /><article className="module-card"><CardTitle title="Administrator access" subtitle="Permissions for signed-in administrators" /><p>View inventory and topology, create and edit assets, assign devices, record maintenance, manage consumable stock, scan QR labels, and download reports.</p></article></>
}

const manualSteps = [
  { icon: '▦', title: 'Review the dashboard', text: 'Start on the Dashboard to check asset totals, equipment condition, verification coverage, and recent activity.' },
  { icon: '＋', title: 'Register a device', text: 'Open Assets, select Add device, enter its category, brand, model, status, and applicable technical specifications.' },
  { icon: '▧', title: 'Record received consumables', text: 'Receive RAM and SSD stock in pieces in Consumables, then select a stock source when adding or editing a system unit. Saving deducts the installed quantity. When removing parts, choose to return usable parts or keep them counted as used/discarded. Review stock balances and usage history in Consumables.' },
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

function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="card-title"><div><h3>{title}</h3><p>{subtitle}</p></div></div> }
function StatusLine({label,value,color}:{label:string;value:string;color:string}) { return <div><span><i className={color}/>{label}</span><b>{value}</b></div> }
function StatusBadge({state}:{state:AssetState}) { return <span className={`status-badge ${state.toLowerCase()}`}><i/>{state}</span> }
function AssignmentBadge({ assigned }: { assigned: boolean }) { return <span className={`assignment-badge ${assigned ? 'assigned' : 'unassigned'}`}><i />{assigned ? 'Assigned' : 'Unassigned'}</span> }
function ReportTile({icon,title,note,onClick}:{icon:string;title:string;note:string;onClick:()=>void}) { return <button type="button" className="report-tile" onClick={onClick} title={`Download ${title} CSV`}><span>{icon}</span><div><b>{title}</b><small>{note}</small></div><i>→</i></button> }
