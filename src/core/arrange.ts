// 自动布花：主花/配花/叶材分层，密度梯度，空间哈希防穿插
import * as THREE from 'three'
import { FlowerVariety, PlacedFlower, StructureItem } from '../lib/types'
import { hashStr, mulberry32, rand } from '../lib/rng'
import { sampleSlots } from './geometry_structures'

export interface ArrangeResult { flowers: PlacedFlower[]; warnings: string[] }

// 空间哈希：花头最小间距检查
class SpatialHash {
  private cells = new Map<string, { p: THREE.Vector3; r: number }[]>()
  constructor(private cellSize: number) {}
  private key(p: THREE.Vector3) {
    return `${Math.floor(p.x / this.cellSize)},${Math.floor(p.y / this.cellSize)},${Math.floor(p.z / this.cellSize)}`
  }
  canPlace(p: THREE.Vector3, r: number): boolean {
    const cx = Math.floor(p.x / this.cellSize), cy = Math.floor(p.y / this.cellSize), cz = Math.floor(p.z / this.cellSize)
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const list = this.cells.get(`${cx + i},${cy + j},${cz + k}`)
      if (!list) continue
      for (const o of list) {
        const minD = (o.r + r) * 0.85
        if (o.p.distanceToSquared(p) < minD * minD) return false
      }
    }
    return true
  }
  add(p: THREE.Vector3, r: number): void {
    const k = this.key(p)
    let list = this.cells.get(k)
    if (!list) { list = []; this.cells.set(k, list) }
    list.push({ p: p.clone(), r })
  }
}

// 枝长需求：普通结构需没入花泥，花瀑垂吊需要枝长覆盖吊长
function requiredStemM(s: StructureItem): number {
  if (s.kind === 'waterfall') return s.params.hang + s.params.foamRadius
  return s.params.foamRadius + 0.05
}

export function autoArrange(s: StructureItem, varieties: Map<string, FlowerVariety>): ArrangeResult {
  const warnings: string[] = []
  const recipe = s.recipe
  const main = varieties.get(recipe.main)
  const fillers = recipe.fillers.map(id => varieties.get(id)).filter((v): v is FlowerVariety => !!v)
  const leaves = recipe.leaves.map(id => varieties.get(id)).filter((v): v is FlowerVariety => !!v)
  if (!main) return { flowers: [], warnings: ['未选择主花品种'] }

  const rng = mulberry32(hashStr(s.id))
  const needStem = requiredStemM(s)
  const checkStem = (v: FlowerVariety) => {
    if (v.stemLength / 100 < needStem) {
      const msg = `${v.name} 枝长 ${v.stemLength}cm 不足(需 ${Math.round(needStem * 100)}cm)，已跳过`
      if (!warnings.includes(msg)) warnings.push(msg)
      return false
    }
    return true
  }

  // 主花槽位：沿路径每 1/density 米一个
  const slots = sampleSlots(s, 1 / recipe.density)
  // 哈希格子要覆盖最大花头的最小间距
  const allVars = [main, ...fillers, ...leaves]
  const maxR = Math.max(...allVars.map(v => v.headDiameter / 200))
  const hash = new SpatialHash(Math.max(0.05, maxR * 1.7))
  const flowers: PlacedFlower[] = []

  const world = new THREE.Matrix4()
    .makeRotationY(s.rotationY)
    .setPosition(new THREE.Vector3(...s.position))

  const push = (v: FlowerVariety, p: THREE.Vector3, n: THREE.Vector3) => {
    const r = v.headDiameter / 200
    if (!hash.canPlace(p, r)) return false
    hash.add(p, r)
    const wp = p.clone().applyMatrix4(world)
    const wn = n.clone().transformDirection(world)
    // 朝向抖动 + 开放度随机，避免复制粘贴感
    wn.x += rand(rng, -0.18, 0.18); wn.y += rand(rng, -0.12, 0.12); wn.z += rand(rng, -0.18, 0.18)
    wn.normalize()
    flowers.push({
      varietyId: v.id,
      p: [wp.x, wp.y, wp.z],
      n: [wn.x, wn.y, wn.z],
      s: rand(rng, 0.82, 1.15),
      c: Math.floor(rng() * v.colors.length),
      seed: Math.floor(rng() * 1e9),
    })
    return true
  }

  const jitter = (p: THREE.Vector3, n: THREE.Vector3, dist: number): THREE.Vector3 => {
    const t = new THREE.Vector3(rand(rng, -1, 1), rand(rng, -1, 1), rand(rng, -1, 1)).cross(n)
    if (t.lengthSq() < 1e-6) t.set(1, 0, 0).cross(n)
    t.normalize()
    return p.clone().addScaledVector(t, dist)
  }

  const mainOk = checkStem(main)
  const fillersOk = fillers.filter(checkStem)
  const leavesOk = leaves.filter(checkStem)

  for (const slot of slots) {
    // 疏密从中心向边缘过渡
    const edge = Math.abs(slot.t - 0.5) * 2
    if (rng() < recipe.gradient * edge * edge) continue

    if (mainOk) push(main, slot.p, slot.n)

    // 配花环绕主花
    if (fillersOk.length > 0) {
      const n = 2 + Math.floor(rng() * 2)
      for (let i = 0; i < n; i++) {
        const v = fillersOk[Math.floor(rng() * fillersOk.length)]
        const d = (main.headDiameter + v.headDiameter) / 200 * rand(rng, 0.7, 1.1)
        push(v, jitter(slot.p, slot.n, d), slot.n)
      }
    }
    // 叶材填缝，略低于花头
    if (leavesOk.length > 0) {
      const n = 2 + Math.floor(rng() * 3)
      for (let i = 0; i < n; i++) {
        const v = leavesOk[Math.floor(rng() * leavesOk.length)]
        const d = (main.headDiameter / 100) * rand(rng, 0.6, 1.3)
        const p = jitter(slot.p, slot.n, d).addScaledVector(slot.n, -0.04)
        push(v, p, slot.n)
      }
    }
  }

  return { flowers, warnings }
}

// 手动补花校验：间距与枝长
export function canPlaceAt(existing: PlacedFlower[], varieties: Map<string, FlowerVariety>,
  v: FlowerVariety, p: THREE.Vector3, s: StructureItem): { ok: boolean; reason: string } {
  if (v.stemLength / 100 < requiredStemM(s)) {
    return { ok: false, reason: `${v.name} 枝长不足(需 ${Math.round(requiredStemM(s) * 100)}cm)` }
  }
  const r = v.headDiameter / 200
  for (const f of existing) {
    const fv = varieties.get(f.varietyId)
    if (!fv) continue
    const minD = (fv.headDiameter / 200 + r) * 0.85
    const dx = f.p[0] - p.x, dy = f.p[1] - p.y, dz = f.p[2] - p.z
    if (dx * dx + dy * dy + dz * dz < minD * minD) {
      return { ok: false, reason: '与现有花头穿插，换个位置' }
    }
  }
  return { ok: true, reason: '' }
}
