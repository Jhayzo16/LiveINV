export const nightMap = {
  background: '#102B24', surface: '#19392F', button: '#29473A',
  border: '#486051', room: '#294B3D', outline: '#739783',
  text: '#F1F6EE', muted: '#AEC5B7', accent: '#D4E9CB',
  label: '#DBE9DE', assigned: '#ADD29D', selected: '#D5F2C7', card: '#F1F6EE',
}

// Recolor the original vector artwork, never rebuild or reposition its rooms.
// Retaining every other byte also preserves outlined labels and SVG transforms.
export function nightFloorXml(xml: string): string {
  const palette: Record<string, string> = {
    '#1e1e1e': nightMap.background, '#ffffff': nightMap.background,
    white: nightMap.background, '#d9d9d9': nightMap.room,
    black: nightMap.label,
  }
  return xml.replace(/\bfill="([^"]+)"/g, (attribute, value: string) =>
    palette[value.toLowerCase()] ? `fill="${palette[value.toLowerCase()]}"` : attribute)
}
