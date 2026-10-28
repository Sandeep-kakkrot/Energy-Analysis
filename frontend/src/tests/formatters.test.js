import { describe, it, expect } from 'vitest'
import {
  fmtKwh, fmtNumber, fmtPct, fmtHour,
  DOW_LABELS, MONTH_LABELS, BUILDING_LABELS, SEVERITY_COLORS
} from '../utils/formatters'

describe('Formatters Utility', () => {
  it('formats kWh values correctly with MWh scaling', () => {
    expect(fmtKwh(1234.5678)).toBe('1.2 MWh')
    expect(fmtKwh(500)).toBe('500.0 kWh')
    expect(fmtKwh(1500000)).toBe('1.5 MWh')
    expect(fmtKwh(null)).toBe('—')
  })

  it('formats numbers with thousand separators', () => {
    expect(fmtNumber(25000)).toBe('25,000')
    expect(fmtNumber(null)).toBe('—')
  })

  it('formats percentage values correctly', () => {
    expect(fmtPct(15.11)).toBe('15.1%')
    expect(fmtPct(0)).toBe('0.0%')
    expect(fmtPct(null)).toBe('—')
  })

  it('formats 24-hour integers to 12-hour AM/PM labels', () => {
    expect(fmtHour(0)).toBe('12 AM')
    expect(fmtHour(8)).toBe('8 AM')
    expect(fmtHour(12)).toBe('12 PM')
    expect(fmtHour(14)).toBe('2 PM')
    expect(fmtHour(23)).toBe('11 PM')
    expect(fmtHour(null)).toBe('—')
  })

  it('maps day of week and month numbers to labels', () => {
    expect(DOW_LABELS[0]).toBe('Mon')
    expect(DOW_LABELS[6]).toBe('Sun')
    expect(MONTH_LABELS[1]).toBe('Jan')
    expect(MONTH_LABELS[12]).toBe('Dec')
  })

  it('maps building types and severity colors', () => {
    expect(BUILDING_LABELS.classroom).toBe('Classroom Block')
    expect(SEVERITY_COLORS.high.text).toBe('text-danger-400')
    expect(SEVERITY_COLORS.low.text).toBe('text-emerald-400')
  })
})
