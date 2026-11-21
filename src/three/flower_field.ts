// 实例化花场：按 品种×开放度变体 分 InstancedMesh，分块保证视锥剔除生效
import * as THREE from 'three'
import { FlowerVariety, PlacedFlower } from '../lib/types'
import { mulberry32 } from '../lib/rng'
import { VARIANTS, varietyGeometry } from './flower_geo'

const CHUNK = 4000 // 每块实例数，兼顾 draw call 与剔除粒度
const UP = new THREE.Vector3(0, 1, 0)

interface ChunkMeta { flowerIndices: number[] }

export class FlowerField {
  group = new THREE.Group()
  flowers: PlacedFlower[] = []
  private varieties = new Map<string, FlowerVariety>()
  private meshes: THREE.InstancedMesh[] = []
  private material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })

  setData(flowers: PlacedFlower[], varieties: Map<string, FlowerVariety>): void {
    this.flowers = flowers
    this.varieties = varieties
    this.rebuild()
  }

  rebuild(): void {
    this.clear()
    // 按 品种×变体 分桶
    const buckets = new Map<string, number[]>()
    this.flowers.forEach((f, i) => {
      const variant = f.seed % VARIANTS.length
      const key = `${f.varietyId}:${variant}`
      let b = buckets.get(key)
      if (!b) { b = []; buckets.set(key, b) }
      b.push(i)
    })

    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const twist = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const nrm = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const col = new THREE.Color()

    for (const [key, indices] of buckets) {
      const v = this.varieties.get(key.split(':')[0])
      if (!v) continue
      const variant = Number(key.split(':')[1])
      const geo = varietyGeometry(v, variant)
      for (let off = 0; off < indices.length; off += CHUNK) {
        const slice = indices.slice(off, off + CHUNK)
        const mesh = new THREE.InstancedMesh(geo, this.material, slice.length)
        const meta: ChunkMeta = { flowerIndices: slice }
        mesh.userData = meta
        slice.forEach((fi, slot) => {
          const f = this.flowers[fi]
          pos.set(f.p[0], f.p[1], f.p[2])
          nrm.set(f.n[0], f.n[1], f.n[2]).normalize()
          q.setFromUnitVectors(UP, nrm)
          // 绕自身朝向随机扭转，破除复制感
          twist.setFromAxisAngle(nrm, mulberry32(f.seed)() * Math.PI * 2)
          q.premultiply(twist)
          scl.setScalar(f.s)
          m4.compose(pos, q, scl)
          mesh.setMatrixAt(slot, m4)
          col.set(v.colors[f.c % v.colors.length])
          col.offsetHSL(0, 0, (mulberry32(f.seed + 7)() - 0.5) * 0.08)
          mesh.setColorAt(slot, col)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        this.group.add(mesh)
        this.meshes.push(mesh)
      }
    }
  }

  // 拾取一朵花，返回 flowers 下标
  pick(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects(this.meshes, false)
    if (hits.length === 0) return null
    const hit = hits[0]
    const meta = hit.object.userData as ChunkMeta
    if (hit.instanceId === undefined) return null
    return meta.flowerIndices[hit.instanceId]
  }

  count(): number { return this.flowers.length }

  clear(): void {
    for (const m of this.meshes) {
      this.group.remove(m)
      m.dispose()
    }
    this.meshes = []
  }
}
