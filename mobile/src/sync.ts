import type { AssetRow, PendingChange } from './domain'
import { patchMatches } from './domain'

export type SyncRemote = {
  update: (change: PendingChange) => Promise<AssetRow | null>;
  get: (id: string) => Promise<AssetRow | null>;
}
export async function applyChange(remote: SyncRemote, userId: string, change: PendingChange) {
  if (change.userId !== userId) throw new Error('This change belongs to another account.')
  const saved = await remote.update(change)
  if (saved) return { status: 'saved' as const, row: saved }
  // Handles a previous successful write whose response was lost, without a second write.
  const current = await remote.get(change.assetId)
  if (current && patchMatches(current, change.patch)) return { status: 'saved' as const, row: current }
  return { status: 'conflict' as const, row: current }
}
