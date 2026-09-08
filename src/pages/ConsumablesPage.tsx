import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ConsumableRepository } from '../lib/repositories'
import { consumableReceiptSchema, type ConsumableReceiptData } from '../lib/schemas'
import type { ConsumableCategory, ConsumableReceipt } from '../lib/types'
import { EquipmentEmptyState } from '../components/ui/equipment-empty-state'
import '../consumables.css'

const categories: ConsumableCategory[] = ['RAM', 'SSD', 'HDD', 'Network Cable', 'Ink / Toner', 'Battery', 'Other']
const today = () => new Date().toISOString().slice(0, 10)

const formatDate = (value: string) => new Intl.DateTimeFormat('en-PH', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00Z`))

const escapeCsv = (value: string | number | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function ConsumablesPage() {
  const queryClient = useQueryClient()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | ConsumableCategory>('all')
  const [successMessage, setSuccessMessage] = useState('')

  const receiptsQuery = useQuery({
    queryKey: ['consumable-receipts'],
    queryFn: () => ConsumableRepository.getAll(),
    retry: 1,
    refetchInterval: 15000,
  })
  const movementsQuery = useQuery({ queryKey: ['consumable-movements'], queryFn: ConsumableRepository.movements, retry: 1, refetchInterval: 15000 })

  const saveMutation = useMutation({
    mutationFn: (receipt: Omit<ConsumableReceipt, 'id' | 'createdAt'>) => ConsumableRepository.save(receipt),
    onSuccess: savedReceipt => {
      queryClient.setQueryData<ConsumableReceipt[]>(['consumable-receipts'], current => [savedReceipt, ...(current || [])])
      setSuccessMessage(`${savedReceipt.quantity} ${savedReceipt.unit} of ${savedReceipt.itemName} recorded as received.`)
      setReceiptOpen(false)
    },
  })

  const receipts = receiptsQuery.data || []
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleReceipts = useMemo(() => receipts.filter(receipt => {
    if (categoryFilter !== 'all' && receipt.category !== categoryFilter) return false
    if (!normalizedSearch) return true
    return [receipt.category, receipt.itemName, receipt.brand, receipt.specification, receipt.supplier, receipt.referenceNumber, receipt.receivedBy, receipt.notes]
      .filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch)
  }), [categoryFilter, normalizedSearch, receipts])

  const currentMonth = today().slice(0, 7)
  const totalUnits = receipts.reduce((sum, receipt) => sum + receipt.quantity, 0)
  const receivedThisMonth = receipts.filter(receipt => receipt.dateReceived.startsWith(currentMonth)).reduce((sum, receipt) => sum + receipt.quantity, 0)
  const ramUnits = receipts.filter(receipt => receipt.category === 'RAM').reduce((sum, receipt) => sum + receipt.quantity - (receipt.usedQuantity || 0), 0)
  const storageUnits = receipts.filter(receipt => receipt.category === 'SSD' || receipt.category === 'HDD').reduce((sum, receipt) => sum + receipt.quantity - (receipt.usedQuantity || 0), 0)
  const stockReady = !receiptsQuery.isPending && !receiptsQuery.isError && receipts.every(receipt => receipt.usedQuantity !== undefined)
  const visibleMovements = (movementsQuery.data || []).filter(movement => {
    const receipt = receipts.find(row => row.id === movement.receipt_id)
    return (categoryFilter === 'all' || movement.category === categoryFilter) && (!normalizedSearch || [movement.asset_tag, movement.category, movement.action, receipt?.itemName, receipt?.specification].join(' ').toLowerCase().includes(normalizedSearch))
  })

  const exportReceipts = () => {
    const header = ['Date received', 'Category', 'Item name', 'Brand', 'Specification', 'Quantity received', 'Used / installed', 'Available', 'Unit', 'Supplier', 'Reference number', 'Received by', 'Notes']
    const rows = visibleReceipts.map(receipt => [receipt.dateReceived, receipt.category, receipt.itemName, receipt.brand, receipt.specification, receipt.quantity, receipt.usedQuantity, receipt.usedQuantity === undefined ? undefined : receipt.quantity - receipt.usedQuantity, receipt.unit, receipt.supplier, receipt.referenceNumber, receipt.receivedBy, receipt.notes])
    const csv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `liveinv-consumable-receipts-${today()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <>
    <header className="consumables-heading">
      <div><span className="eyebrow">STOCK RECEIVING</span><h1>Consumables</h1><p>Track received supplies, available stock, and RAM or SSD parts used in system units.</p></div>
      <div className="consumables-heading-actions"><button type="button" className="export-btn" onClick={exportReceipts} disabled={!visibleReceipts.length}>Export</button><button type="button" className="primary-action" onClick={() => { setSuccessMessage(''); setReceiptOpen(true) }}>＋ Record received stock</button></div>
    </header>

    <div className="consumable-metric-grid">
      <ConsumableMetric label="Total units received" value={totalUnits} note={`${receipts.length} receipt record${receipts.length === 1 ? '' : 's'}`} tone="green" />
      <ConsumableMetric label="Received this month" value={receivedThisMonth} note={new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date())} tone="maroon" />
      <ConsumableMetric label="RAM available" value={stockReady ? ramUnits : "—"} note="After system unit usage" />
      <ConsumableMetric label="Storage available" value={stockReady ? storageUnits : "—"} note="SSD and HDD remaining" tone="amber" />
    </div>

    <aside className="consumable-assignment-note" aria-label="Consumables assignment rule"><span aria-hidden="true">ⓘ</span><div><b>RAM and SSD stock linked to system units</b><p>Choose a stock source when adding or editing a system unit. Installed quantities reduce available stock. When removing parts, choose to return usable parts or keep them counted as used/discarded. Supplies do not have their own QR asset tags or room assignments.</p></div></aside>
    {successMessage && <p className="consumable-success" role="status">✓ {successMessage}</p>}

    <section className="module-card consumable-registry" aria-label="Consumable receiving history">
      <div className="consumable-toolbar">
        <label className="search-field">⌕ <input aria-label="Search consumable receipts" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search item, specification, supplier, or reference" /></label>
        <label className="consumable-filter">Category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as 'all' | ConsumableCategory)}><option value="all">All categories</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        <span className="consumable-result-count">{visibleReceipts.length} record{visibleReceipts.length === 1 ? '' : 's'}</span>
      </div>

      {receiptsQuery.isLoading ? <div className="consumable-state"><span>◌</span><h3>Loading received stock</h3><p>Getting the latest consumable receipt records.</p></div>
        : receiptsQuery.isError ? <div className="consumable-state error"><span>!</span><h3>Consumables could not be loaded</h3><p>{receiptsQuery.error instanceof Error && receiptsQuery.error.message.includes('consumable_receipts') ? 'Apply the consumable receipts Supabase migration, then try again.' : 'Check the Supabase connection and your access permission, then retry.'}</p><button type="button" className="primary-action" onClick={() => receiptsQuery.refetch()}>Retry</button></div>
        : visibleReceipts.length ? <div className="consumable-table" role="table" aria-label="Consumable receipt records">
          <div className="consumable-row consumable-row-head" role="row"><span>Date received</span><span>Item and specification</span><span>Stock balance</span><span>Supplier / reference</span><span>Received by</span></div>
          {visibleReceipts.map(receipt => <article className="consumable-row" role="row" key={receipt.id}>
            <time dateTime={receipt.dateReceived}>{formatDate(receipt.dateReceived)}</time>
            <div className="consumable-item"><span className={`consumable-category category-${receipt.category.toLowerCase().replaceAll(' ', '-').replaceAll('/', '')}`}>{receipt.category}</span><b>{receipt.itemName}</b><small>{[receipt.brand, receipt.specification].filter(Boolean).join(' · ')}</small>{receipt.notes && <em>{receipt.notes}</em>}</div>
            <div className="consumable-balance"><b>{receipt.usedQuantity === undefined ? "—" : receipt.quantity - receipt.usedQuantity} available</b><small>{receipt.quantity} {receipt.unit} received</small><small>{receipt.usedQuantity ?? "—"} used / installed</small></div>
            <div><b>{receipt.supplier || 'Not recorded'}</b><small>{receipt.referenceNumber || 'No reference number'}</small></div>
            <span>{receipt.receivedBy || 'Not recorded'}</span>
          </article>)}
        </div> : <EquipmentEmptyState className="consumable-state" kind="Keyboard" title={normalizedSearch || categoryFilter !== 'all' ? 'No matching receipt records' : 'No consumables recorded yet'} description={normalizedSearch || categoryFilter !== 'all' ? 'Change the search or selected category.' : 'Select “Record received stock” when RAM, SSDs, or other supplies arrive.'} />}
    </section>

    <section className="module-card consumable-usage" aria-label="Consumable usage history">
      <h2>System unit stock usage</h2><p>Installed, returned, and removed parts, with the system unit recorded for each change.</p>
      {movementsQuery.isPending ? <p role="status">Loading stock usage…</p> : movementsQuery.isError ? <p role="alert">{movementsQuery.error.message} <button className="export-btn" type="button" onClick={() => void movementsQuery.refetch()}>Retry usage</button></p> : visibleMovements.length ? <div className="consumable-usage-list">{visibleMovements.map(movement => <article key={movement.id}>
        <div><b>{movement.asset_tag}</b><small>{receipts.find(row => row.id === movement.receipt_id)?.itemName || movement.category}</small></div>
        <div><b>{movement.action}</b><small>{movement.quantity} {movement.category} {movement.quantity === 1 ? 'piece' : 'pieces'}</small></div>
        <time dateTime={movement.created_at}>{new Date(movement.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
      </article>)}</div> : <p>No stock usage matching the current filters.</p>}
    </section>

    {receiptOpen && <ConsumableReceiptDialog onClose={() => setReceiptOpen(false)} onSave={async receipt => { await saveMutation.mutateAsync(receipt) }} />}
  </>
}

function ConsumableMetric({ label, value, note, tone = '' }: { label: string; value: number | string; note: string; tone?: string }) {
  return <article className={`consumable-metric ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small></article>
}

function ConsumableReceiptDialog({ onClose, onSave }: { onClose: () => void; onSave: (receipt: Omit<ConsumableReceipt, 'id' | 'createdAt'>) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { register, handleSubmit, watch, formState: { errors, isValid } } = useForm<ConsumableReceiptData>({
    resolver: zodResolver(consumableReceiptSchema),
    mode: 'onChange',
    defaultValues: { category: 'RAM', itemName: '', brand: '', specification: '', capacityGb: '', quantity: '1', unit: 'pieces', supplier: '', referenceNumber: '', dateReceived: today(), receivedBy: '', notes: '' },
  })

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  const submit = async (data: ConsumableReceiptData) => {
    setSaving(true)
    setSaveError('')
    try {
      await onSave({
        category: data.category,
        itemName: data.itemName.trim(),
        specification: data.specification.trim(),
        quantity: Number(data.quantity),
        ...(['RAM', 'SSD'].includes(data.category) && data.capacityGb ? { capacityGb: Number(data.capacityGb) } : {}),
        unit: data.unit.trim(),
        dateReceived: data.dateReceived,
        ...(data.brand?.trim() ? { brand: data.brand.trim() } : {}),
        ...(data.supplier?.trim() ? { supplier: data.supplier.trim() } : {}),
        ...(data.referenceNumber?.trim() ? { referenceNumber: data.referenceNumber.trim() } : {}),
        ...(data.receivedBy?.trim() ? { receivedBy: data.receivedBy.trim() } : {}),
        ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The received stock could not be recorded. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="device-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="device-dialog consumable-dialog" role="dialog" aria-modal="true" aria-labelledby="consumable-receipt-title">
      <header className="device-dialog-header"><div><span>CONSUMABLE RECEIPT</span><h2 id="consumable-receipt-title">Record received stock</h2><p>Save what arrived and its receiving information. RAM and SSD pieces can be installed in system units.</p></div><button type="button" aria-label="Close consumable receipt" onClick={onClose} disabled={saving}>×</button></header>
      <form className="device-form" onSubmit={handleSubmit(submit)}>
        <div className="device-form-grid consumable-form-grid">
          <label>Consumable type<select {...register('category')}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select>{errors.category && <span className="field-error">{errors.category.message}</span>}</label>
          <label>Item name<input {...register('itemName')} placeholder="e.g. Kingston Fury RAM" />{errors.itemName && <span className="field-error">{errors.itemName.message}</span>}</label>
          <label>Brand <small>Optional</small><input {...register('brand')} placeholder="e.g. Kingston, Samsung" />{errors.brand && <span className="field-error">{errors.brand.message}</span>}</label>
          <label>Specification / description<input {...register('specification')} placeholder="e.g. 16 GB DDR4 3200 MHz" />{errors.specification && <span className="field-error">{errors.specification.message}</span>}</label>
          {['RAM', 'SSD'].includes(watch('category')) && <label>Capacity per piece (GB) <small>Optional; fills asset specifications</small><input type="number" min="1" step="1" {...register('capacityGb')} placeholder="e.g. 16 for RAM or 512 for SSD" />{errors.capacityGb && <span className="field-error">{errors.capacityGb.message}</span>}</label>}
          <label>Quantity received<input type="number" min="1" step="1" {...register('quantity')} />{errors.quantity && <span className="field-error">{errors.quantity.message}</span>}</label>
          <label>Unit<select {...register('unit')}><option>pieces</option><option>boxes</option><option>packs</option><option>rolls</option><option>bottles</option></select>{errors.unit && <span className="field-error">{errors.unit.message}</span>}</label>
          <label>Date received<input type="date" max={today()} {...register('dateReceived')} />{errors.dateReceived && <span className="field-error">{errors.dateReceived.message}</span>}</label>
          <label>Received by <small>Optional</small><input {...register('receivedBy')} placeholder="Staff member's name" />{errors.receivedBy && <span className="field-error">{errors.receivedBy.message}</span>}</label>
          <label>Supplier <small>Optional</small><input {...register('supplier')} placeholder="Supplier or vendor" />{errors.supplier && <span className="field-error">{errors.supplier.message}</span>}</label>
          <label>Reference number <small>Optional</small><input {...register('referenceNumber')} placeholder="Delivery receipt / PO number" />{errors.referenceNumber && <span className="field-error">{errors.referenceNumber.message}</span>}</label>
          <label className="wide">Notes <small>Optional</small><textarea {...register('notes')} rows={3} placeholder="Condition received, batch, warranty, or other details" />{errors.notes && <span className="field-error">{errors.notes.message}</span>}</label>
        </div>
        <aside className="consumable-dialog-note"><span>ⓘ</span><p>For RAM and SSD, receive stock in pieces to make it available in system unit forms. Boxes and packs must be counted as individual pieces before they can be used.</p></aside>
        {saveError && <p className="consumable-save-error" role="alert">{saveError}</p>}
        <footer className="device-form-actions"><button type="button" className="export-btn" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={!isValid || saving}>{saving ? 'Recording…' : 'Record received stock'}</button></footer>
      </form>
    </section>
  </div>
}
