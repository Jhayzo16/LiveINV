import { describe, expect, it } from 'vitest'
import { matchesWordPrefix } from '../src/search'

describe('word-prefix search', () => {
  it('narrows matches as the user types from the start of a word', () => {
    const rooms = ['Radiology', 'Radiation therapy', 'Laboratory']
    expect(rooms.filter(room => matchesWordPrefix('rad', room))).toEqual(['Radiology', 'Radiation therapy'])
    expect(rooms.filter(room => matchesWordPrefix('radio', room))).toEqual(['Radiology'])
    expect(rooms.filter(room => matchesWordPrefix('adi', room))).toEqual([])
  })
  it('matches later words and partial phrases, ignoring case and extra spaces', () => {
    expect(matchesWordPrefix(' dep ', 'IT DEPARTMENT')).toBe(true)
    expect(matchesWordPrefix(' system   u ', 'HP System Unit')).toBe(true)
    expect(matchesWordPrefix('nit', 'System Unit')).toBe(false)
    expect(matchesWordPrefix('system p', 'HP System Unit')).toBe(false)
  })
  it('keeps tag separators, IP addresses, dates and punctuation searchable literally', () => {
    expect(matchesWordPrefix('fra', 'UNIT_FRANCIS')).toBe(true)
    expect(matchesWordPrefix('liv-12', 'LIV-123456')).toBe(true)
    expect(matchesWordPrefix('192.168.', '192.168.100.1')).toBe(true)
    expect(matchesWordPrefix('192.168.', '192x168x100x1')).toBe(false)
    expect(matchesWordPrefix('2026-10', '2026-10-07')).toBe(true)
    expect(matchesWordPrefix('room (a', 'Room (A)')).toBe(true)
    expect(matchesWordPrefix('.*', 'Monitor')).toBe(false)
  })
  it('supports Unicode word boundaries', () => {
    expect(matchesWordPrefix('ñu', 'Ñuñez')).toBe(true)
    expect(matchesWordPrefix('uñez', 'Ñuñez')).toBe(false)
  })
  it('handles empty queries and missing fields without matching across separate fields', () => {
    expect(matchesWordPrefix('  ', null, undefined)).toBe(true)
    expect(matchesWordPrefix('mon', undefined, null, 'Monitor')).toBe(true)
    expect(matchesWordPrefix('mon', null, undefined)).toBe(false)
    expect(matchesWordPrefix('unit ground', 'System Unit', 'Ground Floor')).toBe(false)
  })
})
