// 骨架网格：按段生成圆柱，包花泥的段高亮，供点选刷花泥
import * as THREE from 'three'
import { StructureItem } from '../lib/types'
import { buildPath, normalizeFoam } from '../core/geometry_structures'

const FRAME_COLOR = 0x5a616b
const FOAM_COLOR = 0x3e8f5f

export class StructureMesh {
  group = new THREE.Group()
  segments: THREE.Mesh[] = []

  constructor(public item: StructureItem) {
    this.rebuild()
  }

  rebuild(): void {
    normalizeFoam(this.item)
    for (const c of [...this.group.children]) {
      this.group.remove(c)
      if (c instanceof THREE.Mesh) c.geometry.dispose()
    }
    this.segments = []

    const pts = buildPath(this.item)
    const r = this.item.params.tube
    const foamR = this.item.params.foamRadius
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const hasFoam = this.item.foam[i]
      const radius = hasFoam ? Math.max(r, foamR * 0.7) : r
      const len = a.distanceTo(b)
      const geo = new THREE.CylinderGeometry(radius, radius, len, 6)
      const mat = new THREE.MeshLambertMaterial({ color: hasFoam ? FOAM_COLOR : FRAME_COLOR })
      const m = new THREE.Mesh(geo, mat)
      m.position.copy(a).lerp(b, 0.5)
      m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
      m.userData.segIdx = i
      m.userData.structureId = this.item.id
      this.group.add(m)
      this.segments.push(m)
    }
    this.group.position.set(...this.item.position)
    this.group.rotation.y = this.item.rotationY
  }

  toggleFoam(segIdx: number): void {
    this.item.foam[segIdx] = !this.item.foam[segIdx]
    this.item.updatedAt = Date.now()
    this.rebuild()
  }

  dispose(): void {
    for (const c of this.group.children) {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose()
        ;(c.material as THREE.Material).dispose()
      }
    }
  }
}
