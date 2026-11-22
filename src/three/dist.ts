import * as THREE from 'three'
import type { FlowerBuffer, FlowerMaterial, FlowerCategory, FoamZone } from '@/types'
import { F_FLAG_UNREACHABLE, FLOWER_STRIDE } from '@/core/constants'
import { Rng } from '@/core/rng'
import { getParams, sampleSurface, surfaceArea, type SurfaceSample } from './surface'
import type { StructureNode } from '@/types'

const LAYER_ORDER: FlowerCategory[] = ['main', 'filler', 'green']
const GRADIENT_POWER = 1.6
const MAX_TRIES = 40
// 固定小格子，保证每格只存少量花，邻居扫描接近 O(1)
const CELL_SIZE = 0.1
// 花头允许簇叠（花艺本就层层叠插），系数低于 1 但保持花芯不穿插
const OVERLAP_FACTOR = 0.62

class SpatialHash {
  private cellSize: number
  private cells = new Map<number, number[]>()
  private stride: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
    // 场地坐标在 ±32m 内，量化后加偏移保证非负
    this.stride = 512
  }

  private cellKey(cx: number, cy: number, cz: number): number {
    return (cx + 256) * this.stride * this.stride + (cy + 256) * this.stride + (cz + 256)
  }

  add(index: number, x: number, y: number, z: number): void {
    const key = this.cellKey(
      Math.floor(x / this.cellSize),
      Math.floor(y / this.cellSize),
      Math.floor(z / this.cellSize)
    )
    let cell = this.cells.get(key)
    if (!cell) {
      cell = []
      this.cells.set(key, cell)
    }
    cell.push(index)
  }

  // 收集候选邻居索引（3x3x3 邻域）
  collectNeighbors(x: number, y: number, z: number, out: number[]): void {
    out.length = 0
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cell = this.cells.get(this.cellKey(cx + dx, cy + dy, cz + dz))
          if (cell) for (const item of cell) out.push(item)
        }
      }
    }
  }
}

export interface DistributeResult {
  buffer: FlowerBuffer
  unreachable: number
  targetCount: number
}

export function distributeFlowers(
  node: StructureNode,
  zone: FoamZone,
  materials: FlowerMaterial[],
  seed: number
): DistributeResult {
  const params = getParams(node)
  const rng = new Rng(seed)
  const area = surfaceArea(zone, params)
  const targetCount = Math.round(area * zone.density)

  const pools: Record<FlowerCategory, FlowerMaterial[]> = { main: [], filler: [], green: [] }
  for (const material of materials) pools[material.category].push(material)
  const usedMaterials = materials
  const materialIds = usedMaterials.map((item) => item.id)
  const idIndex = new Map(materialIds.map((id, i) => [id, i]))

  const maxHeadM = Math.max(...usedMaterials.map((item) => item.headDiameterCm)) / 100 || 0.1
  const hash = new SpatialHash(CELL_SIZE)
  const data: number[] = []
  const neighborScratch: number[] = []
  const sample: SurfaceSample = {
    pos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    anchor: new THREE.Vector3()
  }
  const jittered = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const zAxis = new THREE.Vector3()
  const twist = new THREE.Quaternion()

  const layerShares: Record<FlowerCategory, number> = {
    main: zone.mainMix,
    filler: zone.fillerMix,
    green: Math.max(0, 1 - zone.mainMix - zone.fillerMix)
  }
  let unreachable = 0
  let placed = 0

  // 缓冲区第 9 槽存的是 usedMaterials 内的本地索引
  const bufferMaterialIndex = (flowerIndex: number): FlowerMaterial =>
    usedMaterials[data[flowerIndex * FLOWER_STRIDE + 9]] ?? usedMaterials[0]

  // 边缘疏、中心密：边缘最小间距放大，间距按当前花材自身花头半径计算
  function spacingFor(headM: number, u: number): number {
    const edge = Math.abs(u - 0.5) * 2
    const gradient = 1 + Math.pow(edge, GRADIENT_POWER) * 0.45
    return headM * 0.55 * gradient
  }

  // 抖动网格候选点：规则网格保填充率，格内随机偏移保自然感
  function buildCandidates(quota: number): { u: number; v: number }[] {
    const cols = Math.max(1, Math.round(Math.sqrt(quota)))
    const rows = Math.max(1, Math.ceil(quota / cols))
    const candidates: { u: number; v: number }[] = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5 + rng.range(-0.35, 0.35)) / cols
        const v = (j + 0.5 + rng.range(-0.35, 0.35)) / rows
        candidates.push({ u: THREE.MathUtils.clamp(u, 0.01, 0.99), v: THREE.MathUtils.clamp(v, 0.01, 0.99) })
      }
    }
    // 洗牌后逐个尝试，落位顺序随机避免网格痕迹
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    return candidates
  }

  function tryPlaceAt(category: FlowerCategory, u: number, v: number): boolean {
    const pool = pools[category]
    if (pool.length === 0) return false
    const material = pool[Math.floor(rng.next() * pool.length)]
    const headM = material.headDiameterCm / 100

    {
      sampleSurface(zone.kind, u, v, zone, params, sample)
      const px = sample.pos.x
      const py = sample.pos.y
      const pz = sample.pos.z
      const spacing = spacingFor(headM, u)
      const minDistance = spacing * 0.5
      const minDistanceSq = minDistance * minDistance

      let blocked = false
      hash.collectNeighbors(px, py, pz, neighborScratch)
      for (const neighborIndex of neighborScratch) {
        const base = neighborIndex * FLOWER_STRIDE
        const otherHead = bufferMaterialIndex(neighborIndex).headDiameterCm / 100
        const dx = data[base] - px
        const dy = data[base + 1] - py
        const dz = data[base + 2] - pz
        const distanceSq = dx * dx + dy * dy + dz * dz
        const radiusSum = ((headM + otherHead) / 2) * OVERLAP_FACTOR
        const limitSq = Math.max(minDistanceSq, radiusSum * radiusSum)
        if (distanceSq < limitSq) {
          blocked = true
          break
        }
      }
      if (blocked) return false

      // 朝向：法线主导，叠加随机偏转与扭转，保证不一眼复制
      zAxis.copy(sample.normal)
      jittered.set(rng.range(-0.32, 0.32), rng.range(-0.32, 0.32), rng.range(-0.32, 0.32))
      zAxis.add(jittered).normalize()
      quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), zAxis)
      twist.setFromAxisAngle(zAxis, rng.range(0, Math.PI * 2))
      quat.premultiply(twist)

      const reachCm = sample.pos.distanceTo(sample.anchor) * 100
      const unreachableFlag = reachCm > Math.min(zone.maxReachCm, material.stemLengthCm)
      if (unreachableFlag) unreachable++

      const opennessBucket = Math.min(3, Math.floor(rng.next() * 4))
      const scale = (headM / maxHeadM) * rng.range(0.88, 1.12)

      data.push(
        px, py, pz,
        quat.x, quat.y, quat.z, quat.w,
        scale,
        opennessBucket,
        idIndex.get(material.id) ?? 0,
        rng.next(), // 随机槽位，供渲染器做个体差异
        unreachableFlag ? F_FLAG_UNREACHABLE : 0
      )
      hash.add(placed, px, py, pz)
      placed++
      return true
    }
  }

  for (const category of LAYER_ORDER) {
    const quota = Math.round(targetCount * layerShares[category])
    if (quota === 0) continue
    // 多轮网格补位：每轮重新撒候选点，填满配额或连续两轮零增长为止
    let layerPlaced = 0
    let staleRounds = 0
    let round = 0
    while (layerPlaced < quota && staleRounds < 2 && round < 8) {
      const remaining = quota - layerPlaced
      const candidates = buildCandidates(Math.round(remaining * 2.4))
      const before = layerPlaced
      for (const candidate of candidates) {
        if (layerPlaced >= quota) break
        if (tryPlaceAt(category, candidate.u, candidate.v)) layerPlaced++
      }
      staleRounds = layerPlaced === before ? staleRounds + 1 : 0
      round++
    }
  }

  return {
    targetCount,
    unreachable,
    buffer: { data, count: placed, materialIds, unreachable, targetCount }
  }
}

// 手动补一朵：就近找一个不与现有花穿插的空位
export function addOneFlower(
  node: StructureNode,
  zone: FoamZone,
  material: FlowerMaterial,
  seed: number
): boolean {
  if (!zone.flowerData) return false
  const params = getParams(node)
  const rng = new Rng(seed)
  const buffer = zone.flowerData
  if (!buffer.materialIds.includes(material.id)) buffer.materialIds.push(material.id)
  const materialIndex = buffer.materialIds.indexOf(material.id)
  const headM = material.headDiameterCm / 100

  const sample: SurfaceSample = {
    pos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    anchor: new THREE.Vector3()
  }
  const quat = new THREE.Quaternion()
  const zAxis = new THREE.Vector3()
  const twist = new THREE.Quaternion()

  for (let attempt = 0; attempt < MAX_TRIES * 2; attempt++) {
    sampleSurface(zone.kind, rng.next(), rng.next(), zone, params, sample)
    let blocked = false
    for (let i = 0; i < buffer.count; i++) {
      const base = i * FLOWER_STRIDE
      if (buffer.data[base + 11] & 2) continue
      const dx = buffer.data[base] - sample.pos.x
      const dy = buffer.data[base + 1] - sample.pos.y
      const dz = buffer.data[base + 2] - sample.pos.z
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < headM * 0.8) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    zAxis.copy(sample.normal).add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(-0.3, 0.3), rng.range(-0.3, 0.3))).normalize()
    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), zAxis)
    twist.setFromAxisAngle(zAxis, rng.range(0, Math.PI * 2))
    quat.premultiply(twist)
    const reachCm = sample.pos.distanceTo(sample.anchor) * 100
    const flag = 1 | (reachCm > Math.min(zone.maxReachCm, material.stemLengthCm) ? F_FLAG_UNREACHABLE : 0)

    buffer.data.push(
      sample.pos.x, sample.pos.y, sample.pos.z,
      quat.x, quat.y, quat.z, quat.w,
      rng.range(0.9, 1.1), Math.floor(rng.next() * 4), materialIndex, rng.next(), flag
    )
    buffer.count++
    buffer.unreachable = countFlags(buffer, F_FLAG_UNREACHABLE)
    return true
  }
  return false
}

export function removeFlowerAt(zone: FoamZone, flowerIndex: number): void {
  if (!zone.flowerData || flowerIndex < 0 || flowerIndex >= zone.flowerData.count) return
  const base = flowerIndex * FLOWER_STRIDE
  zone.flowerData.data[base + 11] |= 2
  zone.flowerData.unreachable = countFlags(zone.flowerData, F_FLAG_UNREACHABLE)
}

function countFlags(buffer: FlowerBuffer, flag: number): number {
  let total = 0
  for (let i = 0; i < buffer.count; i++) {
    const f = buffer.data[i * FLOWER_STRIDE + 11]
    if (!(f & 2) && f & flag) total++
  }
  return total
}

// 有效花朵总数（拔除槽位不计），渲染与核算共用
export function activeFlowerCount(buffer: FlowerBuffer | undefined): number {
  if (!buffer) return 0
  let total = 0
  for (let i = 0; i < buffer.count; i++) {
    if (!(buffer.data[i * FLOWER_STRIDE + 11] & 2)) total++
  }
  return total
}
