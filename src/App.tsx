import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AssetRepository } from './lib/repositories'
import { type AssetState, type DeviceCategory, type InventoryAsset } from './lib/types'
import { resolveAssetRoom, assignAsset, floorIdFromLocation, isAssetAssigned, unassignAsset } from './lib/assignments'
import { AssetQrCode } from './components/ui/asset-qr-code'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './components/ui/alert-dialog'
import { hospitalFloors, hospitalRooms } from './lib/rooms'
import liveInvLogo from './assets/liveinv-logo.png'
import dashboardIcon from './assets/sidebar/dashboard.png'
import liveMappingIcon from './assets/sidebar/live-mapping.png'
import assetsIcon from './assets/sidebar/assets.png'
import assignmentsIcon from './assets/sidebar/assignments.png'
import qrScannerIcon from './assets/sidebar/qr-scanner.png'
import reportsIcon from './assets/sidebar/reports.png'
import { EquipmentEmptyState, EquipmentIcon } from './components/ui/equipment-empty-state'
import { HospitalBuilding3D } from './components/ui/hospital-building-3d'
import { Toaster } from './components/ui/toast'
import { PmsIcon } from './pages/PmsPage'
import { FullDeviceRecordDialog, SystemModulePage, type AssignmentTarget, type SystemModule } from './pages/SystemPages'

type Status = AssetState
type AssetKind = DeviceCategory | 'Other'
type Asset = { id: string; qrId: string; name: string; kind: AssetKind; status: Status; detail: string; owner: string; ip?: string }
type Room = { shapeId: string; legacyIds: string[]; id: string; floor: number; name: string; code: string; department: string; assets: Asset[]; x: number; y: number; w: number; h: number }
type Floor = { id: number; label: string; assets: number }

const floors = hospitalFloors.map(floor => ({ ...floor, assets: 0 }))
const roomsByFloor: Record<number, Room[]> = Object.fromEntries(floors.map(floor => [floor.id,
  hospitalRooms.filter(room => room.floor === floor.id).map(room => ({ ...room, assets: [], x: 0, y: 0, w: 0, h: 0 })),
]))
const floorRoomCounts = Object.fromEntries(floors.map(floor => [floor.id, roomsByFloor[floor.id].length]))

const floorMapAspectRatios: Record<number, string> = {
  1: '3615 / 3247',
  2: '3547 / 3247',
  3: '3547 / 3247',
  4: '3547 / 3247',
  5: '3547 / 3247',
  6: '3547 / 3247',
  7: '3547 / 3247',
}

const Icon = ({ name, src }: { name?: string; src?: string }) => (
  <span className="icon" aria-hidden="true">
    {src ? <span className="sidebar-icon-mask" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} /> : name}
  </span>
)
const equipmentKinds: AssetKind[] = ['System Unit', 'Printer', 'Monitor', 'Keyboard', 'UPS', 'Scanner', 'Router', 'Other']
const equipmentLabels: Record<AssetKind, string> = { 'System Unit': 'System Units', Printer: 'Printers', Monitor: 'Monitors', Keyboard: 'Keyboards', UPS: 'UPS', Scanner: 'Scanners', Router: 'Routers', Other: 'Other devices' }
const assetKind = (category: string): AssetKind => equipmentKinds.includes(category as AssetKind) ? category as AssetKind : 'Other'
const equipmentKindClass = (kind: AssetKind) => kind.toLowerCase().replaceAll(' ', '-')
const assetTagCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const statusClass = (status: Status) => status.toLowerCase()
const computerCount = (roomItem: Room) => roomItem.assets.filter(assetItem => assetItem.kind === 'System Unit').length

export function App({ adminEmail, onSignOut }: { adminEmail?: string; onSignOut: () => Promise<void> }) {
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [module, setModule] = useState<SystemModule | 'topology'>('dashboard')
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null)
  const [floor, setFloor] = useState<number | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const { data: inventoryAssets = [], error: inventoryError, isLoading: inventoryLoading, refetch: refetchInventoryAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: () => AssetRepository.getAll(),
  })
  const unsyncedAssetTags = AssetRepository.getUnsyncedAssetTags()

  const availableAssets = useMemo(
    () => inventoryAssets.filter(item => !isAssetAssigned(item)),
    [inventoryAssets],
  )

  useEffect(() => AssetRepository.subscribe(() => {
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
  }), [queryClient])

  const dynamicRoomsByFloor = useMemo(() => {
    const map: Record<number, Room[]> = {}
    for (const [floorId, rList] of Object.entries(roomsByFloor)) {
      map[Number(floorId)] = rList.map(r => {
        const assignedAssets = inventoryAssets.filter(a => resolveAssetRoom(a, rList)?.id === r.id)
        const assets: Asset[] = assignedAssets.map(a => {
          const kind = assetKind(a.category)
          return {
            id: a.tag,
            qrId: a.qrId,
            name: a.name,
            owner: a.assignment?.departmentId || a.owner,
            status: a.state as Status,
            kind,
            detail: `${a.brand ?? ''} ${a.model ?? ''}`.trim() || a.name,
            ip: a.ip === '—' ? undefined : a.ip
          }
        })
        return { ...r, assets }
      })
    }
    return map
  }, [inventoryAssets])

  const dynamicAllRooms = useMemo(() => Object.values(dynamicRoomsByFloor).flat(), [dynamicRoomsByFloor])

  const room = dynamicAllRooms.find(r => r.id === roomId)
  const asset = room?.assets.find(a => a.id === assetId)
  const selectedFloor = floor ? floors.find(item => item.id === floor) : null
  const currentAssets = useMemo(() => dynamicAllRooms.flatMap(item => item.assets), [dynamicAllRooms])

  const total = inventoryAssets.length
  const active = inventoryAssets.filter(a => a.state === 'Active').length
  const maintenance = inventoryAssets.filter(a => a.state === 'Maintenance').length
  const broken = inventoryAssets.filter(a => a.state === 'Broken').length
  const recentAssets = inventoryAssets.slice(0, 3)
  const liveFloors = useMemo(() => floors.map(floorItem => {
    const floorAssets = inventoryAssets.filter(item => (item.assignment?.floorId || floorIdFromLocation(item.location)) === String(floorItem.id))
    return {
      ...floorItem,
      assets: floorAssets.length,
      activeAssets: floorAssets.filter(item => item.state === 'Active').length,
      maintenanceAssets: floorAssets.filter(item => item.state === 'Maintenance').length,
      brokenAssets: floorAssets.filter(item => item.state === 'Broken').length,
      inactiveAssets: floorAssets.filter(item => item.state === 'Inactive').length,
    }
  }), [inventoryAssets])

  const resetToFloors = () => { setFloor(null); setRoomId(null); setAssetId(null) }
  const openModule = (next: SystemModule | 'topology') => { if (next !== 'assignments') setAssignmentTarget(null); setModule(next); resetToFloors(); window.scrollTo({ top: 0, behavior: 'auto' }) }
  const openRoomAssignment = (targetFloor: number, targetRoom: Room) => {
    setAssignmentTarget({ floor: String(targetFloor), roomId: targetRoom.id, room: targetRoom.name, department: targetRoom.department })
    setModule('assignments')
    resetToFloors()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  const assignAvailableAssetToRoom = async (availableAsset: InventoryAsset, targetRoom: Room) => {
    await AssetRepository.update(availableAsset.tag, assignAsset(availableAsset, {
      floorId: String(targetRoom.floor),
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      departmentId: isAssetAssigned(availableAsset) ? (availableAsset.assignment?.departmentId || availableAsset.owner) : targetRoom.department,
      assignedBy: 'Admin',
      method: 'manual',
    }))
    await refetchInventoryAssets()
  }

  const unassignRoomAsset = async (tag: string, targetRoom: Room) => {
    const record = inventoryAssets.find(item => item.tag === tag)
    if (!record || resolveAssetRoom(record, dynamicAllRooms)?.id !== targetRoom.id) {
      throw new Error('This device is no longer assigned to this room. Refresh the inventory and try again.')
    }
    const updated = unassignAsset(record)
    await AssetRepository.update(tag, updated)
    await queryClient.cancelQueries({ queryKey: ['assets'] })
    queryClient.setQueryData<InventoryAsset[]>(['assets'], current => current?.map(item => item.tag === tag ? updated : item))
    await queryClient.invalidateQueries({ queryKey: ['assets'] })
  }

  return <div className={`app-shell module-${module} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
    <LiveInvSidebar module={module} expanded={sidebarOpen} onToggle={() => setSidebarOpen(open => !open)} onNavigate={openModule} totalAssets={total} adminEmail={adminEmail} onSignOut={onSignOut} />
    <main>
      {inventoryError && <div className="unresolved-locations" role="alert">Shared inventory could not be refreshed. {inventoryAssets.length ? 'The last loaded records are shown.' : 'Asset counts are unavailable.'} <button type="button" onClick={() => void refetchInventoryAssets()}>Retry inventory</button></div>}
      {inventoryLoading && <p role="status">Loading shared inventory…</p>}
      {unsyncedAssetTags.length > 0 && <div className="unresolved-locations" role="alert">Earlier browser-only edits were not saved to the shared inventory: {unsyncedAssetTags.join(', ')}. Shared records are shown here; review and save these records again to apply your edits.</div>}
      <header className="topbar"><div className="crumbs">{module === 'topology' ? <><button onClick={resetToFloors}>Live Mapping</button>{selectedFloor && <><span>/</span><button onClick={() => { setRoomId(null); setAssetId(null) }}>Floor {floor}</button></>}{room && <><span>/</span><button onClick={() => setAssetId(null)}>{room.name}</button></>}{asset && <><span>/</span><b>{asset.id}</b></>}</> : <><span>Hospital Inventory</span><span>/</span><b>{module === 'pms' ? 'PMS' : module === 'qr' ? 'QR Scanner' : module === 'network' ? 'Network Registry' : module === 'manual' ? 'System Manual' : module.charAt(0).toUpperCase() + module.slice(1)}</b></>}</div><div className="top-actions"><button className="ghost-btn">⌕ Search</button><button className="bell">◌</button><span className="avatar">AD</span></div></header>
      {module !== 'topology' && <SystemModulePage module={module} assignmentTarget={assignmentTarget} />}
      {module === 'topology' && !floor && <FloorTopology floors={liveFloors} onSelect={setFloor} />}
      {module === 'topology' && floor && !room && <FloorView floor={selectedFloor!} onBack={resetToFloors} rooms={dynamicRoomsByFloor[floor] ?? []} inventoryAssets={inventoryAssets} availableAssets={availableAssets} onAssignAvailableAsset={assignAvailableAssetToRoom} onUnassignAsset={unassignRoomAsset} />}
      {module === 'topology' && floor && room && !asset && <RoomView room={room} floor={floor} onBack={() => setRoomId(null)} onAsset={setAssetId} onAssignEquipment={() => openRoomAssignment(floor, room)} />}
      {module === 'topology' && floor && room && asset && <AssetView room={room} floor={floor} asset={asset} onBack={() => setAssetId(null)} />}
    </main>
    <aside className="insights-panel"><h3>Live status</h3><p className="muted">Hospital inventory at a glance</p><div className="stat"><span>Total assets</span><b>{total}</b><small>Across 7 floors</small></div><div className="status-list"><StatusRow color="green" label="Active" value={String(active)} /><StatusRow color="amber" label="Maintenance" value={String(maintenance)} /><StatusRow color="red" label="Broken" value={String(broken)} /><StatusRow color="gray" label="Inactive" value={String(inventoryAssets.filter(asset => asset.state === 'Inactive').length)} /></div><div className="divider"/><h4>Quick actions</h4><button className="quick primary" onClick={() => openModule('assets')}>＋ Add new asset</button><button className="quick" onClick={() => openModule('qr')}>▣ Scan QR code</button><button className="quick" onClick={() => openModule('assignments')}>⇄ Assign an item</button><div className="recent"><h4>Recently added</h4>{recentAssets.map(item => <button key={item.tag} onClick={() => openModule('assets')}><span className={`dot ${item.state.toLowerCase()}`} />{item.tag}<small>{item.category}</small></button>)}</div></aside>
    <Toaster />
  </div>
}

function LiveInvSidebar({ module, expanded, onToggle, onNavigate, totalAssets = 0, adminEmail, onSignOut }: {
  module: SystemModule | 'topology'
  expanded: boolean
  onToggle: () => void
  onNavigate: (module: SystemModule | 'topology') => void
  totalAssets?: number
  adminEmail?: string
  onSignOut: () => Promise<void>
}) {
  const activeNavIndex = ['dashboard', 'topology', 'assets', 'consumables', 'assignments', 'pms', 'qr', 'reports', 'manual'].indexOf(module)

  const navigate = (next: SystemModule | 'topology') => {
    onNavigate(next)
  }

  return <aside className="sidebar liveinv-sidebar">
    <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={expanded ? 'Collapse sidebar' : 'Open sidebar'} aria-expanded={expanded}>{expanded ? '‹' : '›'}</button>
    <header className="liveinv-sidebar-header">
      <div className="brand" aria-label="LiveINV">
        <img className="brand-logo" src={liveInvLogo} alt="LiveINV" />
        <span className="brand-wordmark" aria-hidden="true"><span className="brand-live">live</span><span className="brand-inv">INV</span></span>
      </div>
    </header>
    <div className="liveinv-sidebar-body">
      <span className="sidebar-section-label">WORKSPACE</span>
      <nav aria-label="Primary navigation" style={{ '--active-nav-index': activeNavIndex } as CSSProperties}>
        <button className={`nav-item ${module === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}><Icon src={dashboardIcon} /><span className="sidebar-item-label">Dashboard</span></button>
        <button className={`nav-item ${module === 'topology' ? 'active' : ''}`} onClick={() => navigate('topology')}><Icon src={liveMappingIcon} /><span className="sidebar-item-label">Live Mapping</span></button>
        <button className={`nav-item ${module === 'assets' ? 'active' : ''}`} onClick={() => navigate('assets')}><Icon src={assetsIcon} /><span className="sidebar-item-label">Assets</span>{totalAssets > 0 && <span className="nav-count">{totalAssets}</span>}</button>
        <button className={`nav-item ${module === 'consumables' ? 'active' : ''}`} onClick={() => navigate('consumables')}><Icon name="▧" /><span className="sidebar-item-label">Consumables</span></button>
        <button className={`nav-item ${module === 'assignments' ? 'active' : ''}`} onClick={() => navigate('assignments')}><Icon src={assignmentsIcon} /><span className="sidebar-item-label">Assignments</span></button>
        <button className={`nav-item ${module === 'pms' ? 'active' : ''}`} title="Preventive Maintenance Service" onClick={() => navigate('pms')}><span className="icon"><PmsIcon /></span><span className="sidebar-item-label">PMS</span></button>
        <button className={`nav-item ${module === 'qr' ? 'active' : ''}`} onClick={() => navigate('qr')}><Icon src={qrScannerIcon} /><span className="sidebar-item-label">QR Scanner</span></button>
        <button className={`nav-item ${module === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}><Icon src={reportsIcon} /><span className="sidebar-item-label">Reports</span></button>
        <button className={`nav-item ${module === 'manual' ? 'active' : ''}`} onClick={() => navigate('manual')}><Icon name="?" /><span className="sidebar-item-label">Manual</span></button>
      </nav>
      <div className="sidebar-spacer" />
    </div>
    <footer className="liveinv-sidebar-footer">
      <div className="sidebar-profile-button sidebar-admin-profile" aria-label="Current user: Admin"><span className="avatar">AD</span><span className="sidebar-profile-copy"><b>Admin</b><small>Administrator</small></span></div>
      <button type="button" className="admin-sign-out" title={adminEmail ? `Sign out ${adminEmail}` : 'Sign out'} onClick={() => void onSignOut()}>Sign out</button>
    </footer>
  </aside>
}

function StatusRow({ color, label, value }: { color: string; label: string; value: string }) { return <div className="status-row"><span><i className={color}/>{label}</span><b>{value}</b></div> }

function FloorTopology({ floors, onSelect }: { floors: Floor[]; onSelect:(id:number)=>void }) {
  const modelFloors = floors.map(floorItem => ({ ...floorItem, rooms: floorRoomCounts[floorItem.id] ?? 0 }))
  return <section className="workspace topology-workspace hospital-topology-workspace" aria-label={`${floors.length} hospital floors available`}><div className="section-heading"><span className="eyebrow">VISUAL INVENTORY</span><h1>Hospital topology</h1><p>Rotate the 3D hospital, inspect each floor, and explore its rooms and assigned inventory.</p></div><HospitalBuilding3D floors={modelFloors} onExplore={onSelect} /></section>
}

function FloorView({ floor, onBack, rooms, inventoryAssets, availableAssets, onAssignAvailableAsset, onUnassignAsset }: { floor:Floor;onBack:()=>void;rooms:Room[];inventoryAssets:InventoryAsset[];availableAssets:InventoryAsset[];onAssignAvailableAsset:(asset:InventoryAsset,room:Room)=>Promise<void>;onUnassignAsset:(tag:string,room:Room)=>Promise<void> }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const dragMoved = useRef(false)
  const pressedMapRoomId = useRef<string | null>(null)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [hoverCardPosition, setHoverCardPosition] = useState<{ x: number; y: number } | null>(null)
  const [openedRoomId, setOpenedRoomId] = useState<string | null>(null)
  const hoverOpenTimer = useRef<number | null>(null)
  const hoverCloseTimer = useRef<number | null>(null)
  const pendingHoverRoom = useRef<string | null>(null)
  const visibleHoverRoom = useRef<string | null>(null)
  const namedRooms = rooms
  const unresolvedAssets = inventoryAssets.filter(asset =>
    (asset.assignment?.floorId || floorIdFromLocation(asset.location)) === String(floor.id)
    && !resolveAssetRoom(asset, rooms))
  const openedRoom = namedRooms.find(item => item.id === openedRoomId)
  const hoveredRoomDetails = namedRooms.find(item => item.id === hoveredRoom)
  const hoveredRoomSubtitle = hoveredRoomDetails
    ? [hoveredRoomDetails.name, hoveredRoomDetails.code, hoveredRoomDetails.department]
      .map(value => value.trim().replace(/\s+/g, ' '))
      .filter((value, index, values) => value && values.findIndex(other => other.toLowerCase() === value.toLowerCase()) === index)
      .slice(1)
      .join(' · ')
    : ''
  const selectedRoom = namedRooms.find(item => item.id === hoveredRoom) ?? openedRoom


  useEffect(() => () => {
    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
  }, [])

  const handleMapHover = (roomId: string | null, point?: { x: number; y: number }) => {
    if (roomId && point) {
      if (hoverCloseTimer.current) {
        window.clearTimeout(hoverCloseTimer.current)
        hoverCloseTimer.current = null
      }
      setHoverCardPosition({
        x: Math.max(12, Math.min(point.x + 16, window.innerWidth - 300)),
        y: Math.max(12, Math.min(point.y + 16, window.innerHeight - 270)),
      })
      if (visibleHoverRoom.current === roomId || pendingHoverRoom.current === roomId) return
      if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
      pendingHoverRoom.current = roomId
      hoverOpenTimer.current = window.setTimeout(() => {
        hoverOpenTimer.current = null
        visibleHoverRoom.current = roomId
        pendingHoverRoom.current = null
        setHoveredRoom(roomId)
      }, 100)
      return
    }

    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    hoverOpenTimer.current = null
    pendingHoverRoom.current = null
    if (hoverCloseTimer.current) return
    hoverCloseTimer.current = window.setTimeout(() => {
      hoverCloseTimer.current = null
      visibleHoverRoom.current = null
      setHoveredRoom(null)
      setHoverCardPosition(null)
    }, 100)
  }

  const openRoomDetails = (roomId: string) => {
    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
    hoverOpenTimer.current = null
    hoverCloseTimer.current = null
    pendingHoverRoom.current = null
    visibleHoverRoom.current = null
    setHoveredRoom(null)
    setHoverCardPosition(null)
    setOpenedRoomId(roomId)
  }

  return <section className="workspace floor-workspace">
    {unresolvedAssets.length > 0 && <section className="unresolved-locations" aria-label="Assets needing a room">
      <h3>{unresolvedAssets.length} asset{unresolvedAssets.length === 1 ? '' : 's'} on Floor {floor.id} need an exact room</h3>
      <p>These assets count toward this floor. Their recorded location does not identify a unique room on the map. Choose the correct room to place each device.</p>
      {unresolvedAssets.map(asset => <ResolveRoomAssignment key={asset.tag} asset={asset} rooms={rooms} onAssign={onAssignAvailableAsset} />)}
    </section>}
    <div className={`floor-map-layout ${directoryOpen ? '' : 'directory-collapsed'}`}>
      <div className="map-card floor-map-card">
        <div className="map-toolbar">
          <div className="map-toolbar-leading"><button type="button" className="map-toolbar-back" onClick={onBack}>← All floors</button><div><b>{floor.label}</b><span>Floor {floor.id} · {rooms.length} mapped rooms</span></div></div>
          <div className="map-toolbar-actions">
            <button
              type="button"
              className={`directory-toggle ${directoryOpen ? 'is-open' : ''}`}
              aria-controls={`floor-${floor.id}-room-directory`}
              aria-expanded={directoryOpen}
              onClick={() => setDirectoryOpen(open => !open)}
            ><span aria-hidden="true">☷</span>{directoryOpen ? 'Hide directory' : 'Show directory'}</button>
            <div className="zoom-controls"><button onClick={() => setZoom(value => Math.max(.2, value - .2))} aria-label="Zoom out">−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button><button onClick={() => setZoom(value => Math.min(4, value + .2))} aria-label="Zoom in">＋</button></div>
          </div>
        </div>
        <div 
          className="map-viewport"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', overflow: 'hidden' }}
          onPointerDown={e => {
            if (e.button !== 0 && e.button !== 1) return
            pressedMapRoomId.current = e.target instanceof Element
              ? e.target.closest('.svg-room-node, .svg-room-hit-target')?.getAttribute('data-room-id') ?? null
              : null
            setIsDragging(true)
            dragMoved.current = false
            dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={e => {
            if (!isDragging) return
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true
            setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
          }}
          onPointerUp={e => {
            setIsDragging(false)
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
            if (e.button === 0 && !dragMoved.current && pressedMapRoomId.current) openRoomDetails(pressedMapRoomId.current)
            pressedMapRoomId.current = null
          }}
          onPointerCancel={e => {
            setIsDragging(false)
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
            pressedMapRoomId.current = null
          }}
          onWheel={e => {
            if (e.ctrlKey || e.metaKey) {
              setZoom(z => Math.max(0.2, Math.min(4, z - e.deltaY * 0.005)))
            } else {
              setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
            }
          }}
        >
          <div className="map-canvas figma-floor-map" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, aspectRatio: floorMapAspectRatios[floor.id] }} role="img" aria-label={`Interactive room layout for Floor ${floor.id}`}>
            <InteractiveFloorSvg floor={floor} rooms={namedRooms} activeRoomId={hoveredRoom ?? openedRoomId} onSelect={openRoomDetails} onHover={handleMapHover} />
          </div>
        </div>
        <div className="map-status"><span className="map-status-key"><i className="mapped"/>Mapped room</span><span className="map-status-key"><i className="device"/>Device assigned</span><span>Click a room to enter</span>{selectedRoom && <strong>{selectedRoom.name} · {selectedRoom.assets.length} assets</strong>}</div>
      </div>
      <aside id={`floor-${floor.id}-room-directory`} className="floor-room-directory" hidden={!directoryOpen}>
        <div className="directory-heading"><span className="eyebrow">ROOM DIRECTORY</span><h3>Floor {floor.id} spaces</h3><p>Select a room to inspect its inventory.</p></div>
        <div className="directory-list">{namedRooms.map((item, index) => {
          const pcs = computerCount(item)
          return <button key={item.id} className={`${item.assets.length ? 'has-device' : ''} ${item.id === openedRoomId ? 'is-open' : ''}`} onMouseEnter={() => setHoveredRoom(item.id)} onMouseLeave={() => setHoveredRoom(null)} onFocus={() => setHoveredRoom(item.id)} onBlur={() => setHoveredRoom(null)} onClick={() => openRoomDetails(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><span><b>{item.name}</b><small>{item.department}</small></span>{pcs > 0 && <span className="directory-pc" aria-label={`${pcs} computer${pcs === 1 ? '' : 's'}`}><i />{pcs}</span>}<em>{item.assets.length}</em></button>
        })}</div>
      </aside>
    </div>
    {hoveredRoomDetails && hoverCardPosition && <div className="room-hover-card" style={{ left: hoverCardPosition.x, top: hoverCardPosition.y }} role="status" aria-live="polite">
      <div className="room-hover-card-heading"><span>ROOM QUICK VIEW</span>{hoveredRoomDetails.assets.length > 0 && <b>{hoveredRoomDetails.assets.length} assigned</b>}</div>
      <h3>{hoveredRoomDetails.name}</h3>
      {hoveredRoomSubtitle && <p>{hoveredRoomSubtitle}</p>}
      {hoveredRoomDetails.assets.length > 0 ? <>
        <div className="room-hover-card-summary"><span><b>{hoveredRoomDetails.assets.length}</b> {hoveredRoomDetails.assets.length === 1 ? 'Device' : 'Devices'}</span></div>
        <div className="room-hover-device-list">
          {hoveredRoomDetails.assets.slice(0, 4).map(device => <div key={device.id}><i className={`dot ${statusClass(device.status)}`} /><span><b>{device.id}</b><small>{device.kind} · {device.detail}</small></span><em>{device.status}</em></div>)}
        </div>
      </> : <EquipmentEmptyState className="room-hover-empty" title="No devices assigned" description="This room is ready for equipment." />}
    </div>}
    {openedRoom && <RoomEquipmentDialog key={openedRoom.id} room={openedRoom} floor={floor.id} inventoryAssets={inventoryAssets} availableAssets={availableAssets} onClose={() => setOpenedRoomId(null)} onAssignAvailableAsset={asset => onAssignAvailableAsset(asset, openedRoom)} onUnassignAsset={tag => onUnassignAsset(tag, openedRoom)} />}
  </section>
}

function ResolveRoomAssignment({ asset, rooms, onAssign }: { asset: InventoryAsset; rooms: Room[]; onAssign: (asset: InventoryAsset, room: Room) => Promise<void> }) {
  const [roomId, setRoomId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return <form className="resolve-room-assignment" onSubmit={async event => {
    event.preventDefault()
    const room = rooms.find(room => room.id === roomId)
    if (!room || saving) return
    setSaving(true)
    setError('')
    try { await onAssign(asset, room) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save the room assignment.') }
    finally { setSaving(false) }
  }}>
    <div><b>{asset.tag}</b><small>{asset.location}</small></div>
    <select aria-label={`Exact room for ${asset.tag}`} value={roomId} onChange={event => setRoomId(event.target.value)} disabled={saving}>
      <option value="">Choose the correct room</option>
      {rooms.map((room, index) => <option key={room.id} value={room.id}>{room.name} (space {index + 1})</option>)}
    </select>
    <button type="submit" disabled={!roomId || saving}>{saving ? 'Saving…' : 'Save room'}</button>
    {error && <p role="alert">{error}</p>}
  </form>
}

function InteractiveFloorSvg({ floor, rooms, activeRoomId, onSelect, onHover }: { floor: Floor; rooms: Room[]; activeRoomId: string | null; onSelect: (id: string) => void; onHover: (id: string | null, point?: { x: number; y: number }) => void }) {
  const [svgMarkup, setSvgMarkup] = useState('')
  const renderedMarkup = useMemo(() => ({ __html: svgMarkup }), [svgMarkup])
  const [source, setSource] = useState('')
  const [loadError, setLoadError] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setSource('')
    setSvgMarkup('')
    setLoadError('')
    fetch(`/floor-plans/floor-${floor.id}.svg`)
      .then(response => {
        if (!response.ok) throw new Error('The floor plan could not be loaded. Reload to try again.')
        return response.text()
      })
      .then(source => {
        if (!active) return
        setSource(source)
      }).catch(() => { if (active) setLoadError('The floor plan could not be loaded. Reload to try again.') })
    return () => { active = false }
  }, [floor.id])

  useEffect(() => {
        if (!source) return
        const document = new DOMParser().parseFromString(source, 'image/svg+xml')
        if (document.querySelector('parsererror') || document.documentElement.tagName !== 'svg') {
          setLoadError('The floor plan is invalid. The room directory is still available.')
          return
        }
        prepareFloorPlanSvg(document)
        const roomShapes = Array.from(document.querySelectorAll('rect[fill="#D9D9D9"]'))
        roomShapes.forEach((shape, index) => {
          const mappedRoom = rooms.find(room => room.shapeId === (shape.id || `shape-${index + 1}`))
          if (!mappedRoom) return
          decorateRoomShape(document, shape as SVGRectElement, mappedRoom, index)
        })
        setSvgMarkup(document.documentElement.outerHTML)
  }, [source, rooms])

  useEffect(() => {
    layerRef.current?.querySelectorAll<SVGGElement>('.svg-room-node, .svg-room-hit-target').forEach(node => {
      node.classList.toggle('is-active', node.getAttribute('data-room-id') === activeRoomId)
    })
  }, [activeRoomId, svgMarkup])

  const roomIdFromTarget = (target: EventTarget | null) => target instanceof Element ? target.closest('.svg-room-node, .svg-room-hit-target')?.getAttribute('data-room-id') ?? null : null
  const selectTarget = (target: EventTarget | null) => { const id = roomIdFromTarget(target); if (id) onSelect(id) }

  if (loadError) return <p role="alert">{loadError}</p>

  return <div
    ref={layerRef}
    className="floor-svg-layer"
    dangerouslySetInnerHTML={renderedMarkup}
    onMouseMove={event => {
      const roomId = roomIdFromTarget(event.target)
      if (roomId) onHover(roomId, { x: event.clientX, y: event.clientY })
      else onHover(null)
    }}
    onMouseLeave={() => onHover(null)}
    onFocus={event => {
      const roomId = roomIdFromTarget(event.target)
      const target = event.target instanceof Element ? event.target.getBoundingClientRect() : null
      if (roomId && target) onHover(roomId, { x: target.right, y: target.top })
    }}
    onBlur={() => onHover(null)}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTarget(event.target) } }}
  />
}

function cleanFigmaLabel(value: string) {
  return value.replace(/_\d+$/, '').replace(/\s+/g, ' ').trim()
}

function roomLabelFromElement(element: SVGGraphicsElement) {
  return cleanFigmaLabel(element.tagName.toLowerCase() === 'text' ? element.textContent ?? '' : element.id)
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function svgElement<K extends keyof SVGElementTagNameMap>(document: Document, name: K, attributes: Record<string, string>) {
  const element = document.createElementNS(SVG_NAMESPACE, name)
  Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value))
  return element
}

function prepareFloorPlanSvg(document: Document) {
  const root = document.documentElement
  root.setAttribute('class', 'architectural-floor-plan')
  root.querySelectorAll<SVGElement>('[fill="white"]').forEach(background => background.setAttribute('fill', '#F4F6F5'))
  root.querySelectorAll<SVGElement>('[fill="#1E1E1E"]').forEach(background => background.setAttribute('fill', '#E8ECEA'))
  const floorTitle = /^(?:GROUND|1ST|2ND|3RD|4TH|5TH|6TH|7TH)\s+FLOOR$/i
  const structuralId = /^(?:Rectangle|Group|Circle|Ellipse|Line|Path|Vector|clip|paint|filter|mask|liveinv)/i
  root.querySelectorAll<SVGGraphicsElement>('[id], text').forEach(element => {
    const label = roomLabelFromElement(element)
    if (floorTitle.test(label)) element.remove()
    else if (label && !structuralId.test(label)) element.classList.add('figma-room-label')
  })

  const defs = svgElement(document, 'defs', {})
  const neutralPattern = svgElement(document, 'pattern', { id: 'liveinv-room-floor', width: '30', height: '30', patternUnits: 'userSpaceOnUse' })
  neutralPattern.appendChild(svgElement(document, 'rect', { width: '30', height: '30', fill: '#F8FAF9' }))
  neutralPattern.appendChild(svgElement(document, 'path', { d: 'M30 0H0V30', fill: 'none', stroke: '#E5EAE7', 'stroke-width': '1.5' }))
  const computerPattern = svgElement(document, 'pattern', { id: 'liveinv-room-floor-computer', width: '30', height: '30', patternUnits: 'userSpaceOnUse' })
  computerPattern.appendChild(svgElement(document, 'rect', { width: '30', height: '30', fill: '#F3F9F5' }))
  computerPattern.appendChild(svgElement(document, 'path', { d: 'M30 0H0V30', fill: 'none', stroke: '#D9E9DE', 'stroke-width': '1.5' }))
  defs.append(neutralPattern, computerPattern)
  root.prepend(defs)
  root.appendChild(svgElement(document, 'g', { id: 'liveinv-room-hit-layer' }))
}

function decorateRoomShape(document: Document, shape: SVGRectElement, mappedRoom: Room, index: number) {
  const parent = shape.parentNode
  if (!parent) return
  const x = Number(shape.getAttribute('x') ?? 0)
  const y = Number(shape.getAttribute('y') ?? 0)
  const width = Number(shape.getAttribute('width') ?? 0)
  const height = Number(shape.getAttribute('height') ?? 0)
  const pcs = computerCount(mappedRoom)
  const hasDevice = mappedRoom.assets.length > 0
  const group = svgElement(document, 'g', {
    class: `svg-room-node ${hasDevice ? 'has-assets has-device' : ''} ${pcs > 0 ? 'has-computer' : ''}`,
    'data-room-id': mappedRoom.id,
  })
  parent.insertBefore(group, shape)
  group.appendChild(shape)
  shape.classList.add('svg-room-box')
  shape.setAttribute('rx', String(Math.min(5, width * .035, height * .035)))
  shape.setAttribute('ry', String(Math.min(5, width * .035, height * .035)))
  shape.setAttribute('vector-effect', 'non-scaling-stroke')

  const innerWall = svgElement(document, 'rect', {
    class: 'svg-room-inner-wall',
    x: String(x + 8),
    y: String(y + 8),
    width: String(Math.max(1, width - 16)),
    height: String(Math.max(1, height - 16)),
    rx: '3',
    ry: '3',
    'vector-effect': 'non-scaling-stroke',
  })
  group.appendChild(innerWall)

  const title = svgElement(document, 'title', {})
  title.textContent = `${mappedRoom.name} · ${mappedRoom.code} · ${mappedRoom.assets.length} assets`
  group.prepend(title)


  const hitTarget = svgElement(document, 'rect', {
    class: 'svg-room-hit-target',
    x: String(x),
    y: String(y),
    width: String(width),
    height: String(height),
    rx: String(Math.min(5, width * .035, height * .035)),
    ry: String(Math.min(5, width * .035, height * .035)),
    'data-room-id': mappedRoom.id,
    role: 'button',
    tabindex: '0',
    'aria-label': `Open ${mappedRoom.name}, ${mappedRoom.assets.length} assets${pcs ? `, ${pcs} computer${pcs === 1 ? '' : 's'}` : ''}`,
  })
  document.getElementById('liveinv-room-hit-layer')?.appendChild(hitTarget)

}

type EquipmentFilter = 'All' | Asset['kind']

function RoomEquipmentDialog({ room, floor, inventoryAssets, availableAssets, onClose, onAssignAvailableAsset, onUnassignAsset }: { room: Room; floor: number; inventoryAssets: InventoryAsset[]; availableAssets: InventoryAsset[]; onClose: () => void; onAssignAvailableAsset: (asset: InventoryAsset) => Promise<void>; onUnassignAsset: (tag: string) => Promise<void> }) {
  const sortedRoomAssets = useMemo(() => [...room.assets].sort((a, b) => assetTagCollator.compare(a.id, b.id)), [room.assets])
  const [filter, setFilter] = useState<EquipmentFilter>('All')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(sortedRoomAssets[0]?.id ?? null)
  const [availableAssetTag, setAvailableAssetTag] = useState(availableAssets[0]?.tag ?? '')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentMessage, setAssignmentMessage] = useState('')
  const [assignmentError, setAssignmentError] = useState('')
  const [pendingUnassign, setPendingUnassign] = useState<Asset | null>(null)
  const [isUnassigning, setIsUnassigning] = useState(false)
  const mutationPending = useRef(false)
  const [viewedAssetTag, setViewedAssetTag] = useState<string | null>(null)
  const viewedAsset = inventoryAssets.find(item => item.tag === viewedAssetTag)
  const recordTrigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!viewedAsset && recordTrigger.current) {
      recordTrigger.current.focus()
      recordTrigger.current = null
    }
  }, [viewedAsset])
  const effectiveFilter = filter === 'All' || sortedRoomAssets.some(item => item.kind === filter) ? filter : 'All'
  const filteredAssets = effectiveFilter === 'All' ? sortedRoomAssets : sortedRoomAssets.filter(assetItem => assetItem.kind === effectiveFilter)
  const selectedAsset = filteredAssets.find(assetItem => assetItem.id === selectedAssetId) ?? filteredAssets[0]
  const counts = room.assets.reduce<Record<AssetKind, number>>((result, assetItem) => {
    result[assetItem.kind] += 1
    return result
  }, { 'System Unit': 0, Printer: 0, Monitor: 0, Keyboard: 0, UPS: 0, Scanner: 0, Router: 0, Other: 0 })
  const representedKinds = equipmentKinds.filter(kind => counts[kind] > 0)
  const filters: EquipmentFilter[] = ['All', ...representedKinds]
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !pendingUnassign && !viewedAsset && !mutationPending.current) onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, pendingUnassign, viewedAsset])

  useEffect(() => { if (effectiveFilter !== filter) setFilter(effectiveFilter) }, [effectiveFilter, filter])

  useEffect(() => {
    if (!availableAssets.some(assetItem => assetItem.tag === availableAssetTag)) {
      setAvailableAssetTag(availableAssets[0]?.tag ?? '')
    }
  }, [availableAssets, availableAssetTag])

  const chooseFilter = (nextFilter: EquipmentFilter) => {
    setFilter(nextFilter)
    const first = nextFilter === 'All' ? sortedRoomAssets[0] : sortedRoomAssets.find(assetItem => assetItem.kind === nextFilter)
    setSelectedAssetId(first?.id ?? null)
  }

  const assignSelectedAsset = async () => {
    const availableAsset = availableAssets.find(assetItem => assetItem.tag === availableAssetTag)
    if (!availableAsset || mutationPending.current) return
    mutationPending.current = true
    setAssignmentMessage('')
    setAssignmentError('')
    setIsAssigning(true)
    try {
      await onAssignAvailableAsset(availableAsset)
      setAssignmentMessage(`${availableAsset.tag} was assigned to ${room.name}.`)
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'The asset could not be assigned. Please try again.')
    } finally {
      mutationPending.current = false
      setIsAssigning(false)
    }
  }

  const confirmUnassign = async () => {
    if (!pendingUnassign || mutationPending.current) return
    mutationPending.current = true
    setIsUnassigning(true)
    setAssignmentMessage('')
    setAssignmentError('')
    try {
      await onUnassignAsset(pendingUnassign.id)
      setAssignmentMessage(`${pendingUnassign.id} was unassigned from ${room.name} and is available for reassignment.`)
      setPendingUnassign(null)
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'The device could not be unassigned. Please try again.')
    } finally {
      mutationPending.current = false
      setIsUnassigning(false)
    }
  }

  return createPortal(<div className="equipment-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pendingUnassign && !viewedAsset && !mutationPending.current) onClose() }}>
    <section className="equipment-dialog" role="dialog" aria-modal="true" aria-labelledby="equipment-dialog-title" inert={Boolean(viewedAsset)} aria-hidden={viewedAsset ? true : undefined}>
      <header className="equipment-dialog-header">
        <div><span>FLOOR {floor} · ROOM {room.code}</span><h2 id="equipment-dialog-title">{room.name}</h2><p>{room.department} · Select equipment to view its details.</p></div>
        <button type="button" className="equipment-dialog-close" aria-label="Close equipment popup" disabled={isAssigning || isUnassigning || Boolean(pendingUnassign)} onClick={onClose}>×</button>
      </header>
      <div className="equipment-summary-strip">
        <div><span>Total equipment</span><b>{room.assets.length}</b></div>
        {representedKinds.map(kind => <div key={kind}><span className={`equipment-kind-icon ${equipmentKindClass(kind)}`}><EquipmentIcon kind={kind} /></span><span>{equipmentLabels[kind]}</span><b>{counts[kind]}</b></div>)}
      </div>
      <section className="room-inline-assignment" aria-label={`Assign an available asset to ${room.name}`}>
        <div className="room-inline-assignment-copy"><span>ASSIGN AVAILABLE ASSET</span><b>Add a device to {room.name}</b><small>The device will immediately appear in this room.</small></div>
        {availableAssets.length ? <>
          <label><span>Available asset or device</span><select aria-label="Available asset or device" value={availableAssetTag} onChange={event => { setAvailableAssetTag(event.target.value); setAssignmentMessage(''); setAssignmentError('') }}>{availableAssets.map(assetItem => <option key={assetItem.tag} value={assetItem.tag}>{assetItem.tag} — {assetItem.name}</option>)}</select></label>
          <button type="button" onClick={assignSelectedAsset} disabled={isAssigning || isUnassigning || Boolean(pendingUnassign) || !availableAssetTag}>{isAssigning ? 'Assigning…' : 'Assign to this room'}</button>
        </> : <EquipmentEmptyState className="room-inline-assignment-empty" size="inline" title="No assets available" description="All registered assets are already assigned." />}
        {assignmentMessage && <p className="room-inline-assignment-success" role="status">✓ {assignmentMessage}</p>}
        {assignmentError && !pendingUnassign && <p className="room-inline-assignment-error" role="alert">{assignmentError}</p>}
      </section>
      {room.assets.length === 0 ? <EquipmentEmptyState className="equipment-empty" title="No equipment assigned" description="Choose an available asset above to add equipment to this room. It will appear here immediately." /> : <div className="room-focus-layout">
        <section className="room-focus-visual" aria-label={`2D view of ${room.name}`}>
          <div className="room-focus-heading"><div><span>2D ROOM VIEW</span><h3>{room.name}</h3></div><strong>{room.assets.length} device{room.assets.length === 1 ? '' : 's'}</strong></div>
          <div className="room-focus-plan">
            <div className="room-focus-grid" />
            <div className="room-focus-door"><i /></div>
            <div className="room-device-grid">
              {sortedRoomAssets.map(device => <button
                type="button"
                key={device.id}
                className={`room-device-marker ${device.id === selectedAsset?.id ? 'selected' : ''} ${statusClass(device.status)}`}
                aria-label={`View ${device.id}, ${device.kind}, ${device.detail}`}
                onClick={() => { setFilter(device.kind); setSelectedAssetId(device.id) }}
              ><span className={`room-device-symbol ${equipmentKindClass(device.kind)}`}><EquipmentIcon kind={device.kind} /></span><b>{device.id}</b><small>{device.detail}</small></button>)}
            </div>
            {!room.assets.length && <EquipmentEmptyState className="room-focus-no-pc" size="compact" title="No devices assigned" description="Assign equipment to display it in this room." />}
          </div>
          <div className="room-focus-legend"><span><i className="active" />Active</span><span><i className="maintenance" />Maintenance</span><span>Click a device icon to inspect it</span></div>
        </section>
        <section className="room-focus-details">
          <div className="room-focus-details-heading"><div><span>ASSIGNED EQUIPMENT</span><h3>Devices and models</h3></div><b>{room.assets.length}</b></div>
          <div className="equipment-filter-tabs" aria-label="Filter room equipment">
            {filters.map(item => <button type="button" key={item} className={effectiveFilter === item ? 'active' : ''} aria-pressed={effectiveFilter === item} onClick={() => chooseFilter(item)}>{item === 'All' ? `All ${room.assets.length}` : `${equipmentLabels[item]} ${counts[item]}`}</button>)}
          </div>
          <div className="room-focus-device-list" aria-label="Equipment in this room">
            {filteredAssets.length ? filteredAssets.map(assetItem => <div key={assetItem.id} className={`room-device-row ${assetItem.id === selectedAsset?.id ? 'selected' : ''}`}>
              <button type="button" className="room-device-select" aria-label={`Select ${assetItem.id}`} aria-pressed={assetItem.id === selectedAsset?.id} onClick={() => setSelectedAssetId(assetItem.id)}>
                <span className={`equipment-list-icon ${equipmentKindClass(assetItem.kind)}`}><EquipmentIcon kind={assetItem.kind} /></span>
                <span><b>{assetItem.id}</b><small>{assetItem.detail}</small></span>
                <i className={`dot ${statusClass(assetItem.status)}`} />
              </button>
              <button type="button" className="room-device-record-button" aria-label={`View record for ${assetItem.id}`} onClick={event => { recordTrigger.current = event.currentTarget; setViewedAssetTag(assetItem.id) }}>View record</button>
            </div>) : <EquipmentEmptyState className="equipment-filter-empty" size="compact" kind={filter === 'All' ? 'System Unit' : filter} title={`No ${filter.toLowerCase()} assigned`} description="Choose another equipment filter or assign a matching device." />}
          </div>
          {selectedAsset && <article className="room-focus-selected">
            <div className="room-focus-selected-heading"><div><small>SELECTED EQUIPMENT</small><h3>{selectedAsset.id}</h3><p>{selectedAsset.detail}</p></div><em className={statusClass(selectedAsset.status)}><i />{selectedAsset.status}</em></div>
            <div className="room-focus-selected-grid"><Detail label="Type" value={selectedAsset.kind} /><Detail label="Model" value={selectedAsset.detail} /><Detail label="Department" value={selectedAsset.owner} />{selectedAsset.ip && <Detail label="IP address" value={selectedAsset.ip} />}</div>
            <div className="room-unassign-action"><button type="button" disabled={isAssigning || isUnassigning} onClick={() => { setAssignmentError(''); setAssignmentMessage(''); setPendingUnassign(selectedAsset) }}>Unassign from room</button></div>
            <AssetQrCode tag={selectedAsset.id} qrId={selectedAsset.qrId} />
          </article>}
        </section>
      </div>}
    </section>
    {viewedAsset && <FullDeviceRecordDialog asset={viewedAsset} onClose={() => setViewedAssetTag(null)} />}
    <AlertDialog open={Boolean(pendingUnassign)} onOpenChange={open => { if (!open && !mutationPending.current) { setPendingUnassign(null); setAssignmentError('') } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Unassign {pendingUnassign?.id}?</AlertDialogTitle><AlertDialogDescription>Remove this device from {room.name}? Its record and QR number will be kept, and it will be available to assign to another room.</AlertDialogDescription></AlertDialogHeader>
        {assignmentError && <p className="room-inline-assignment-error" role="alert">{assignmentError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={isUnassigning} /><AlertDialogAction disabled={isUnassigning} onClick={event => { event.preventDefault(); void confirmUnassign() }}>{isUnassigning ? 'Unassigning…' : 'Confirm unassign'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>, document.body)
}

function RoomView({ room, floor, onBack, onAsset, onAssignEquipment }: { room:Room;floor:number;onBack:()=>void;onAsset:(id:string)=>void;onAssignEquipment:()=>void }) {
  const counts = room.assets.reduce<Record<string, number>>((result, asset) => ({ ...result, [asset.kind]: (result[asset.kind] ?? 0) + 1 }), {})
  const representedKinds = equipmentKinds.filter(kind => counts[kind])
  return <section className="workspace room-workspace">
    <div className="page-heading room-heading"><div><button className="back" onClick={onBack}>← Floor {floor} map</button><span className="eyebrow">ROOM {room.code} / FLOOR {floor}</span><h1>{room.name}</h1><p>{room.assets.length} assets assigned · {room.department}</p></div><button className="primary-action" onClick={onAssignEquipment}>＋ Assign item</button></div>
    <div className="room-category-strip"><div><span>Total assets</span><b>{room.assets.length}</b></div>{representedKinds.map(kind => <div key={kind}><span>{equipmentLabels[kind]}</span><b>{counts[kind] ?? 0}</b></div>)}<div><span>Room code</span><b>{room.code}</b></div></div>
    <div className="room-stage"><div className="room-plan"><div className="room-grid"/><div className="plan-title">{room.name}<small>Interactive asset placement · hover or click a marker</small></div><div className="desk desk-one"/><div className="desk desk-two"/><div className="desk desk-three"/>{room.assets.length ? room.assets.map((item,index) => <button key={item.id} className={`asset-pin pin-${index} ${statusClass(item.status)}`} onClick={() => onAsset(item.id)}><span><EquipmentIcon kind={item.kind} /></span><b>{item.id}</b><small>{item.detail}</small></button>) : <EquipmentEmptyState className="room-plan-empty" size="compact" title="No equipment in this room" description="Assign a device to place it on the room plan." />}</div><div className="room-side"><h3>Assets in this room</h3><p className="muted">Select an item to view its details, network data, and assignment history.</p>{room.assets.length ? room.assets.map(asset => <button className="asset-list-item" key={asset.id} onClick={() => onAsset(asset.id)}><span className={`asset-kind ${statusClass(asset.status)}`}><EquipmentIcon kind={asset.kind} /></span><span><b>{asset.id}</b><small>{asset.detail}</small></span><i>→</i></button>) : <EquipmentEmptyState className="room-side-empty" size="compact" title="No assigned devices" description="Use the button below to add equipment." />}<button className="outline-full" onClick={onAssignEquipment}>＋ Assign item to this room</button></div></div>
  </section>
}

function AssetView({ room, floor, asset, onBack }: {room:Room;floor:number;asset:Asset;onBack:()=>void}) { return <section className="workspace"><div className="page-heading asset-heading"><div><button className="back" onClick={onBack}>← {room.name}</button><span className="eyebrow">ASSET DETAILS</span><h1>{asset.id} <em className={statusClass(asset.status)}>{asset.status}</em></h1><p>{asset.detail} · {asset.kind}</p></div><button className="primary-action">Edit asset</button></div><div className="asset-detail-grid"><div className="asset-hero"><div className={`asset-illustration ${equipmentKindClass(asset.kind)}`}><EquipmentIcon kind={asset.kind} /></div><h2>{asset.id}</h2><p>{asset.detail}</p><AssetQrCode tag={asset.id} qrId={asset.qrId} /></div><div className="detail-card"><div className="tabs"><b>Details</b><span>Specifications</span><span>History</span></div><div className="details"><Detail label="Category" value={asset.kind} /><Detail label="Status" value={asset.status} dot={asset.status}/><Detail label="Assigned to" value={`Floor ${floor} / ${room.name}`} /><Detail label="Asset tag" value={asset.id} /><Detail label="Brand" value="Dell" /><Detail label="Model" value={asset.detail.replace('Dell ', '')} />{asset.ip && <><Detail label="IPv4 address" value={asset.ip} /><Detail label="Hostname" value="HOSP-MEDREC-034" /><Detail label="Address method" value="DHCP reservation" /></>}</div></div></div></section> }
function Detail({label,value,dot}:{label:string;value:string;dot?:Status}) { return <div className="detail"><span>{label}</span><b>{dot && <i className={`dot ${statusClass(dot)}`}/>} {value}</b></div> }
