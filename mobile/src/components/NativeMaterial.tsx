import type { ThreeElements } from '@react-three/fiber/native'
import { ShaderChunk, type MeshStandardMaterial } from 'three'

// Some Android OpenGL drivers warn about Three's unused dispersion member on
// standard materials. Initialize it explicitly without changing their appearance.
const initializeMaterial: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_physical_fragment>',
    ShaderChunk.lights_physical_fragment.replace('PhysicalMaterial material;', 'PhysicalMaterial material;\nmaterial.dispersion = 0.0;'),
  )
}
export function NativeMaterial(props: ThreeElements['meshStandardMaterial']) {
  return <meshStandardMaterial {...props} onBeforeCompile={initializeMaterial} customProgramCacheKey={() => 'liveinv-native-standard-v1'} />
}
