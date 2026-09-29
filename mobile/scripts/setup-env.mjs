import { readFile, writeFile, access } from 'node:fs/promises'
const output = new URL('../.env', import.meta.url)
try { await access(output); console.log('mobile/.env already exists; kept its configuration.'); process.exit(0) } catch {}
const source = await readFile(new URL('../../.env', import.meta.url), 'utf8')
const values = {}
for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/)
  if (match) values[match[1]] = match[2]
}
if (!values.VITE_SUPABASE_URL || !values.VITE_SUPABASE_ANON_KEY) throw new Error('The web app .env must contain its public Supabase URL and anon key.')
await writeFile(output, `EXPO_PUBLIC_SUPABASE_URL=${values.VITE_SUPABASE_URL}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${values.VITE_SUPABASE_ANON_KEY}\n`, { flag: 'wx' })
console.log('Copied only the public Supabase configuration to ignored mobile/.env. No credentials were printed.')
