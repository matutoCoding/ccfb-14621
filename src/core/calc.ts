import type { BuildTask, Checksum, DesignScheme, FlowerMaterial, HangPoint, OrderLine, StructureNode, Venue } from '@/types'
import { F_FLAG_REMOVED, FLOWER_STRIDE } from '@/core/constants'

// 鲜切花估算单重 kg/支（含短枝），叶材更轻
const HEAD_WEIGHT_KG: Record<string, number> = {
  main: 0.045,
  filler: 0.025,
  green: 0.012
}
const FRAME_BASE_KG: Record<string, number> = {
  arch: 28,
  ring: 18,
  pillar: 12,
  hanger: 22,
  tableDome: 6
}

export interface LoadWarning {
  structureId: string
  structureLabel: string
  hangPointId: string | null
  loadKg: number
  limitKg: number
  message: string
}

function countByMaterial(node: StructureNode, map: Map<string, FlowerMaterial>): Map<string, number> {
  const result = new Map<string, number>()
  for (const zone of node.zones) {
    const buffer = zone.flowerData
    if (!buffer) continue
    for (let i = 0; i < buffer.count; i++) {
      if (buffer.data[i * FLOWER_STRIDE + 11] & F_FLAG_REMOVED) continue
      const materialId = buffer.materialIds[buffer.data[i * FLOWER_STRIDE + 9]]
      if (!map.has(materialId)) continue
      result.set(materialId, (result.get(materialId) ?? 0) + 1)
    }
  }
  return result
}

export function structureLoadKg(node: StructureNode, map: Map<string, FlowerMaterial>): number {
  const counts = countByMaterial(node, map)
  let flowerWeight = 0
  for (const [materialId, count] of counts) {
    const material = map.get(materialId)
    if (!material) continue
    flowerWeight += count * (HEAD_WEIGHT_KG[material.category] ?? 0.02)
  }
  return Math.round((flowerWeight + (FRAME_BASE_KG[node.type] ?? 10)) * 10) / 10
}

// 吊点承重校验：吊架必须挂在有效吊点上且不得超重
export function checkHangLoads(scheme: DesignScheme, venue: Venue | undefined, map: Map<string, FlowerMaterial>): LoadWarning[] {
  const warnings: LoadWarning[] = []
  const pointMap = new Map<string, HangPoint>(venue?.hangPoints.map((point) => [point.id, point]) ?? [])
  for (const node of scheme.structures) {
    if (node.type !== 'hanger') continue
    const loadKg = structureLoadKg(node, map)
    const point = node.hangPointId ? pointMap.get(node.hangPointId) : undefined
    if (!point) {
      warnings.push({
        structureId: node.id,
        structureLabel: node.label,
        hangPointId: node.hangPointId,
        loadKg,
        limitKg: 0,
        message: `${node.label} 未绑定有效吊点，${loadKg}kg 花瀑无承重依据`
      })
      continue
    }
    if (loadKg > point.maxLoadKg) {
      warnings.push({
        structureId: node.id,
        structureLabel: node.label,
        hangPointId: point.id,
        loadKg,
        limitKg: point.maxLoadKg,
        message: `${node.label} 总重 ${loadKg}kg，超过吊点 ${point.id} 承重 ${point.maxLoadKg}kg，超出 ${(loadKg - point.maxLoadKg).toFixed(1)}kg`
      })
    }
  }
  return warnings
}

function priceOf(material: FlowerMaterial, season: string) {
  return material.seasons.find((item) => item.season === season) ?? material.seasons[0]
}

// 下单核算：与渲染共用同一份 FlowerBuffer，逐朵统计
export function buildOrderLines(scheme: DesignScheme, map: Map<string, FlowerMaterial>): OrderLine[] {
  const merged = new Map<string, OrderLine>()
  for (const node of scheme.structures) {
    const counts = countByMaterial(node, map)
    for (const [materialId, heads] of counts) {
      const material = map.get(materialId)
      if (!material) continue
      const seasonal = priceOf(material, scheme.season)
      const existing = merged.get(materialId)
      if (existing) {
        existing.heads += heads
      } else {
        merged.set(materialId, {
          materialId,
          name: material.name,
          role: node.role,
          category: material.category,
          heads,
          lossHeads: 0,
          perBunch: material.perBunch,
          bunches: 0,
          unitPrice: seasonal.pricePerBunch,
          subtotal: 0,
          arrivalRate: seasonal.arrivalRate
        })
      }
    }
  }

  for (const line of merged.values()) {
    line.lossHeads = Math.ceil(line.heads * (map.get(line.materialId)?.lossRate ?? 0))
    line.bunches = Math.ceil((line.heads + line.lossHeads) / line.perBunch)
    line.subtotal = Math.round(line.bunches * line.unitPrice * 100) / 100
  }
  return Array.from(merged.values()).sort((a, b) => b.heads - a.heads)
}

// 按角色（主桌/路引/拱门/吊顶）拆分明细
export function buildOrderLinesByRole(scheme: DesignScheme, map: Map<string, FlowerMaterial>): Map<string, OrderLine[]> {
  const result = new Map<string, OrderLine[]>()
  for (const node of scheme.structures) {
    const counts = countByMaterial(node, map)
    const lines: OrderLine[] = []
    for (const [materialId, heads] of counts) {
      const material = map.get(materialId)
      if (!material) continue
      const seasonal = priceOf(material, scheme.season)
      const lossHeads = Math.ceil(heads * material.lossRate)
      const bunches = Math.ceil((heads + lossHeads) / material.perBunch)
      lines.push({
        materialId,
        name: material.name,
        role: node.role,
        category: material.category,
        heads,
        lossHeads,
        perBunch: material.perBunch,
        bunches,
        unitPrice: seasonal.pricePerBunch,
        subtotal: Math.round(bunches * seasonal.pricePerBunch * 100) / 100,
        arrivalRate: seasonal.arrivalRate
      })
    }
    lines.sort((a, b) => b.heads - a.heads)
    result.set(node.id, lines)
  }
  return result
}

export function orderTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100
}

// 校验和：画面实际花朵数 vs 清单统计数，必须完全相等
export function buildChecksum(scheme: DesignScheme, lines: OrderLine[]): Checksum {
  let rendered = 0
  for (const node of scheme.structures) {
    for (const zone of node.zones) {
      const buffer = zone.flowerData
      if (!buffer) continue
      for (let i = 0; i < buffer.count; i++) {
        if (!(buffer.data[i * FLOWER_STRIDE + 11] & F_FLAG_REMOVED)) rendered++
      }
    }
  }
  const orderedHeads = lines.reduce((sum, line) => sum + line.heads, 0)
  return { rendered, orderedHeads, matched: rendered === orderedHeads }
}

// 换花方案：保持总朵数不变，替换为同类替代品种并排比
export function replacementPlan(
  line: OrderLine,
  material: FlowerMaterial,
  map: Map<string, FlowerMaterial>,
  season: string
): OrderLine[] {
  return material.replacements
    .map((id) => map.get(id))
    .filter((item): item is FlowerMaterial => Boolean(item))
    .map((candidate) => {
      const seasonal = priceOf(candidate, season)
      const lossHeads = Math.ceil(line.heads * candidate.lossRate)
      const bunches = Math.ceil((line.heads + lossHeads) / candidate.perBunch)
      return {
        materialId: candidate.id,
        name: candidate.name,
        role: line.role,
        category: candidate.category,
        heads: line.heads,
        lossHeads,
        perBunch: candidate.perBunch,
        bunches,
        unitPrice: seasonal.pricePerBunch,
        subtotal: Math.round(bunches * seasonal.pricePerBunch * 100) / 100,
        arrivalRate: seasonal.arrivalRate
      }
    })
}

// 搭建排期：吊顶最先，其次拱门路引，主桌收尾
export function buildPlan(scheme: DesignScheme, map: Map<string, FlowerMaterial>): BuildTask[] {
  const ordered = [...scheme.structures].sort((a, b) => {
    if (a.type === 'hanger' && b.type !== 'hanger') return -1
    if (b.type === 'hanger' && a.type !== 'hanger') return 1
    return 0
  })
  return ordered.map((node, index) => {
    const flowerCount = Array.from(countByMaterial(node, map).values()).reduce((sum, count) => sum + count, 0)
    const skeletonMinutes = Math.round((FRAME_BASE_KG[node.type] ?? 10) * 2.2)
    const flowerMinutes = Math.round(flowerCount / 45)
    const totalMinutes = skeletonMinutes + flowerMinutes
    const crew = Math.max(2, Math.ceil(totalMinutes / 90))
    return {
      order: index + 1,
      title: `${node.label}（${node.role}）`,
      role: node.role,
      isCeiling: node.type === 'hanger',
      skeletonMinutes,
      flowerMinutes,
      crew,
      detail: `${node.type === 'hanger' ? '优先挂吊点、上吊架' : '地面组立铁艺骨架'}，${flowerCount} 枝花分 ${Math.max(1, Math.ceil(flowerMinutes / 40))} 轮上墙`
    }
  })
}
