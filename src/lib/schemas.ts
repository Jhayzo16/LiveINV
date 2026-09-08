import { z } from 'zod'
import { DeviceCategory, AssetState } from './types'

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/

export const deviceRegistrationSchema = z.object({
  tag: z.string().min(1, 'Asset tag is required'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  status: z.string().min(1, 'Status is required'),
  ip: z.string().optional().refine(val => !val || val === '—' || ipRegex.test(val), { message: 'Invalid IP address' }),
  processor: z.string().optional(),
  ramReceiptId: z.string().optional(),
  ssdReceiptId: z.string().optional(),
  returnRamToStock: z.enum(['', 'return', 'discard']).optional(),
  returnSsdToStock: z.enum(['', 'return', 'discard']).optional(),
  ramCapacityGb: z.string().optional().refine(val => !val || (Number.isInteger(Number(val)) && Number(val) >= 0), { message: 'Enter a non-negative whole number' }),
  ramModules: z.string().optional().refine(val => !val || (Number.isInteger(Number(val)) && Number(val) >= 0), { message: 'Enter a non-negative whole number' }),
  ssdCapacityGb: z.string().optional().refine(val => !val || (Number.isInteger(Number(val)) && Number(val) >= 0), { message: 'Enter a non-negative whole number' }),
  ssdCount: z.string().optional().refine(val => !val || (Number.isInteger(Number(val)) && Number(val) >= 0), { message: 'Enter a non-negative whole number' })
}).superRefine((data, ctx) => {
  if (data.category === 'System Unit') {
    if (!data.processor) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Processor is required for System Units', path: ['processor'] })
    if (!data.ramCapacityGb) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RAM capacity is required', path: ['ramCapacityGb'] })
    if (!data.ramModules) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RAM modules is required', path: ['ramModules'] })
    if (!data.ssdCapacityGb) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SSD capacity is required', path: ['ssdCapacityGb'] })
    if (!data.ssdCount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SSD count is required', path: ['ssdCount'] })
  }
})

export type DeviceRegistrationData = z.infer<typeof deviceRegistrationSchema>

export const deviceAssignmentSchema = z.object({
  floor: z.string().min(1, 'Select a floor'),
  locationKey: z.string().min(1, 'Select a room or office'),
})

export type DeviceAssignmentData = z.infer<typeof deviceAssignmentSchema>

const consumableCategories = ['RAM', 'SSD', 'HDD', 'Network Cable', 'Ink / Toner', 'Battery', 'Other'] as const

export const consumableReceiptSchema = z.object({
  category: z.enum(consumableCategories),
  itemName: z.string().trim().min(2, 'Item name is required').max(120, 'Keep the item name under 120 characters'),
  brand: z.string().trim().max(80, 'Keep the brand under 80 characters').optional(),
  specification: z.string().trim().min(2, 'Specification or description is required').max(240, 'Keep the specification under 240 characters'),
  capacityGb: z.string().optional().refine(value => !value || (Number.isInteger(Number(value)) && Number(value) > 0), 'Enter capacity as a positive whole number in GB'),
  quantity: z.string().trim().min(1, 'Quantity is required').refine(value => Number.isInteger(Number(value)) && Number(value) > 0, 'Enter a positive whole number'),
  unit: z.string().trim().min(1, 'Unit is required').max(30, 'Keep the unit under 30 characters'),
  supplier: z.string().trim().max(120, 'Keep the supplier under 120 characters').optional(),
  referenceNumber: z.string().trim().max(80, 'Keep the reference number under 80 characters').optional(),
  dateReceived: z.string().min(1, 'Date received is required').refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00`)), 'Enter a valid received date'),
  receivedBy: z.string().trim().max(120, 'Keep the receiver name under 120 characters').optional(),
  notes: z.string().trim().max(1000, 'Keep notes under 1,000 characters').optional(),
})

export type ConsumableReceiptData = z.infer<typeof consumableReceiptSchema>
