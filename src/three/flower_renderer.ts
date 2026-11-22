import * as THREE from 'three'
import type { DesignScheme, FlowerMaterial } from '@/types'
import { F_FLAG_REMOVED, F_FLAG_UNREACHABLE, FLOWER_STRIDE, OPENNESS_BUCKETS } from '@/core/constants'
import { buildTemplateGeometry, templateOf } from './flowers'

export interface InstanceSource {
  nodeId: string
  zoneId: string
  flowerIndex: number
}

interface BucketEntry {
  key: string
  template: string
  bucket: number
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
  sources: InstanceSource[]
}

export interface RenderStats {
  drawCalls: number
  instances: number
  templates: number
}

// 全方案花朵统一进实例化网格，渲染数据与核算数据同源
export class FlowerRenderer {
  readonly group = new THREE.Group()
  private meshes: THREE.InstancedMesh[] = []
  private stats: RenderStats = { drawCalls: 0, instances: 0, templates: 0 }

  clear(): void {
    for (const mesh of this.meshes) {
      mesh.dispose()
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.meshes = []
    this.group.clear()
  }

  getStats(): RenderStats {
    return this.stats
  }

  build(scheme: DesignScheme, materialMap: Map<string, FlowerMaterial>): void {
    this.clear()
    const buckets = new Map<string, BucketEntry>()
    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const white = new THREE.Color(0xffffff)

    for (const node of scheme.structures) {
      const nodeMatrix = new THREE.Matrix4().makeRotationY(node.rotationY)
      nodeMatrix.setPosition(node.position[0], node.position[1], node.position[2])
      for (const zone of node.zones) {
        const buffer = zone.flowerData
        if (!buffer) continue
        for (let i = 0; i < buffer.count; i++) {
          const base = i * FLOWER_STRIDE
          const flags = buffer.data[base + 11]
          if (flags & F_FLAG_REMOVED) continue

          const materialId = buffer.materialIds[buffer.data[base + 9]]
          const material = materialMap.get(materialId)
          if (!material) continue
          const template = templateOf(materialId)
          const bucket = buffer.data[base + 8]
          const key = `${template}:${bucket}`
          let entry = buckets.get(key)
          if (!entry) {
            entry = { key, template, bucket, matrices: [], colors: [], sources: [] }
            buckets.set(key, entry)
          }

          pos.set(buffer.data[base], buffer.data[base + 1], buffer.data[base + 2]).applyMatrix4(nodeMatrix)
          quat.set(buffer.data[base + 3], buffer.data[base + 4], buffer.data[base + 5], buffer.data[base + 6])
          const headScale = material.headDiameterCm / 100
          const s = buffer.data[base + 7] * headScale
          scale.set(s, s, s)
          matrix.compose(pos, quat, scale)
          entry.matrices.push(matrix.clone())

          if (flags & F_FLAG_UNREACHABLE) {
            color.set(0xd06868)
          } else {
            color.set(material.baseColor)
            // 实例级明暗抖动，配合开放度差异打散复制感
            color.multiplyScalar(0.9 + buffer.data[base + 10] * 0.2)
          }
          entry.colors.push(color.clone())
          entry.sources.push({ nodeId: node.id, zoneId: zone.id, flowerIndex: i })
        }
      }
    }

    let totalInstances = 0
    const templatesUsed = new Set<string>()
    for (const entry of buckets.values()) {
      const geometry = buildTemplateGeometry(entry.template, (entry.bucket + 0.5) / OPENNESS_BUCKETS)
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.02,
        color: white
      })
      const mesh = new THREE.InstancedMesh(geometry, material, entry.matrices.length)
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
      for (let i = 0; i < entry.matrices.length; i++) {
        mesh.setMatrixAt(i, entry.matrices[i])
        mesh.setColorAt(i, entry.colors[i])
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.frustumCulled = false
      mesh.userData.sources = entry.sources
      this.meshes.push(mesh)
      this.group.add(mesh)
      totalInstances += entry.matrices.length
      templatesUsed.add(entry.template)
    }

    this.stats = {
      drawCalls: this.meshes.length,
      instances: totalInstances,
      templates: templatesUsed.size
    }
  }

  // 命中检测：O(1) 定位到结构/区域/花朵索引，供手动拔除
  pick(raycaster: THREE.Raycaster): InstanceSource | null {
    const intersections = raycaster.intersectObjects(this.meshes, false)
    if (intersections.length === 0) return null
    const hit = intersections[0]
    if (hit.instanceId === undefined) return null
    const sources = (hit.object as THREE.InstancedMesh).userData.sources as InstanceSource[]
    return sources[hit.instanceId] ?? null
  }
}
