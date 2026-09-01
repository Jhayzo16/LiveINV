import { describe, it, expect } from 'vitest'
import { deviceRegistrationSchema } from './schemas'

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
