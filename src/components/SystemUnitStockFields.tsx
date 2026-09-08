import { useEffect } from 'react'
import { consumableCapacityGb } from '../lib/consumable-capacity'
import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { ConsumableRepository } from '../lib/repositories'
import type { DeviceRegistrationData } from '../lib/schemas'
import type { InventoryAsset } from '../lib/types'

export function stockChanges(data: DeviceRegistrationData, asset?: InventoryAsset): Partial<InventoryAsset> {
  const system = data.category === 'System Unit'
  const result: Partial<InventoryAsset> = {}
  for (const kind of ['ram', 'ssd'] as const) {
    const source = kind === 'ram' ? 'ramReceiptId' : 'ssdReceiptId'
    const count = kind === 'ram' ? 'ramModules' : 'ssdCount'
    const disposition = kind === 'ram' ? 'returnRamToStock' : 'returnSsdToStock'
    const nextSource = system && Number(data[count]) > 0 ? data[source] || null : null
    const removed = asset?.[source] && (nextSource !== asset[source] || Number(data[count]) < (asset[count] || 0))
    if (removed && !data[disposition]) throw new Error(`Choose whether to return removed ${kind.toUpperCase()} to stock or keep it used/discarded.`)
    // Don't send new schema columns for unrelated, unlinked devices.
    if (nextSource || asset?.[source] || data[source]) result[source] = nextSource
    if (removed) result[disposition] = data[disposition] === 'return'
  }
  return result
}

export function SystemUnitStockFields({ form, asset, disabled }: { form: UseFormReturn<DeviceRegistrationData>; asset?: InventoryAsset; disabled: boolean }) {
  const { register, watch, setValue, formState: { errors } } = form
  const system = watch('category') === 'System Unit'
  const stock = useQuery({ queryKey: ['consumable-receipts'], queryFn: ConsumableRepository.getAll, enabled: system || Boolean(asset?.ramReceiptId || asset?.ssdReceiptId), retry: 1, refetchInterval: 15000 })
  const ramSource = watch('ramReceiptId')
  const ssdSource = watch('ssdReceiptId')
  useEffect(() => {
    if (!system || disabled || !stock.data) return
    for (const [source, field] of [[ramSource, 'ramCapacityGb'], [ssdSource, 'ssdCapacityGb']] as const) {
      const receipt = stock.data.find(row => row.id === source)
      if (!receipt) continue
      const capacity = consumableCapacityGb(receipt)
      const value = capacity ? String(capacity) : ''
      if (form.getValues(field) !== value) setValue(field, value, { shouldValidate: true })
    }
  }, [system, disabled, stock.data, ramSource, ssdSource, form, setValue])
  if (!system && !asset?.ramReceiptId && !asset?.ssdReceiptId) return null
  return <section className="system-stock-fields wide" aria-label="RAM and SSD consumable stock">
    <h3>Memory and storage</h3>
    <p>Choose the RAM and SSD from available consumables, then enter how many are installed. Stock is deducted when you save.</p>
    {stock.isPending && <p role="status">Loading available stock…</p>}
    {stock.isError && <p role="alert">Stock could not be loaded. <button type="button" onClick={() => void stock.refetch()}>Retry stock</button></p>}
    {stock.data?.some(row => row.usedQuantity === undefined) && <p role="alert">Stock linking setup is pending. Apply the system unit consumables database migration to enable stock selection.</p>}
    <div className="device-form-grid">
      {(['ram', 'ssd'] as const).map(kind => {
        const source = kind === 'ram' ? 'ramReceiptId' : 'ssdReceiptId'
        const count = kind === 'ram' ? 'ramModules' : 'ssdCount'
        const capacity = kind === 'ram' ? 'ramCapacityGb' : 'ssdCapacityGb'
        const disposition = kind === 'ram' ? 'returnRamToStock' : 'returnSsdToStock'
        const selected = watch(source) || ''
        const quantity = Number(watch(count) || 0)
        const previousSource = asset?.[source]
        const previousCount = asset?.[count] || 0
        const existingParts = !previousSource && previousCount > 0
        const capacityValue = Number(watch(capacity) || 0)
        const removed = previousSource ? (!system || selected !== previousSource ? previousCount : Math.max(previousCount - quantity, 0)) : 0
        const options = (stock.data || []).filter(row => row.category === kind.toUpperCase() && row.unit === 'pieces')
        const receipt = options.find(row => row.id === selected)
        const additional = selected === previousSource ? Math.max(quantity - previousCount, 0) : quantity
        return <div className="stock-part" key={kind}>
          {system && <>
            <h4>{kind.toUpperCase()}</h4>
            <div className="stock-selection-row">
              <label>{kind.toUpperCase()} from Consumables<select aria-label={`${kind.toUpperCase()} stock source`} value={selected} disabled={disabled || stock.isPending || stock.isError} onChange={event => {
                const row = options.find(item => item.id === event.target.value)
                setValue(source, event.target.value, { shouldValidate: true })
                setValue(disposition, '')
                if (row) {
                  setValue(capacity, String(consumableCapacityGb(row) || ''), { shouldValidate: true })
                  if (quantity < 1) setValue(count, '1', { shouldValidate: true })
                } else {
                  setValue(capacity, existingParts ? String(asset?.[capacity] || 0) : '0', { shouldValidate: true })
                  setValue(count, existingParts ? String(previousCount) : '0', { shouldValidate: true })
                }
              }}><option value="">{existingParts ? 'Keep existing installed parts' : `No ${kind.toUpperCase()} installed`}</option>{selected && !receipt && <option value={selected}>Current linked receipt (unavailable)</option>}{options.map(row => <option key={row.id} value={row.id} disabled={!consumableCapacityGb(row) || row.usedQuantity === undefined || ((row.quantity - row.usedQuantity <= 0) && row.id !== previousSource)}>{row.itemName} · {row.specification} · {row.quantity - (row.usedQuantity || 0)} available · {row.dateReceived}{row.referenceNumber ? ` · ${row.referenceNumber}` : ''}{!consumableCapacityGb(row) ? ' · Capacity not recorded' : ''}</option>)}</select></label>
              <label>{kind === 'ram' ? 'RAM modules installed' : 'SSDs installed'}<input type="number" min="0" step="1" readOnly={!selected && !existingParts} {...register(count)} disabled={disabled} />{errors[count] && <span className="field-error">{errors[count]?.message}</span>}</label>
            </div>
            <input type="hidden" {...register(capacity)} />
            {receipt && !consumableCapacityGb(receipt) && <p className="field-error" role="alert">This consumable has no clear capacity recorded. Choose an item with a capacity in its Consumables record.</p>}
            {selected && <p className="stock-capacity-summary">{capacityValue > 0 ? `${quantity} × ${capacityValue} GB = ${quantity * capacityValue} GB total` : 'Capacity not yet recorded'}</p>}
            {!selected && existingParts && <p>Existing configuration: {quantity} × {capacityValue} GB. No consumable stock deduction.</p>}
            {receipt && <p><b>{receipt.itemName} · {receipt.specification}</b><br />{receipt.quantity - (receipt.usedQuantity || 0)} available · {additional} additional {kind === 'ram' ? 'module(s)' : 'drive(s)'} will be deducted.</p>}
            {receipt && additional > receipt.quantity - (receipt.usedQuantity || 0) && <p className="field-error" role="alert">Not enough {kind.toUpperCase()} stock. Reduce the installed quantity or select another receipt.</p>}
            {!stock.isPending && !stock.isError && !options.length && <p>No {kind.toUpperCase()} receipts in pieces yet. Receive stock in Consumables first.</p>}
          </>}
          {removed > 0 && <label>{removed} {kind.toUpperCase()} removed — stock action<select aria-label={`${kind.toUpperCase()} removed stock action`} {...register(disposition)} required disabled={disabled}><option value="">Choose what happens to the removed parts</option><option value="return">Return usable parts to available stock</option><option value="discard">Keep counted as used / discarded</option></select></label>}
        </div>
      })}
    </div>
  </section>
}
