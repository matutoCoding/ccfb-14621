// 程序生成花材几何体：低面数 + 开放度变体，供实例化渲染
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FlowerVariety } from '../lib/types'

// 一片微卷的花瓣
function petal(len: number, wid: number, curl: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(wid, len, 1, 3)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / len + 0.5 // 0..1
    pos.setZ(i, curl * y * y)
    pos.setX(i, pos.getX(i) * (1 - y * 0.35))
  }
  g.translate(0, len / 2, 0)
  g.computeVertexNormals()
  return g
}

function ringOf(base: THREE.BufferGeometry, count: number, radius: number, tilt: number, yOff: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const g = base.clone()
    const m = new THREE.Matrix4()
      .makeRotationY((i / count) * Math.PI * 2)
      .multiply(new THREE.Matrix4().makeTranslation(0, yOff, radius))
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
    g.applyMatrix4(m)
    out.push(g)
  }
  return out
}

function roseGeo(r: number, open: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const bud = new THREE.ConeGeometry(r * 0.4, r * 0.9, 6)
  bud.translate(0, r * 0.45, 0)
  parts.push(bud)
  parts.push(...ringOf(petal(r * 1.1, r * 0.9, 0.5), 5, r * 0.25, -0.5 - open * 0.3, 0))
  parts.push(...ringOf(petal(r * 1.3, r * 1.1, 0.7), 7, r * 0.45, -0.9 - open * 0.5, -r * 0.1))
  return mergeGeometries(parts)!
}

function hydrangeaGeo(r: number, open: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const floret = mergeGeometries([
    petal(r * 0.32, r * 0.3, 0.2),
    petal(r * 0.32, r * 0.3, 0.2).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2)),
  ])!
  const N = 14
  for (let i = 0; i < N; i++) {
    const t = i / N, phi = Math.acos(1 - t * 0.9), theta = i * 2.4
    const g = floret.clone()
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0))
    g.applyMatrix4(m)
    g.translate(dir.x * r * 0.8 * open, dir.y * r * 0.8 * open, dir.z * r * 0.8 * open)
    parts.push(g)
  }
  return mergeGeometries(parts)!
}

function orchidGeo(r: number, open: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const p = petal(r * 1.1, r * 0.8, 0.25)
  // 蝴蝶兰：两片顶瓣 + 两片侧翼 + 唇瓣
  parts.push(...ringOf(p, 2, r * 0.15, -0.4 * open, 0))
  parts.push(...ringOf(petal(r * 1.2, r * 1.0, 0.2), 2, r * 0.2, -1.1 * open, -r * 0.1))
  const lip = petal(r * 0.6, r * 0.4, 0.4)
  lip.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI * 0.7))
  lip.translate(0, -r * 0.2, r * 0.1)
  parts.push(lip)
  const col = new THREE.SphereGeometry(r * 0.15, 5, 4)
  parts.push(col)
  return mergeGeometries(parts)!
}

function eucalyptusGeo(r: number, open: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const stemLen = r * 14
  const stem = new THREE.CylinderGeometry(r * 0.06, r * 0.08, stemLen, 4)
  stem.translate(0, stemLen / 2, 0)
  parts.push(stem)
  const leaf = new THREE.CircleGeometry(r * 1.1, 6)
  const N = 9
  for (let i = 0; i < N; i++) {
    for (const side of [-1, 1]) {
      const g = leaf.clone()
      g.applyMatrix4(new THREE.Matrix4()
        .makeRotationY(side * (Math.PI / 2) + i * 0.5)
        .multiply(new THREE.Matrix4().makeRotationX(-0.5 * open)))
      g.translate(Math.sin(i * 2) * r * 0.5, stemLen * (0.15 + 0.85 * (i / N)), Math.cos(i * 2) * r * 0.5)
      parts.push(g)
    }
  }
  return mergeGeometries(parts)!
}

function sprayGeo(r: number, open: number): THREE.BufferGeometry {
  // 配花：基部散出几支小碎花
  const parts: THREE.BufferGeometry[] = []
  const N = 5
  for (let i = 0; i < N; i++) {
    const bud = new THREE.SphereGeometry(r * 0.5 * open, 5, 4)
    const a = (i / N) * Math.PI * 2
    bud.translate(Math.cos(a) * r * 1.2, r * (1 + (i % 3) * 0.8), Math.sin(a) * r * 1.2)
    parts.push(bud)
  }
  const stem = new THREE.CylinderGeometry(r * 0.08, r * 0.1, r * 2, 4)
  stem.translate(0, r, 0)
  parts.push(stem)
  return mergeGeometries(parts)!
}

function leafGeo(r: number, open: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const N = 4
  for (let i = 0; i < N; i++) {
    const g = petal(r * 2.2, r * 0.9, 0.3)
    g.applyMatrix4(new THREE.Matrix4()
      .makeRotationY((i / N) * Math.PI * 2)
      .multiply(new THREE.Matrix4().makeRotationX(-0.9 * open)))
    parts.push(g)
  }
  return mergeGeometries(parts)!
}

const BUILDERS: Record<FlowerVariety['form'], (r: number, open: number) => THREE.BufferGeometry> = {
  rose: roseGeo, hydrangea: hydrangeaGeo, orchid: orchidGeo,
  eucalyptus: eucalyptusGeo, spray: sprayGeo, leaf: leafGeo,
}

// 每品种 3 个开放度变体
export const VARIANTS = [0.75, 0.95, 1.15]

const cache = new Map<string, THREE.BufferGeometry>()

export function varietyGeometry(v: FlowerVariety, variant: number): THREE.BufferGeometry {
  const key = `${v.id}:${variant}`
  let g = cache.get(key)
  if (!g) {
    g = BUILDERS[v.form](v.headDiameter / 200, VARIANTS[variant])
    cache.set(key, g)
  }
  return g
}

export function clearGeometryCache(): void {
  for (const g of cache.values()) g.dispose()
  cache.clear()
}
