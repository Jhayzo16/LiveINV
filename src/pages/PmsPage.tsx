import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { PmsRepository, localDate, formatPmsDate, type PmsSession, type PmsRecord, type PmsService } from '../lib/pms'
import type { InventoryAsset } from '../lib/types'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import '../pms.css'

export function PmsIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" /><path d="m17 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" /></svg>
}

export function PmsPage({ inventoryAssets }: { inventoryAssets: InventoryAsset[] }) {
  const queryClient = useQueryClient()
  const sessionsQuery = useQuery({ queryKey: ['pms-sessions'], queryFn: PmsRepository.sessions, retry: 1, refetchInterval: 15000 })
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const detailRef = useRef<HTMLDivElement>(null)
  const [detailRequest, setDetailRequest] = useState(0)
  useEffect(() => {
    if (!detailRequest) return
    detailRef.current?.focus({ preventScroll: true })
    detailRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [detailRequest])
  const sessions = sessionsQuery.data ?? []
  const selected = sessions.find(session => session.id === selectedId) ?? sessions.find(session => !session.completed_at) ?? sessions[0]
  const visible = sessions.filter(session => [session.technician, session.service_date, session.service_type, session.notes].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  const formVisible = creating || (!sessionsQuery.isPending && !sessionsQuery.isError && sessions.length === 0)
  const saved = (session: PmsSession) => {
    queryClient.setQueryData<PmsSession[]>(['pms-sessions'], current => [session, ...(current ?? []).filter(row => row.id !== session.id)])
    setSelectedId(session.id)
    setCreating(false)
  }

  return <div className="pms-module">
    <header className="pms-heading"><div><span className="eyebrow">HOSPITAL IT DEPARTMENT</span><h1>PMS</h1><p>Preventive Maintenance Service</p><small>Record preventive maintenance and general cleaning for registered IT assets.</small></div><button type="button" className="primary-action" disabled={busy || sessionsQuery.isPending || sessionsQuery.isError || formVisible} onClick={() => setCreating(true)}>＋ New PMS session</button></header>
    <div className="pms-metrics"><article><PmsIcon /><span>Open sessions</span><b>{sessionsQuery.isError ? '—' : sessions.filter(session => !session.completed_at).length}</b></article><article><span>Completed sessions</span><b>{sessionsQuery.isError ? '—' : sessions.filter(session => session.completed_at).length}</b></article><article><span>Registered assets</span><b>{inventoryAssets.length}</b><small>Available for PMS scanning</small></article></div>
    {sessionsQuery.isPending ? <p className="pms-state" role="status">Loading PMS sessions…</p> : sessionsQuery.isError ? <div className="pms-state pms-error" role="alert"><h2>PMS could not be loaded</h2><p>{sessionsQuery.error.message}</p><button type="button" className="export-btn" onClick={() => void sessionsQuery.refetch()}>Retry PMS</button></div> : <>
      {formVisible && <PmsSessionForm onSaved={saved} onBusy={setBusy} onCancel={sessions.length ? () => setCreating(false) : undefined} />}
      {sessions.length > 0 && !formVisible && <div className="pms-layout">
        <aside className="pms-sessions" aria-label="PMS session history"><h2>Session history</h2><p className="pms-history-help">Select a session to view its details and maintained assets.</p><label>Find a session<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Date, technician, or service" /></label><div className="pms-session-list">{visible.length ? visible.map(session => <button type="button" key={session.id} disabled={busy} className={selected?.id === session.id ? 'selected' : ''} aria-pressed={selected?.id === session.id} aria-controls="pms-session-view" onClick={() => { setSelectedId(session.id); setDetailRequest(value => value + 1) }}><span className={`pms-badge ${session.completed_at ? 'completed' : ''}`}>{session.completed_at ? 'Completed' : 'Open'}</span><b>{formatPmsDate(session.service_date)}</b><span>{session.service_type}</span><small>{session.technician}</small><span className="pms-view-session">View session details →</span></button>) : <p className="pms-state">No matching sessions.</p>}</div></aside>
        {selected && <div id="pms-session-view" className="pms-session-view" ref={detailRef} tabIndex={-1}><PmsSessionDetail key={selected.id} session={selected} inventoryAssets={inventoryAssets} onBusy={setBusy} onCompleted={saved} /></div>}
      </div>}
    </>}
  </div>
}

function PmsSessionForm({ onSaved, onBusy, onCancel }: { onSaved: (session: PmsSession) => void; onBusy: (busy: boolean) => void; onCancel?: () => void }) {
  const [date, setDate] = useState(localDate)
  const [service, setService] = useState<PmsService>('Preventive maintenance')
  const [technician, setTechnician] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const request = useRef<{ signature: string; id: string } | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true); onBusy(true); setError('')
    const signature = JSON.stringify([date, service, technician.trim(), notes.trim()])
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }
    try {
      const session = await PmsRepository.create({ id: request.current.id, date, service, technician, notes })
      onSaved(session)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Session could not be created. Please retry.') }
    finally { inFlight.current = false; setSaving(false); onBusy(false) }
  }
  return <section className="pms-new-session" aria-labelledby="new-pms-title"><div><h2 id="new-pms-title">Start a PMS session</h2><p>Choose the date the work is performed. Each scanned asset will be recorded under this session.</p></div><form onSubmit={submit}><fieldset disabled={saving}><div className="pms-form-grid"><label>Maintenance date<input type="date" min="1900-01-01" max="9999-12-31" required value={date} onChange={event => setDate(event.target.value)} /></label><label>Service<select aria-label="Service" value={service} onChange={event => setService(event.target.value as PmsService)}><option>Preventive maintenance</option><option>General cleaning</option></select></label><label>IT personnel / technician<input required maxLength={120} value={technician} onChange={event => setTechnician(event.target.value)} placeholder="Name of person or team performing the work" /></label><label>Session notes <small>Optional</small><input maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="e.g. Floor 2 workstation cleaning" /></label></div><div className="pms-actions">{onCancel && <button type="button" className="export-btn" onClick={onCancel}>Cancel</button>}<button className="primary-action" type="submit" disabled={!technician.trim()}>{saving ? 'Starting session…' : 'Start session'}</button></div></fieldset>{error && <p className="pms-error" role="alert">{error}</p>}</form></section>
}

function PmsSessionDetail({ session, inventoryAssets, onBusy, onCompleted }: { session: PmsSession; inventoryAssets: InventoryAsset[]; onBusy: (busy: boolean) => void; onCompleted: (session: PmsSession) => void }) {
  const queryClient = useQueryClient()
  const recordsQuery = useQuery({ queryKey: ['pms-records', session.id], queryFn: () => PmsRepository.records(session.id), retry: 1, refetchInterval: 15000 })
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const busyRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const records = recordsQuery.data ?? []
  const closed = Boolean(session.completed_at)
  const filtered = records.filter(record => [record.asset_tag, record.qr_id, record.asset_name, record.location, record.department].join(' ').toLowerCase().includes(search.trim().toLowerCase()))

  const mark = async (rawCode: string, method: 'qr' | 'manual') => {
    if (!rawCode.trim() || busyRef.current || closed) return
    busyRef.current = true; setSaving(true); onBusy(true); setScanning(false); setMessage(''); setError('')
    try {
      const result = await PmsRepository.mark(session.id, rawCode, method)
      await queryClient.cancelQueries({ queryKey: ['pms-records', session.id] })
      queryClient.setQueryData<PmsRecord[]>(['pms-records', session.id], current => [result.record, ...(current ?? []).filter(record => record.id !== result.record.id)])
      setMessage(result.already_recorded ? `${result.record.asset_tag} was already maintained in this session. No duplicate was added.` : `${result.record.asset_tag} marked maintained for ${formatPmsDate(session.service_date)}.`)
      setCode('')
      void queryClient.invalidateQueries({ queryKey: ['pms-records', session.id] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Maintenance could not be saved. Please retry.')
      void queryClient.invalidateQueries({ queryKey: ['pms-sessions'] })
    } finally { busyRef.current = false; setSaving(false); onBusy(false); inputRef.current?.focus() }
  }
  const markRef = useRef(mark)
  markRef.current = mark

  useEffect(() => {
    if (!scanning || closed || !videoRef.current) return
    let disposed = false
    let detected = false
    let controls: IScannerControls | undefined
    const reader = new BrowserQRCodeReader()
    reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
      if (!disposed && !detected && result) {
        detected = true
        void markRef.current(result.getText(), 'qr')
      }
    }).then(started => { if (disposed) started.stop(); else controls = started }).catch(() => {
      if (!disposed) { setScanning(false); setError('Camera access is unavailable. Enter the QR number or asset tag below to record the completed work.') }
    })
    return () => { disposed = true; controls?.stop() }
  }, [scanning, closed])

  const complete = async () => {
    if (busyRef.current) return
    busyRef.current = true; setSaving(true); onBusy(true); setError(''); setScanning(false)
    try { onCompleted(await PmsRepository.complete(session.id)); setConfirmComplete(false); setMessage('PMS session completed. Its maintenance records are saved.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Session could not be completed. Please retry.') }
    finally { busyRef.current = false; setSaving(false); onBusy(false) }
  }

  return <section className="pms-session-detail" aria-label="Current PMS session">
    <header className="pms-session-heading"><div><span className={`pms-badge ${closed ? 'completed' : ''}`}>{closed ? 'Completed' : 'Open session'}</span><h2>{session.service_type}</h2><p><time dateTime={session.service_date}>{formatPmsDate(session.service_date)}</time> · {session.technician}</p></div><div className="pms-count"><b>{recordsQuery.isPending || recordsQuery.isError ? '—' : records.length}</b><span>Assets maintained</span></div></header>
    <section className="pms-session-summary" aria-labelledby="pms-session-summary-title">
      <h3 id="pms-session-summary-title">Session details</h3>
      <dl className="pms-detail-grid">
        <div><dt>Maintenance date</dt><dd>{formatPmsDate(session.service_date)}</dd></div>
        <div><dt>IT personnel / technician</dt><dd>{session.technician}</dd></div>
        <div><dt>Created on</dt><dd><PmsTimestamp value={session.created_at} /></dd></div>
        <div><dt>Completed on</dt><dd>{session.completed_at ? <PmsTimestamp value={session.completed_at} /> : 'Session still open'}</dd></div>
        <div className="pms-detail-wide"><dt>Session notes</dt><dd>{session.notes || 'No notes recorded.'}</dd></div>
      </dl>
    </section>
    {!closed && <section className="pms-scan" aria-label="Record maintained asset"><div><h3>Scan after maintenance</h3><p>A recognized asset is automatically marked maintained for this session. Scan only after its service or cleaning is finished.</p></div><button type="button" className="primary-action" disabled={saving || confirmComplete} onClick={() => { setError(''); setScanning(value => !value) }}>{scanning ? 'Stop camera' : 'Scan asset QR'}</button>{scanning && <video className="pms-camera" ref={videoRef} autoPlay muted playsInline aria-label="PMS QR camera" />}<form onSubmit={event => { event.preventDefault(); void mark(code, 'manual') }}><label>QR number or asset tag<input ref={inputRef} list="pms-asset-tags" value={code} onChange={event => setCode(event.target.value)} disabled={saving || scanning || confirmComplete} maxLength={256} placeholder="Scan with a handheld reader or type a code" required /></label><datalist id="pms-asset-tags">{inventoryAssets.map(asset => <option key={asset.tag} value={asset.tag}>{asset.name} · {asset.location}</option>)}</datalist><button type="submit" className="export-btn" disabled={saving || scanning || confirmComplete || !code.trim()}>{saving ? 'Saving…' : 'Mark maintained'}</button></form></section>}
    {message && <p className="pms-success" role="status">{message}</p>}
    {error && !confirmComplete && <p className="pms-error" role="alert">{error}</p>}
    {closed && <p className="pms-closed-note">This session is complete. Start a new session for additional maintenance.</p>}
    <div className="pms-record-toolbar"><h3>Maintained assets</h3><label>Search maintained assets<input type="search" placeholder="Asset, QR number, or room" value={search} onChange={event => { setSearch(event.target.value); setExpandedRecordId(null) }} /></label></div>
    {recordsQuery.isPending ? <p className="pms-state" role="status">Loading maintenance records…</p> : recordsQuery.isError ? <div className="pms-state pms-error" role="alert"><p>{recordsQuery.error.message}</p><button type="button" className="export-btn" onClick={() => void recordsQuery.refetch()}>Retry records</button></div> : filtered.length ? <div className="pms-table-wrap"><table className="pms-table"><thead><tr><th>Asset / QR number</th><th>Location at service</th><th>Recorded</th><th>Status</th><th>Record</th></tr></thead><tbody>{filtered.map(record => <Fragment key={record.id}>
      <tr><td data-label="Asset / QR number"><b>{record.asset_tag}</b><span>{record.asset_name}</span><small>{record.qr_id} · {record.category}</small></td><td data-label="Location at service"><b>{record.location}</b><small>{record.department}</small></td><td data-label="Recorded"><PmsTimestamp value={record.recorded_at} /><small>{record.method === 'qr' ? 'QR scan' : 'Code entry'}</small></td><td data-label="Status"><span className="pms-badge completed">Maintained</span></td><td data-label="Record"><button type="button" className="pms-record-toggle" aria-label={`${expandedRecordId === record.id ? 'Hide' : 'View'} record for ${record.asset_tag}`} aria-expanded={expandedRecordId === record.id} aria-controls={`pms-record-${record.id}`} onClick={() => setExpandedRecordId(current => current === record.id ? null : record.id)}>{expandedRecordId === record.id ? 'Hide record' : 'View record'}</button></td></tr>
      {expandedRecordId === record.id && <tr className="pms-expanded-record"><td colSpan={5}><section id={`pms-record-${record.id}`} aria-label={`Maintenance record for ${record.asset_tag}`}>
        <h3>Maintenance record · {record.asset_tag}</h3>
        <p>Asset information saved at the time of service.</p>
        <dl className="pms-detail-grid">
          <div><dt>Asset tag</dt><dd>{record.asset_tag}</dd></div>
          <div><dt>Asset name</dt><dd>{record.asset_name}</dd></div>
          <div><dt>QR number</dt><dd>{record.qr_id}</dd></div>
          <div><dt>Category</dt><dd>{record.category}</dd></div>
          <div><dt>Location at service</dt><dd>{record.location || 'Not recorded'}</dd></div>
          <div><dt>Department at service</dt><dd>{record.department || 'Not recorded'}</dd></div>
          <div><dt>Service</dt><dd>{session.service_type}</dd></div>
          <div><dt>Maintenance date</dt><dd>{formatPmsDate(session.service_date)}</dd></div>
          <div><dt>IT personnel / technician</dt><dd>{session.technician}</dd></div>
          <div><dt>Recorded on</dt><dd><PmsTimestamp value={record.recorded_at} /></dd></div>
          <div><dt>Recording method</dt><dd>{record.method === 'qr' ? 'QR scan' : 'Code entry'}</dd></div>
          <div><dt>Status</dt><dd><span className="pms-badge completed">Maintained</span></dd></div>
        </dl>
      </section></td></tr>}
    </Fragment>)}</tbody></table></div> : <div className="pms-state"><PmsIcon /><h3>{search ? 'No matching assets' : 'No assets maintained yet'}</h3><p>{search ? 'Try another asset tag, QR number, or room.' : closed ? 'No maintained assets were recorded in this session.' : 'Scan an asset after maintenance to add its record here.'}</p></div>}
    {!closed && <footer className="pms-session-footer"><p>You can leave this session open and resume it from Session history.</p><button type="button" className="primary-action" disabled={saving || recordsQuery.isPending || recordsQuery.isError || !records.length} onClick={() => { setError(''); setScanning(false); setConfirmComplete(true) }}>Complete session</button></footer>}
    <AlertDialog open={confirmComplete} onOpenChange={open => { if (!busyRef.current) setConfirmComplete(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Complete this PMS session?</AlertDialogTitle><AlertDialogDescription>{records.length} asset{records.length === 1 ? '' : 's'} recorded for {formatPmsDate(session.service_date)}. The history will be kept, and no more assets can be added to this session.</AlertDialogDescription></AlertDialogHeader>{error && <p className="pms-error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={saving} /><AlertDialogAction disabled={saving} onClick={event => { event.preventDefault(); void complete() }}>{saving ? 'Completing…' : 'Confirm completion'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}

function PmsTimestamp({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
}
