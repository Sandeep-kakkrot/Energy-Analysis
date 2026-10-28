/**
 * Utility formatters for the energy dashboard.
 */

/** Format kWh with unit */
export const fmtKwh = (value, decimals = 1) => {
  if (value == null) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)} MWh`
  if (value >= 1_000)     return `${(value / 1_000).toFixed(decimals)} MWh`
  return `${Number(value).toFixed(decimals)} kWh`
}

/** Format a large number with commas */
export const fmtNumber = (value) => {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-IN')
}

/** Format percentage */
export const fmtPct = (value, decimals = 1) => {
  if (value == null) return '—'
  return `${Number(value).toFixed(decimals)}%`
}

/** Format hour as AM/PM label */
export const fmtHour = (hour) => {
  if (hour == null) return '—'
  const h = Number(hour)
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

/** Day of week label */
export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month label from month number */
export const MONTH_LABELS = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Building type → display label */
export const BUILDING_LABELS = {
  classroom:  'Classroom Block',
  laboratory: 'Laboratory Block',
  library:    'Central Library',
  hostel:     'Hostel Complex',
}

/** Building → color (matches Recharts palette) */
export const BUILDING_COLORS = {
  'Classroom Block A':  '#00c8f0',
  'Laboratory Block B': '#f59e0b',
  'Central Library':    '#a78bfa',
  'Hostel Complex':     '#34d399',
}

/** Severity → color class */
export const SEVERITY_COLORS = {
  high:   { bg: 'bg-danger-500/10',  text: 'text-danger-400',  border: 'border-danger-500/30'  },
  medium: { bg: 'bg-accent-500/10',  text: 'text-accent-400',  border: 'border-accent-500/30'  },
  low:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
}
