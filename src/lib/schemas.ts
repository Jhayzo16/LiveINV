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
  ramCapacityGb: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a number' }),
  ramModules: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a number' }),
  ssdCapacityGb: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a number' }),
  ssdCount: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a number' })
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
  floor: z.string().min(1, 'Floor is required'),
  department: z.string().min(1, 'Department is required'),
  room: z.string().min(1, 'Room is required'),
})

export type DeviceAssignmentData = z.infer<typeof deviceAssignmentSchema>
