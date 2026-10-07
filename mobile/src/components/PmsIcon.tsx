import Svg, { Path } from 'react-native-svg'

// Exact paths and stroke treatment from the web app's PmsIcon.
export function PmsIcon({ color = '#FFF', size = 24 }: { color?: string; size?: number }) {
  return <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" />
    <Path d="m17 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
  </Svg>
}
