import { describe, it, expect } from 'vitest'
import { consumableReceiptSchema, deviceRegistrationSchema } from './schemas'

describe('deviceRegistrationSchema', () => {
  it('validates a correct system unit', () => {
    const validData = {
      tag: 'PC-TEST-01',
      category: 'System Unit',
      brand: 'Dell',
      model: 'OptiPlex',
      status: 'Active',
      ip: '10.20.1.1',
      processor: 'Intel i5',
      ramCapacityGb: '8',
      ramModules: '2',
      ssdCapacityGb: '512',
      ssdCount: '1'
    }
    const result = deviceRegistrationSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('fails when a system unit is missing required specs', () => {
    const invalidData = {
      tag: 'PC-TEST-02',
      category: 'System Unit',
      brand: 'Dell',
      model: 'OptiPlex',
      status: 'Active',
    }
    const result = deviceRegistrationSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const errorMap = result.error.format()
      expect(errorMap.processor?._errors).toBeDefined()
      expect(errorMap.ramCapacityGb?._errors).toBeDefined()
    }
  })

  it('validates a printer without system specs', () => {
    const validData = {
      tag: 'PRN-01',
      category: 'Printer',
      brand: 'HP',
      model: 'LaserJet',
      status: 'Active'
    }
    const result = deviceRegistrationSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})

describe('consumableReceiptSchema', () => {
  const validReceipt = {
    category: 'RAM',
    itemName: 'Kingston Fury RAM',
    brand: 'Kingston',
    specification: '16 GB DDR4 3200 MHz',
    quantity: '12',
    unit: 'pieces',
    supplier: 'QA Supplier',
    referenceNumber: 'DR-2026-001',
    dateReceived: '2026-09-02',
    receivedBy: 'Inventory Staff',
    notes: 'Received in good condition',
  }

  it('validates a complete consumable receipt', () => {
    expect(consumableReceiptSchema.safeParse(validReceipt).success).toBe(true)
  })

  it('rejects zero, negative, and fractional quantities', () => {
    expect(consumableReceiptSchema.safeParse({ ...validReceipt, quantity: '0' }).success).toBe(false)
    expect(consumableReceiptSchema.safeParse({ ...validReceipt, quantity: '-2' }).success).toBe(false)
    expect(consumableReceiptSchema.safeParse({ ...validReceipt, quantity: '1.5' }).success).toBe(false)
  })

  it('requires receipt information but does not contain assignment fields', () => {
    const result = consumableReceiptSchema.safeParse({ ...validReceipt, specification: '', dateReceived: '' })
    expect(result.success).toBe(false)
    expect('floor' in consumableReceiptSchema.shape).toBe(false)
    expect('room' in consumableReceiptSchema.shape).toBe(false)
    expect('department' in consumableReceiptSchema.shape).toBe(false)
  })
})
