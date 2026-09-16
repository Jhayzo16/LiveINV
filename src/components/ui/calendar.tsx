import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'
import './date-picker.css'

export function Calendar({ className, showOutsideDays = true, ...props }: DayPickerProps) {
  return <DayPicker showOutsideDays={showOutsideDays} className={cn('ui-calendar', className)} {...props} />
}
