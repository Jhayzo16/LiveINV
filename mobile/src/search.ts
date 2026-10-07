const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

// Match a word/phrase prefix, including words after spaces or tag separators.
// Keep punctuation literal so QR numbers, IP addresses and dates still work.
export function matchesWordPrefix(query: string, ...fields: (string | null | undefined)[]): boolean {
  const search = normalize(query)
  if (!search) return true
  const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${literal}`, 'u')
  return fields.some(field => field != null && pattern.test(normalize(field)))
}
