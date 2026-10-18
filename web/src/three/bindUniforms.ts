import type * as THREE from 'three'

/**
 * R3F 9.x copies each uniform when `uniforms={...}` is passed to <shaderMaterial>,
 * so per-frame writes to number uniforms (uTime, uPresence…) never reach the GPU.
 * Use as `ref={bindUniforms(u)}` next to `uniforms={u}`: once the material exists
 * it points back at our object, and `u.uTime.value = t` works as expected.
 */
export function bindUniforms(uniforms: Record<string, THREE.IUniform>) {
  return (material: THREE.ShaderMaterial | null) => {
    if (material && material.uniforms !== uniforms) material.uniforms = uniforms
  }
}
