import { describe, expect, it } from 'vitest'
import { consumableCapacityGb } from './consumable-capacity'

const capacity = (specification: string, itemName = 'Stock item', capacityGb?: number) => consumableCapacityGb({ specification, itemName, capacityGb })
describe('capacity from consumable records', () => {
  it.each([['16 gb', 16], ['8GB DDR4', 8], ['S800 256GB', 256], ['DDR4 3200 MHz 16GB', 16], ['2 x 8GB DDR4', 8], ['1 TB SSD', 1000], ['0.5TB', 500]])('reads %s without asking for capacity again', (text, expected) => {
    expect(capacity(text)).toBe(expected)
  })
  it('uses the explicit capacity before descriptive text', () => { expect(capacity('16GB DDR4', 'RAM', 8)).toBe(8) })
  it('can use the item name if the specification has no capacity', () => { expect(capacity('DDR4 3200MHz', 'Kingston 16GB')).toBe(16) })
  it.each(['DDR4 3200 MHz', 'S800', '16GB / 32GB', '16GB (2 x 8GB)', '0GB', '-8GB', '3200Mbps'])('does not invent capacity from %s', text => {
    expect(capacity(text)).toBeUndefined()
  })
})
