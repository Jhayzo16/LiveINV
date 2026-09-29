import type { ConsumableReceipt } from './types'

// Prefer the capacity saved on the receipt. Older receipts keep it in their
// specification (e.g. "16 gb", "8GB DDR4", or "S800 256GB").
export function consumableCapacityGb(receipt: Pick<ConsumableReceipt, 'capacityGb' | 'specification' | 'itemName'>): number | undefined {
  if (Number.isInteger(receipt.capacityGb) && receipt.capacityGb! > 0) return receipt.capacityGb
  for (const text of [receipt.specification, receipt.itemName]) {
    const matches = [...text.matchAll(/(?<![\w.+-])(\d+(?:\.\d+)?)\s*(GB|TB)\b/gi)]
    if (!matches.length) continue
    const capacities = new Set(matches.map(match => Number(match[1]) * (match[2].toUpperCase() === 'TB' ? 1000 : 1)))
    if (capacities.size !== 1) return undefined
    const capacity = [...capacities][0]
    return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : undefined
  }
  return undefined
}
