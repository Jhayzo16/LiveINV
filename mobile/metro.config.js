const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
// Fiber's native entry uses require(), while geometry addons use import.
// Resolve both to one Three instance so native loader patches apply consistently.
const threeEntry = require.resolve('three')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeEntry }
  return context.resolveRequest(context, moduleName, platform)
}
module.exports = config
