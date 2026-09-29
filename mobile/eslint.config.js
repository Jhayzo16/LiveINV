const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
module.exports = defineConfig([
  expoConfig,
  { files: ['src/components/HospitalModel.tsx', 'src/components/RoundedBox.tsx', 'src/components/NativeMaterial.tsx'], rules: { 'react/no-unknown-property': 'off' } },
  { ignores: ['src/shared/**', 'dist/**', 'scripts/**', 'tests/**'] },
])
