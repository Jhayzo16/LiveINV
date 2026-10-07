import type { ImageSourcePropType } from 'react-native'
export const equipmentImages: Record<string, ImageSourcePropType> = {
  'System Unit': require('../assets/device-system-unit.png'), Printer: require('../assets/device-printer.png'),
  Monitor: require('../assets/device-monitor.png'), Keyboard: require('../assets/device-keyboard.png'),
  UPS: require('../assets/device-ups.png'), Scanner: require('../assets/device-scanner.png'), Router: require('../assets/device-router.png'),
}
export const logo = require('../assets/liveinv-logo.png')
export const roomIconImages: Record<string, ImageSourcePropType> = {
  'System Unit': require('../assets/room-icons/system-unit.png'), Printer: require('../assets/room-icons/printer.png'),
  Monitor: require('../assets/room-icons/monitor.png'), Keyboard: require('../assets/room-icons/keyboard.png'),
  UPS: require('../assets/room-icons/ups.png'), Scanner: require('../assets/room-icons/scanner.png'), Router: require('../assets/room-icons/router.png'),
}
export const watermark = require('../assets/asset-card-logo.png')
export const fonts = { body: 'Jakarta', medium: 'JakartaMedium', bold: 'JakartaBold', title: 'MontserratBold', heavy: 'MontserratExtraBold' }
