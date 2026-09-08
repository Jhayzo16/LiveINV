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
  const { register, watch, setValue } = form
  const system = watch('category') === 'System Unit'
  const stock = useQuery({ queryKey: ['consumable-receipts'], queryFn: ConsumableRepository.getAll, enabled: system || Boolean(asset?.ramReceiptId || asset?.ssdReceiptId), retry: 1, refetchInterval: 15000 })
  if (!system && !asset?.ramReceiptId && !asset?.ssdReceiptId) return null
  return <section className="system-stock-fields wide" aria-label="RAM and SSD consumable stock">
    <h3>RAM and SSD from consumables</h3>
    <p>Select the receipt supplying the installed parts. Saving deducts the installed quantity from that receipt. Use existing parts for equipment already installed outside this stock.</p>
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
        const removed = previousSource ? (!system || selected !== previousSource ? previousCount : Math.max(previousCount - quantity, 0)) : 0
        const options = (stock.data || []).filter(row => row.category === kind.toUpperCase() && row.unit === 'pieces')
        const receipt = options.find(row => row.id === selected)
        const additional = selected === previousSource ? Math.max(quantity - previousCount, 0) : quantity
        return <div className="stock-part" key={kind}>
          {system && <>
            <label>{kind.toUpperCase()} stock source<select aria-label={`${kind.toUpperCase()} stock source`} value={selected} disabled={disabled || stock.isPending || stock.isError} onChange={event => {
              const row = options.find(item => item.id === event.target.value)
              setValue(source, event.target.value, { shouldValidate: true })
              setValue(disposition, '')
              if (row?.capacityGb) setValue(capacity, String(row.capacityGb), { shouldValidate: true })
            }}><option value="">Existing parts / no stock deduction</option>{selected && !receipt && <option value={selected}>Current linked receipt (unavailable)</option>}{options.map(row => <option key={row.id} value={row.id} disabled={row.usedQuantity === undefined || ((row.quantity - row.usedQuantity <= 0) && row.id !== previousSource)}>{row.itemName} · {row.specification} · {row.quantity - (row.usedQuantity || 0)} available · {row.dateReceived}{row.referenceNumber ? ` · ${row.referenceNumber}` : ''}</option>)}</select></label>
            {receipt && <p><b>{receipt.itemName} · {receipt.specification}</b><br />{receipt.quantity - (receipt.usedQuantity || 0)} available · {additional} additional {kind === 'ram' ? 'module(s)' : 'drive(s)'} will be deducted.{receipt.capacityGb ? ` Capacity: ${receipt.capacityGb} GB each.` : ' Confirm the capacity per part matches its specification.'}</p>}
            {receipt && additional > receipt.quantity - (receipt.usedQuantity || 0) && <p className="field-error" role="alert">Not enough {kind.toUpperCase()} stock. Reduce the installed quantity or select another receipt.</p>}
            {!stock.isPending && !stock.isError && !options.length && <p>No {kind.toUpperCase()} receipts in pieces yet. Receive stock in Consumables first.</p>}
          </>}
          {removed > 0 && <label>{removed} {kind.toUpperCase()} removed — stock action<select aria-label={`${kind.toUpperCase()} removed stock action`} {...register(disposition)} required disabled={disabled}><option value="">Choose what happens to the removed parts</option><option value="return">Return usable parts to available stock</option><option value="discard">Keep counted as used / discarded</option></select></label>}
        </div>
      })}
    </div>
  </section>
}
