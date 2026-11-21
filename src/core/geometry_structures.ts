// 参数化骨架：路径生成、花泥分段、表面撒点、承重核算
import * as THREE from 'three'
import { RiggingPoint, StructureItem } from '../lib/types'

export const SEG_LEN = 0.3 // 每段约0.3米
export const IRON_KG_PER_M = 1.1 // 铁艺骨架每米重量
export const FOAM_KG_PER_M = 0.4 // 花泥每米重量

// 生成骨架中心线路径点(局部坐标)
export function buildPath(s: StructureItem): THREE.Vector3[] {
  const p = s.params
  const pts: THREE.Vector3[] = []
  if (s.kind === 'arch') {
    const R = p.width / 2, hp = Math.max(0.2, p.height - R)
    for (let y = 0; y < hp; y += SEG_LEN) pts.push(new THREE.Vector3(-R, y, 0))
    const n = Math.max(6, Math.round((Math.PI * R) / SEG_LEN))
    for (let i = 0; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI
      pts.push(new THREE.Vector3(Math.cos(a) * R, hp + Math.sin(a) * R, 0))
    }
    for (let y = hp; y > 0; y -= SEG_LEN) pts.push(new THREE.Vector3(R, y, 0))
    pts.push(new THREE.Vector3(R, 0, 0))
  } else if (s.kind === 'ring') {
    const R = p.radius
    const n = Math.max(12, Math.round((2 * Math.PI * R) / SEG_LEN))
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * R, R + Math.sin(a) * R, 0))
    }
  } else if (s.kind === 'column') {
    const n = Math.max(2, Math.round(p.height / SEG_LEN))
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(0, (p.height * i) / n, 0))
  } else {
    // waterfall: 水平矩形吊架
    const W = p.width, D = p.depth
    const corners: [number, number][] = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2]]
    for (let c = 0; c < corners.length - 1; c++) {
      const [x0, z0] = corners[c], [x1, z1] = corners[c + 1]
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / SEG_LEN))
      for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(x0 + ((x1 - x0) * i) / n, 0, z0 + ((z1 - z0) * i) / n))
    }
  }
  return pts
}

export const segCount = (s: StructureItem) => Math.max(1, buildPath(s).length - 1)

// 保证 foam 数组与当前段数一致
export function normalizeFoam(s: StructureItem): void {
  const n = segCount(s)
  if (s.foam.length === n) return
  const next = new Array(n).fill(true)
  for (let i = 0; i < Math.min(n, s.foam.length); i++) next[i] = s.foam[i]
  s.foam = next
}

export const pathLength = (s: StructureItem) => {
  const pts = buildPath(s)
  let len = 0
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1])
  return len
}

export const foamLength = (s: StructureItem) => {
  const pts = buildPath(s)
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    if (s.foam[i]) len += pts[i].distanceTo(pts[i + 1])
  }
  return len
}

export interface Slot { p: THREE.Vector3; n: THREE.Vector3; seg: number; t: number }

// 在花泥表面按间距撒候选点(局部坐标)，t 为沿路径的归一化位置(供密度梯度用)
export function sampleSlots(s: StructureItem, spacing: number): Slot[] {
  const pts = buildPath(s)
  const slots: Slot[] = []
  const foamR = s.params.foamRadius
  const totalSegs = pts.length - 1
  const up = new THREE.Vector3(0, 1, 0)

  for (let i = 0; i < totalSegs; i++) {
    if (!s.foam[i]) continue
    const a = pts[i], b = pts[i + 1]
    const segLen = a.distanceTo(b)
    const tangent = b.clone().sub(a).normalize()
    const steps = Math.max(1, Math.round(segLen / spacing))
    for (let k = 0; k < steps; k++) {
      const base = a.clone().lerp(b, k / steps)
      const t = (i + k / steps) / totalSegs
      if (s.kind === 'waterfall') {
        // 花瀑：花头朝下垂
        slots.push({ p: base.clone(), n: new THREE.Vector3(0, -1, 0), seg: i, t })
      } else if (s.kind === 'column') {
        // 花柱：圆柱面全周
        const NA = 6
        for (let j = 0; j < NA; j++) {
          const ang = (j / NA) * Math.PI * 2
          const n = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
          slots.push({ p: base.clone().addScaledVector(n, foamR), n, seg: i, t })
        }
      } else {
        // 拱门/圆环：管面一周取样，正前方(+Z)加密
        const side = new THREE.Vector3().crossVectors(tangent, up)
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
        side.normalize()
        const up2 = new THREE.Vector3().crossVectors(side, tangent).normalize()
        const NA = 8
        for (let j = 0; j < NA; j++) {
          const ang = (j / NA) * Math.PI * 2
          const n = side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up2, Math.sin(ang)).normalize()
          if (n.z < -0.35) continue // 背面不插花
          slots.push({ p: base.clone().addScaledVector(n, foamR), n, seg: i, t })
        }
      }
    }
  }
  return slots
}

// 结构自重(骨架+花泥，不含花材)
export function structureWeightKg(s: StructureItem): number {
  return pathLength(s) * IRON_KG_PER_M + foamLength(s) * FOAM_KG_PER_M
}

// 吊顶承重校验：找最近的4个吊点均摊，返回每个吊点的负荷与是否超载
export function riggingCheck(s: StructureItem, points: RiggingPoint[], flowerWeightKg: number):
  { point: RiggingPoint; share: number; overload: boolean }[] {
  if (s.zone !== 'ceiling' || points.length === 0) return []
  const total = structureWeightKg(s) + flowerWeightKg
  const [sx, , sz] = s.position
  const nearest = [...points]
    .sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz))
    .slice(0, 4)
  const share = total / nearest.length
  return nearest.map(point => ({ point, share, overload: share > point.loadKg }))
}
