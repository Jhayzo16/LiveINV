import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import liveInvLogo from './assets/liveinv-logo.png'
import { HospitalBuilding3D } from './components/ui/hospital-building-3d'
import { SystemModulePage, type SystemModule } from './pages/SystemPages'

type Status = 'Active' | 'Maintenance' | 'Broken'
type Asset = { id: string; name: string; kind: 'Computer' | 'Printer' | 'Monitor'; status: Status; detail: string; ip?: string }
type Room = { id: string; name: string; code: string; department: string; assets: Asset[]; x: number; y: number; w: number; h: number }
type Floor = { id: number; label: string; assets: number }

const floors = [
  { id: 1, label: 'Reception & ER', assets: 78 }, { id: 2, label: 'Diagnostics', assets: 112 },
  { id: 3, label: 'Medical Records', assets: 148 }, { id: 4, label: 'Finance & Admin', assets: 96 },
  { id: 5, label: 'Nursing Units', assets: 131 }, { id: 6, label: 'Training Center', assets: 64 }, { id: 7, label: 'Executive Offices', assets: 44 },
]

const makeAssets = (floor: number, code: string, count = 3): Asset[] => {
  const kinds: Asset['kind'][] = ['Computer', 'Printer', 'Monitor']
  const prefixes = { Computer: 'PC', Printer: 'PRN', Monitor: 'MON' }
  const details = { Computer: 'Dell OptiPlex 7090', Printer: 'HP LaserJet Pro M404dn', Monitor: 'Dell 24-inch Display' }
  const statuses: Status[] = ['Active', 'Active', 'Maintenance']
  return Array.from({ length: count }, (_, index) => {
    const kind = kinds[index % kinds.length]
    const id = `${prefixes[kind]}-${code}-${String(index + 1).padStart(2, '0')}`
    return { id, name: id, kind, status: statuses[index % statuses.length], detail: details[kind], ...(kind === 'Computer' ? { ip: `10.20.${floor}.${30 + index}` } : {}) }
  })
}

const room = (floor: number, id: string, name: string, code: string, department: string, x: number, y: number, w: number, h: number, assetCount = 3): Room => ({
  id: `f${floor}-${id}`, name, code, department, x, y, w, h, assets: makeAssets(floor, code, assetCount),
})

const featuredRoomsByFloor: Record<number, Room[]> = {
  1: [
    room(1, 'emergency', 'Emergency Treatment', 'ERT', 'Emergency Department', 42, 8, 34, 21, 4),
    room(1, 'diagnostics', 'Diagnostic Imaging', 'DIA', 'Radiology Department', 37, 33, 33, 24, 3),
    room(1, 'reception', 'ER Reception', 'ERR', 'Emergency Department', 72, 34, 17, 20, 2),
    room(1, 'laboratory', 'Clinical Laboratory', 'LAB', 'Laboratory Department', 36, 70, 37, 20, 4),
  ],
  2: [
    room(2, 'operating', 'Operating Room Complex', 'ORC', 'Surgical Services', 25, 18, 43, 34, 4),
    room(2, 'nicu', 'Neonatal ICU', 'NICU', 'Women and Children', 70, 8, 24, 27, 3),
    room(2, 'recovery', 'Recovery Room', 'REC', 'Surgical Services', 34, 34, 31, 17, 3),
    room(2, 'picu', 'Pediatric ICU', 'PICU', 'Women and Children', 36, 65, 48, 20, 4),
  ],
  3: [
    room(3, 'dietary', 'Dietary and Canteen', 'DCT', 'Food and Nutrition', 27, 7, 45, 25, 3),
    room(3, 'endoscopy', 'Endoscopy Center', 'END', 'Diagnostics Department', 25, 36, 31, 24, 4),
    room(3, 'business', 'Business Office', 'BUS', 'Administration', 70, 10, 23, 28, 3),
    room(3, 'hemodialysis', 'Hemodialysis Center', 'HDC', 'Renal Services', 48, 65, 45, 25, 4),
  ],
  4: [
    room(4, 'ent', 'ENT and Ophthalmology', 'ENT', 'Outpatient Clinics', 69, 17, 24, 17, 3),
    room(4, 'doctors', 'Doctors Clinics', 'DOC', 'Outpatient Clinics', 22, 18, 50, 20, 4),
    room(4, 'dental', 'Dental Clinic', 'DEN', 'Dental Services', 46, 38, 30, 19, 3),
    room(4, 'infertility', 'Infertility Center', 'IFC', 'Specialty Services', 65, 47, 24, 18, 3),
  ],
  5: [
    room(5, 'multipurpose', 'Multi-Purpose Hall', 'MPH', 'Administration', 20, 34, 33, 25, 2),
    room(5, 'records', 'Medical Records and Archives', 'MRR', 'Medical Records Department', 52, 36, 29, 22, 4),
    room(5, 'accounting', 'Accounting Office', 'ACC', 'Finance Department', 53, 14, 23, 16, 3),
    room(5, 'boardroom', 'Boardroom', 'BRD', 'Executive Offices', 74, 13, 18, 17, 3),
  ],
  6: [
    room(6, 'private-north', 'North Private Rooms', 'NPR', 'Inpatient Services', 25, 10, 64, 18, 4),
    room(6, 'surgical-ward', 'Surgical Wards', 'SWD', 'Surgical Services', 25, 31, 51, 25, 4),
    room(6, 'pedia', 'Pediatric Ward', 'PED', 'Women and Children', 58, 49, 27, 17, 3),
    room(6, 'private-south', 'South Private Rooms', 'SPR', 'Inpatient Services', 27, 63, 62, 20, 4),
  ],
  7: [
    room(7, 'private-north', 'North Private Rooms', 'NPR', 'Inpatient Services', 25, 10, 64, 18, 4),
    room(7, 'semi-private', 'Semi-Private Rooms', 'SEM', 'Inpatient Services', 34, 31, 51, 25, 4),
    room(7, 'prayer', 'Prayer Rooms', 'PRY', 'Patient Support', 75, 35, 16, 16, 2),
    room(7, 'private-south', 'South Private Rooms', 'SPR', 'Inpatient Services', 27, 64, 62, 20, 4),
  ],
}

const floorRoomCounts: Record<number, number> = { 1: 59, 2: 46, 3: 34, 4: 40, 5: 34, 6: 37, 7: 37 }

const roomsByFloor: Record<number, Room[]> = Object.fromEntries(floors.map(floorItem => {
  const featured = featuredRoomsByFloor[floorItem.id] ?? []
  const rooms = Array.from({ length: floorRoomCounts[floorItem.id] }, (_, index) => featured[index] ?? room(
    floorItem.id,
    `room-${index + 1}`,
    `Room ${String(index + 1).padStart(2, '0')}`,
    `F${floorItem.id}-R${String(index + 1).padStart(2, '0')}`,
    floorItem.label,
    0, 0, 0, 0, 0,
  ))
  return [floorItem.id, rooms]
}))

const allRooms = Object.values(roomsByFloor).flat()

const floorMapAspectRatios: Record<number, string> = {
  1: '2900 / 2550',
  2: '2750 / 2670',
  3: '2700 / 2550',
  4: '2900 / 2600',
  5: '2650 / 1650',
  6: '2660 / 2050',
  7: '2660 / 2050',
}

const Icon = ({ name }: { name: string }) => <span className="icon" aria-hidden="true">{name}</span>
const statusClass = (status: Status) => status.toLowerCase()
const computerCount = (roomItem: Room) => roomItem.assets.filter(assetItem => assetItem.kind === 'Computer').length

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [module, setModule] = useState<SystemModule | 'topology'>('topology')
  const [floor, setFloor] = useState<number | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const room = allRooms.find(r => r.id === roomId)
  const asset = room?.assets.find(a => a.id === assetId)
  const selectedFloor = floor ? floors.find(item => item.id === floor) : null
  const currentAssets = useMemo(() => allRooms.flatMap(item => item.assets), [])

  const resetToFloors = () => { setFloor(null); setRoomId(null); setAssetId(null) }
  const openModule = (next: SystemModule | 'topology') => { setModule(next); resetToFloors(); window.scrollTo({ top: 0, behavior: 'auto' }) }

  return <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
    <LiveInvSidebar module={module} expanded={sidebarOpen} onToggle={() => setSidebarOpen(open => !open)} onNavigate={openModule} />
    <main>
      <header className="topbar"><div className="crumbs">{module === 'topology' ? <><button onClick={resetToFloors}>Topology</button>{selectedFloor && <><span>/</span><button onClick={() => { setRoomId(null); setAssetId(null) }}>Floor {floor}</button></>}{room && <><span>/</span><button onClick={() => setAssetId(null)}>{room.name}</button></>}{asset && <><span>/</span><b>{asset.id}</b></>}</> : <><span>Hospital Inventory</span><span>/</span><b>{module === 'qr' ? 'QR Scanner' : module === 'network' ? 'Network Registry' : module === 'manual' ? 'System Manual' : module.charAt(0).toUpperCase() + module.slice(1)}</b></>}</div><div className="top-actions"><button className="ghost-btn">⌕ Search</button><button className="bell">◌</button><span className="avatar">AD</span></div></header>
      {module !== 'topology' && <SystemModulePage module={module} />}
      {module === 'topology' && !floor && <FloorTopology floors={floors} onSelect={setFloor} />}
      {module === 'topology' && floor && !room && <FloorView floor={selectedFloor!} onBack={resetToFloors} rooms={roomsByFloor[floor] ?? []} />}
      {module === 'topology' && floor && room && !asset && <RoomView room={room} floor={floor} onBack={() => setRoomId(null)} onAsset={setAssetId} />}
      {module === 'topology' && floor && room && asset && <AssetView room={room} floor={floor} asset={asset} onBack={() => setAssetId(null)} />}
    </main>
    <aside className="insights-panel"><h3>Live status</h3><p className="muted">Hospital inventory at a glance</p><div className="stat"><span>Total assets</span><b>648</b><small>Across 7 floors</small></div><div className="status-list"><StatusRow color="green" label="Active" value="521" /><StatusRow color="amber" label="Maintenance" value="86" /><StatusRow color="red" label="Broken" value="41" /></div><div className="divider"/><h4>Quick actions</h4><button className="quick primary">＋ Add new asset</button><button className="quick">▣ Scan QR code</button><button className="quick">⇄ Assign an item</button><div className="recent"><h4>Recently viewed</h4>{currentAssets.slice(0, 3).map(item => <button key={item.id}><span className={`dot ${statusClass(item.status)}`} />{item.id}<small>{item.kind}</small></button>)}</div></aside>
  </div>
}

function LiveInvSidebar({ module, expanded, onToggle, onNavigate }: {
  module: SystemModule | 'topology'
  expanded: boolean
  onToggle: () => void
  onNavigate: (module: SystemModule | 'topology') => void
}) {
  const activeNavIndex = ['dashboard', 'topology', 'assets', 'assignments', 'qr', 'reports', 'manual'].indexOf(module)

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
        <button className={`nav-item ${module === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}><Icon name="▦" /><span className="sidebar-item-label">Dashboard</span></button>
        <button className={`nav-item ${module === 'topology' ? 'active' : ''}`} onClick={() => navigate('topology')}><Icon name="⌘" /><span className="sidebar-item-label">Topology</span></button>
        <button className={`nav-item ${module === 'assets' ? 'active' : ''}`} onClick={() => navigate('assets')}><Icon name="▤" /><span className="sidebar-item-label">Assets</span><span className="nav-count">648</span></button>
        <button className={`nav-item ${module === 'assignments' ? 'active' : ''}`} onClick={() => navigate('assignments')}><Icon name="▧" /><span className="sidebar-item-label">Assignments</span></button>
        <button className={`nav-item ${module === 'qr' ? 'active' : ''}`} onClick={() => navigate('qr')}><Icon name="▣" /><span className="sidebar-item-label">QR Scanner</span></button>
        <button className={`nav-item ${module === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}><Icon name="▥" /><span className="sidebar-item-label">Reports</span></button>
        <button className={`nav-item ${module === 'manual' ? 'active' : ''}`} onClick={() => navigate('manual')}><Icon name="?" /><span className="sidebar-item-label">Manual</span></button>
      </nav>
      <div className="sidebar-spacer" />
    </div>
    <footer className="liveinv-sidebar-footer">
      <div className="sidebar-profile-button sidebar-admin-profile" aria-label="Current user: Admin"><span className="avatar">AD</span><span className="sidebar-profile-copy"><b>Admin</b><small>Administrator</small></span></div>
    </footer>
  </aside>
}

function StatusRow({ color, label, value }: { color: string; label: string; value: string }) { return <div className="status-row"><span><i className={color}/>{label}</span><b>{value}</b></div> }

function FloorTopology({ floors, onSelect }: { floors: Floor[]; onSelect:(id:number)=>void }) {
  const modelFloors = floors.map(floorItem => ({ ...floorItem, rooms: floorRoomCounts[floorItem.id] ?? 0 }))
  return <section className="workspace topology-workspace hospital-topology-workspace" aria-label={`${floors.length} hospital floors available`}><div className="section-heading"><span className="eyebrow">VISUAL INVENTORY</span><h1>Hospital topology</h1><p>Rotate the 3D hospital, inspect each floor, and explore its rooms and assigned inventory.</p></div><HospitalBuilding3D floors={modelFloors} onExplore={onSelect} /></section>
}

function FloorView({ floor, onBack, rooms }: { floor:Floor;onBack:()=>void;rooms:Room[] }) {
  const [zoom, setZoom] = useState(1)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [hoverCardPosition, setHoverCardPosition] = useState<{ x: number; y: number } | null>(null)
  const [openedRoomId, setOpenedRoomId] = useState<string | null>(null)
  const hoverOpenTimer = useRef<number | null>(null)
  const hoverCloseTimer = useRef<number | null>(null)
  const pendingHoverRoom = useRef<string | null>(null)
  const visibleHoverRoom = useRef<string | null>(null)
  const openedRoom = rooms.find(item => item.id === openedRoomId)
  const hoveredRoomDetails = rooms.find(item => item.id === hoveredRoom)
  const selectedRoom = rooms.find(item => item.id === hoveredRoom) ?? openedRoom

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
    <div className="page-heading floor-heading">
      <div><button className="back" onClick={onBack}>← All floors</button><span className="eyebrow">FLOOR {floor.id} / {floor.label.toUpperCase()}</span><h1>Interactive hospital map</h1><p>Hover over a highlighted room for a summary, then select it to view assigned assets.</p></div>
      <div className="floor-summary"><b>{rooms.length}</b><span>mapped rooms</span><b>{rooms.reduce((total, item) => total + item.assets.length, 0)}</b><span>demo assets</span></div>
    </div>
    <div className={`floor-map-layout ${directoryOpen ? '' : 'directory-collapsed'}`}>
      <div className="map-card floor-map-card">
        <div className="map-toolbar">
          <div><b>{floor.label}</b><span>Interactive room layout</span></div>
          <div className="map-toolbar-actions">
            <button
              type="button"
              className={`directory-toggle ${directoryOpen ? 'is-open' : ''}`}
              aria-controls={`floor-${floor.id}-room-directory`}
              aria-expanded={directoryOpen}
              onClick={() => setDirectoryOpen(open => !open)}
            ><span aria-hidden="true">☷</span>{directoryOpen ? 'Hide directory' : 'Show directory'}</button>
            <div className="zoom-controls"><button onClick={() => setZoom(value => Math.max(1, value - .2))} aria-label="Zoom out">−</button><button onClick={() => setZoom(1)} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button><button onClick={() => setZoom(value => Math.min(2, value + .2))} aria-label="Zoom in">＋</button></div>
          </div>
        </div>
        <div className="map-viewport">
          <div className="map-canvas figma-floor-map" style={{ transform: `scale(${zoom})`, aspectRatio: floorMapAspectRatios[floor.id] }} role="img" aria-label={`Interactive room layout for Floor ${floor.id}`}>
            <InteractiveFloorSvg floor={floor} rooms={rooms} activeRoomId={hoveredRoom ?? openedRoomId} onSelect={openRoomDetails} onHover={handleMapHover} />
          </div>
        </div>
        <div className="map-status"><span className="map-status-key"><i className="mapped"/>Mapped room</span><span className="map-status-key"><i className="computer"/>Computer present</span><span>Click a room to enter</span>{selectedRoom && <strong>{selectedRoom.name} · {selectedRoom.assets.length} assets</strong>}</div>
      </div>
      <aside id={`floor-${floor.id}-room-directory`} className="floor-room-directory" hidden={!directoryOpen}>
        <div className="directory-heading"><span className="eyebrow">ROOM DIRECTORY</span><h3>Floor {floor.id} spaces</h3><p>Select a room to inspect its inventory.</p></div>
        <div className="directory-list">{rooms.map((item, index) => {
          const pcs = computerCount(item)
          return <button key={item.id} className={`${pcs ? 'has-computer' : ''} ${item.id === openedRoomId ? 'is-open' : ''}`} onMouseEnter={() => setHoveredRoom(item.id)} onMouseLeave={() => setHoveredRoom(null)} onFocus={() => setHoveredRoom(item.id)} onBlur={() => setHoveredRoom(null)} onClick={() => openRoomDetails(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><span><b>{item.name}</b><small>{item.department}</small></span>{pcs > 0 && <span className="directory-pc" aria-label={`${pcs} computer${pcs === 1 ? '' : 's'}`}><i />{pcs}</span>}<em>{item.assets.length}</em></button>
        })}</div>
        <button className="outline-full">＋ Add or map a room</button>
      </aside>
    </div>
    {hoveredRoomDetails && hoverCardPosition && <div className="room-hover-card" style={{ left: hoverCardPosition.x, top: hoverCardPosition.y }} role="status" aria-live="polite">
      <div className="room-hover-card-heading"><span>ROOM QUICK VIEW</span><b>{hoveredRoomDetails.assets.length} assigned</b></div>
      <h3>{hoveredRoomDetails.name}</h3>
      <p>{hoveredRoomDetails.code} · {hoveredRoomDetails.department}</p>
      <div className="room-hover-card-summary"><span><b>{hoveredRoomDetails.assets.length}</b> Devices</span><span><b>{computerCount(hoveredRoomDetails)}</b> Computers</span></div>
      <div className="room-hover-device-list">
        {hoveredRoomDetails.assets.length ? hoveredRoomDetails.assets.slice(0, 4).map(device => <div key={device.id}><i className={`dot ${statusClass(device.status)}`} /><span><b>{device.id}</b><small>{device.kind} · {device.detail}</small></span><em>{device.status}</em></div>) : <div className="room-hover-empty">No devices assigned to this room.</div>}
      </div>
    </div>}
    {openedRoom && <RoomEquipmentDialog key={openedRoom.id} room={openedRoom} floor={floor.id} onClose={() => setOpenedRoomId(null)} />}
  </section>
}

function InteractiveFloorSvg({ floor, rooms, activeRoomId, onSelect, onHover }: { floor: Floor; rooms: Room[]; activeRoomId: string | null; onSelect: (id: string) => void; onHover: (id: string | null, point?: { x: number; y: number }) => void }) {
  const [svgMarkup, setSvgMarkup] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetch(`/floor-plans/floor-${floor.id}.svg`)
      .then(response => response.text())
      .then(source => {
        if (!active) return
        const document = new DOMParser().parseFromString(source, 'image/svg+xml')
        prepareFloorPlanSvg(document)
        const roomShapes = Array.from(document.querySelectorAll('rect[fill="#D9D9D9"]'))
        roomShapes.forEach((shape, index) => {
          const mappedRoom = rooms[index]
          if (!mappedRoom) return
          decorateRoomShape(document, shape as SVGRectElement, mappedRoom, index)
        })
        setSvgMarkup(document.documentElement.outerHTML)
      })
    return () => { active = false }
  }, [floor.id, rooms])

  useEffect(() => {
    layerRef.current?.querySelectorAll<SVGGElement>('.svg-room-node, .svg-room-hit-target').forEach(node => {
      node.classList.toggle('is-active', node.getAttribute('data-room-id') === activeRoomId)
    })
  }, [activeRoomId, svgMarkup])

  const roomIdFromTarget = (target: EventTarget | null) => target instanceof Element ? target.closest('.svg-room-node, .svg-room-hit-target')?.getAttribute('data-room-id') ?? null : null
  const selectTarget = (target: EventTarget | null) => { const id = roomIdFromTarget(target); if (id) onSelect(id) }

  return <div
    ref={layerRef}
    className="floor-svg-layer"
    dangerouslySetInnerHTML={{ __html: svgMarkup }}
    onPointerDownCapture={event => { if (event.button === 0) selectTarget(event.target) }}
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
  const group = svgElement(document, 'g', {
    class: `svg-room-node ${mappedRoom.assets.length ? 'has-assets' : ''} ${pcs ? 'has-computer' : ''}`,
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

  if (width >= 118 && height >= 96) {
    const doorWidth = Math.min(48, Math.max(30, width * .2))
    const hingeX = x + width / 2 - doorWidth / 2
    const floorY = y + height
    const door = svgElement(document, 'g', { class: 'svg-room-door', 'aria-hidden': 'true' })
    door.appendChild(svgElement(document, 'line', { x1: String(hingeX - 3), y1: String(floorY), x2: String(hingeX + doorWidth + 3), y2: String(floorY), class: 'svg-room-door-gap', 'vector-effect': 'non-scaling-stroke' }))
    door.appendChild(svgElement(document, 'path', { d: `M ${hingeX} ${floorY} V ${floorY - doorWidth}`, class: 'svg-room-door-leaf', 'vector-effect': 'non-scaling-stroke' }))
    door.appendChild(svgElement(document, 'path', { d: `M ${hingeX} ${floorY - doorWidth} A ${doorWidth} ${doorWidth} 0 0 1 ${hingeX + doorWidth} ${floorY}`, class: 'svg-room-door-swing', 'vector-effect': 'non-scaling-stroke' }))
    group.appendChild(door)
  } else if (height >= 118) {
    const doorWidth = Math.min(42, Math.max(28, height * .2))
    const wallX = x + width
    const hingeY = y + height / 2 - doorWidth / 2
    const door = svgElement(document, 'g', { class: 'svg-room-door', 'aria-hidden': 'true' })
    door.appendChild(svgElement(document, 'line', { x1: String(wallX), y1: String(hingeY - 3), x2: String(wallX), y2: String(hingeY + doorWidth + 3), class: 'svg-room-door-gap', 'vector-effect': 'non-scaling-stroke' }))
    door.appendChild(svgElement(document, 'path', { d: `M ${wallX} ${hingeY} H ${wallX - doorWidth}`, class: 'svg-room-door-leaf', 'vector-effect': 'non-scaling-stroke' }))
    door.appendChild(svgElement(document, 'path', { d: `M ${wallX - doorWidth} ${hingeY} A ${doorWidth} ${doorWidth} 0 0 0 ${wallX} ${hingeY + doorWidth}`, class: 'svg-room-door-swing', 'vector-effect': 'non-scaling-stroke' }))
    group.appendChild(door)
  }

  const title = svgElement(document, 'title', {})
  title.textContent = `${mappedRoom.name} · ${mappedRoom.code} · ${mappedRoom.assets.length} assets`
  group.prepend(title)

  if (width >= 145 && height >= 92) {
    const code = svgElement(document, 'text', {
      class: 'svg-room-code',
      x: String(x + 18),
      y: String(y + 30),
    })
    code.textContent = mappedRoom.code || `ROOM ${String(index + 1).padStart(2, '0')}`
    group.appendChild(code)

    if (width >= 230 && height >= 130) {
      const maxCharacters = Math.max(12, Math.floor(width / 17))
      const roomLabel = mappedRoom.name.length > maxCharacters ? `${mappedRoom.name.slice(0, maxCharacters - 1)}…` : mappedRoom.name
      const name = svgElement(document, 'text', {
        class: 'svg-room-name',
        x: String(x + 18),
        y: String(y + 58),
      })
      name.textContent = roomLabel
      group.appendChild(name)
    }
  }

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

function RoomEquipmentDialog({ room, floor, onClose }: { room: Room; floor: number; onClose: () => void }) {
  const [filter, setFilter] = useState<EquipmentFilter>('All')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(room.assets[0]?.id ?? null)
  const selectedAsset = room.assets.find(assetItem => assetItem.id === selectedAssetId) ?? room.assets[0]
  const filters: EquipmentFilter[] = ['All', 'Computer', 'Printer', 'Monitor']
  const filteredAssets = filter === 'All' ? room.assets : room.assets.filter(assetItem => assetItem.kind === filter)
  const counts = room.assets.reduce<Record<Asset['kind'], number>>((result, assetItem) => {
    result[assetItem.kind] += 1
    return result
  }, { Computer: 0, Printer: 0, Monitor: 0 })
  const computers = room.assets.filter(assetItem => assetItem.kind === 'Computer')
  const computerPositions = [
    { left: '18%', top: '26%' }, { left: '61%', top: '23%' },
    { left: '27%', top: '62%' }, { left: '70%', top: '61%' },
    { left: '45%', top: '43%' }, { left: '83%', top: '39%' },
  ]

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const chooseFilter = (nextFilter: EquipmentFilter) => {
    setFilter(nextFilter)
    const first = nextFilter === 'All' ? room.assets[0] : room.assets.find(assetItem => assetItem.kind === nextFilter)
    setSelectedAssetId(first?.id ?? null)
  }

  return <div className="equipment-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="equipment-dialog" role="dialog" aria-modal="true" aria-labelledby="equipment-dialog-title">
      <header className="equipment-dialog-header">
        <div><span>FLOOR {floor} · ROOM {room.code}</span><h2 id="equipment-dialog-title">{room.name}</h2><p>{room.department} · Select equipment to view its details.</p></div>
        <button type="button" className="equipment-dialog-close" aria-label="Close equipment popup" onClick={onClose}>×</button>
      </header>
      <div className="equipment-summary-strip">
        <div><span>Total equipment</span><b>{room.assets.length}</b></div>
        <div><span className="equipment-kind-icon computer">▣</span><span>Computers</span><b>{counts.Computer}</b></div>
        <div><span className="equipment-kind-icon printer">▤</span><span>Printers</span><b>{counts.Printer}</b></div>
        <div><span className="equipment-kind-icon monitor">▱</span><span>Monitors</span><b>{counts.Monitor}</b></div>
      </div>
      {room.assets.length === 0 ? <div className="equipment-empty"><span>▣</span><h3>No equipment assigned</h3><p>This room does not currently have registered computers or equipment.</p><button type="button">＋ Assign equipment</button></div> : <div className="room-focus-layout">
        <section className="room-focus-visual" aria-label={`2D view of ${room.name}`}>
          <div className="room-focus-heading"><div><span>2D ROOM VIEW</span><h3>{room.name}</h3></div><strong>{computers.length} PC{computers.length === 1 ? '' : 's'}</strong></div>
          <div className="room-focus-plan">
            <div className="room-focus-grid" />
            <div className="room-focus-desk desk-a" /><div className="room-focus-desk desk-b" /><div className="room-focus-desk desk-c" />
            <div className="room-focus-door"><i /></div>
            {computers.map((computer, index) => {
              const position = computerPositions[index % computerPositions.length]
              return <button
                type="button"
                key={computer.id}
                className={`room-pc-marker ${computer.id === selectedAsset?.id ? 'selected' : ''} ${statusClass(computer.status)}`}
                style={position}
                aria-label={`View ${computer.id}, ${computer.detail}`}
                onClick={() => { setFilter('Computer'); setSelectedAssetId(computer.id) }}
              ><span className="room-pc-screen"><i /></span><b>{computer.id}</b><small>{computer.detail}</small></button>
            })}
            {!computers.length && <div className="room-focus-no-pc"><span>▣</span><b>No computers assigned</b><small>Other equipment is listed in the details panel.</small></div>}
          </div>
          <div className="room-focus-legend"><span><i className="active" />Active</span><span><i className="maintenance" />Maintenance</span><span>Click a PC icon to inspect it</span></div>
        </section>
        <section className="room-focus-details">
          <div className="room-focus-details-heading"><div><span>ASSIGNED EQUIPMENT</span><h3>Devices and models</h3></div><b>{room.assets.length}</b></div>
          <div className="equipment-filter-tabs" aria-label="Filter room equipment">
            {filters.map(item => <button type="button" key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => chooseFilter(item)}>{item === 'All' ? `All ${room.assets.length}` : `${item}s ${counts[item]}`}</button>)}
          </div>
          <div className="room-focus-device-list" aria-label="Equipment in this room">
            {filteredAssets.length ? filteredAssets.map(assetItem => <button type="button" key={assetItem.id} className={assetItem.id === selectedAsset?.id ? 'selected' : ''} onClick={() => setSelectedAssetId(assetItem.id)}>
              <span className={`equipment-list-icon ${assetItem.kind.toLowerCase()}`}>{assetItem.kind === 'Printer' ? '▤' : assetItem.kind === 'Monitor' ? '▱' : '▣'}</span>
              <span><b>{assetItem.id}</b><small>{assetItem.detail}</small></span>
              <i className={`dot ${statusClass(assetItem.status)}`} />
            </button>) : <p className="equipment-filter-empty">No {filter.toLowerCase()}s assigned to this room.</p>}
          </div>
          {selectedAsset && <article className="room-focus-selected">
            <div className="room-focus-selected-heading"><div><small>SELECTED EQUIPMENT</small><h3>{selectedAsset.id}</h3><p>{selectedAsset.detail}</p></div><em className={statusClass(selectedAsset.status)}><i />{selectedAsset.status}</em></div>
            <div className="room-focus-selected-grid"><Detail label="Type" value={selectedAsset.kind} /><Detail label="Model" value={selectedAsset.detail} /><Detail label="Department" value={room.department} />{selectedAsset.ip && <Detail label="IP address" value={selectedAsset.ip} />}</div>
          </article>}
        </section>
      </div>}
    </section>
  </div>
}

function RoomView({ room, floor, onBack, onAsset }: { room:Room;floor:number;onBack:()=>void;onAsset:(id:string)=>void }) {
  const counts = room.assets.reduce<Record<string, number>>((result, asset) => ({ ...result, [asset.kind]: (result[asset.kind] ?? 0) + 1 }), {})
  return <section className="workspace room-workspace">
    <div className="page-heading room-heading"><div><button className="back" onClick={onBack}>← Floor {floor} map</button><span className="eyebrow">ROOM {room.code} / FLOOR {floor}</span><h1>{room.name}</h1><p>{room.assets.length} assets assigned · {room.department}</p></div><button className="primary-action">＋ Assign item</button></div>
    <div className="room-category-strip"><div><span>Total assets</span><b>{room.assets.length}</b></div>{(['Computer', 'Printer', 'Monitor'] as const).map(kind => <div key={kind}><span>{kind}s</span><b>{counts[kind] ?? 0}</b></div>)}<div><span>Room code</span><b>{room.code}</b></div></div>
    <div className="room-stage"><div className="room-plan"><div className="room-grid"/><div className="plan-title">{room.name}<small>Interactive asset placement · hover or click a marker</small></div><div className="desk desk-one"/><div className="desk desk-two"/><div className="desk desk-three"/>{room.assets.map((item,index) => <button key={item.id} className={`asset-pin pin-${index} ${statusClass(item.status)}`} onClick={() => onAsset(item.id)}><span>{item.kind === 'Printer' ? '▤' : item.kind === 'Monitor' ? '▱' : '▣'}</span><b>{item.id}</b><small>{item.detail}</small></button>)}</div><div className="room-side"><h3>Assets in this room</h3><p className="muted">Select an item to view its details, network data, and assignment history.</p>{room.assets.map(asset => <button className="asset-list-item" key={asset.id} onClick={() => onAsset(asset.id)}><span className={`asset-kind ${statusClass(asset.status)}`}>{asset.kind === 'Printer' ? '▤' : asset.kind === 'Monitor' ? '▱' : '▣'}</span><span><b>{asset.id}</b><small>{asset.detail}</small></span><i>→</i></button>)}<button className="outline-full">＋ Assign item to this room</button></div></div>
  </section>
}

function AssetView({ room, floor, asset, onBack }: {room:Room;floor:number;asset:Asset;onBack:()=>void}) { return <section className="workspace"><div className="page-heading asset-heading"><div><button className="back" onClick={onBack}>← {room.name}</button><span className="eyebrow">ASSET DETAILS</span><h1>{asset.id} <em className={statusClass(asset.status)}>{asset.status}</em></h1><p>{asset.detail} · {asset.kind}</p></div><button className="primary-action">Edit asset</button></div><div className="asset-detail-grid"><div className="asset-hero"><div className={`asset-illustration ${asset.kind.toLowerCase()}`}>{asset.kind === 'Printer' ? '▤' : asset.kind === 'Monitor' ? '▱' : '▣'}</div><h2>{asset.id}</h2><p>{asset.detail}</p><div className="qr-card"><div className="fake-qr">▦</div><span><b>QR asset label</b><small>Scan to view or reassign</small></span><button>⌄</button></div></div><div className="detail-card"><div className="tabs"><b>Details</b><span>Specifications</span><span>History</span></div><div className="details"><Detail label="Category" value={asset.kind} /><Detail label="Status" value={asset.status} dot={asset.status}/><Detail label="Assigned to" value={`Floor ${floor} / ${room.name}`} /><Detail label="Asset tag" value={asset.id} /><Detail label="Brand" value="Dell" /><Detail label="Model" value={asset.detail.replace('Dell ', '')} />{asset.ip && <><Detail label="IPv4 address" value={asset.ip} /><Detail label="Hostname" value="HOSP-MEDREC-034" /><Detail label="Address method" value="DHCP reservation" /></>}</div></div></div></section> }
function Detail({label,value,dot}:{label:string;value:string;dot?:Status}) { return <div className="detail"><span>{label}</span><b>{dot && <i className={`dot ${statusClass(dot)}`}/>} {value}</b></div> }
