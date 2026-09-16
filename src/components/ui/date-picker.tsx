import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

type DatePickerProps = {
  id: string
  value: string
  onChange: (date: string) => void
  disabled?: boolean
}

export function DatePicker({ id, value, onChange, disabled = false }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  // Parse and format as a local calendar date so UTC conversion cannot shift the day.
  const date = value ? parseISO(value) : undefined
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger id={id} disabled={disabled} render={<Button variant="outline" data-empty={!date} className="ui-date-picker-trigger">
      {date ? format(date, 'PPP') : <span>Pick a date</span>}
      <ChevronDownIcon size={16} data-icon="inline-end" aria-hidden="true" />
    </Button>} />
    <PopoverContent align="start" aria-label="Choose maintenance date" initialFocus={false}>
      <Calendar mode="single" selected={date} defaultMonth={date} required autoFocus
        startMonth={new Date(1900, 0)} endMonth={new Date(9999, 11)}
        disabled={{ before: new Date(1900, 0, 1), after: new Date(9999, 11, 31) }}
        onSelect={selected => { onChange(format(selected, 'yyyy-MM-dd')); setOpen(false) }} />
    </PopoverContent>
  </Popover>
}
