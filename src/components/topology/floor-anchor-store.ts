import type { FloorAnchorSnapshot } from './topology-types'

export type FloorAnchorStore = ReturnType<typeof createFloorAnchorStore>

export function createFloorAnchorStore() {
  let snapshot: FloorAnchorSnapshot = {}
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update: (next: FloorAnchorSnapshot) => {
      snapshot = next
      listeners.forEach(listener => listener())
    },
  }
}

