// 花材核算：直接从场景里实际插着的花聚合，清单与画面一朵不差
import { FlowerVariety, PlacementRecord, Season, StructureItem, ZONE_NAMES, ZoneKind } from '../lib/types'

export interface OrderLine {
  varietyId: string; name: string; zone: ZoneKind
  count: number // 画面实际支数
  withLoss: number // 加损耗
  bunches: number // 整扎
  purchase: number // 采购支数
  price: number; amount: number
  availability: number
  shortage: boolean
}

export interface OrderResult {
  lines: OrderLine[]
  total: number
  totalStems: number
  byZone: { zone: ZoneKind; name: string; stems: number; amount: number }[]
}

export function computeOrder(
  structures: StructureItem[],
  placements: Map<string, PlacementRecord>,
  varieties: Map<string, FlowerVariety>,
  season: Season
): OrderResult {
  // 按 区域×品种 聚合实际支数
  const agg = new Map<string, { zone: ZoneKind; varietyId: string; count: number }>()
  for (const s of structures) {
    const rec = placements.get(s.id)
    if (!rec) continue
    for (const f of rec.list) {
      const key = `${s.zone}:${f.varietyId}`
      let a = agg.get(key)
      if (!a) { a = { zone: s.zone, varietyId: f.varietyId, count: 0 }; agg.set(key, a) }
      a.count++
    }
  }

  const lines: OrderLine[] = []
  for (const a of agg.values()) {
    const v = varieties.get(a.varietyId)
    if (!v) continue
    const si = v.seasons[season]
    const withLoss = Math.ceil(a.count * (1 + v.lossRate))
    const bunches = Math.ceil(withLoss / v.bunchSize)
    const purchase = bunches * v.bunchSize
    lines.push({
      varietyId: v.id, name: v.name, zone: a.zone,
      count: a.count, withLoss, bunches, purchase,
      price: si.price, amount: purchase * si.price,
      availability: si.availability, shortage: si.availability < 0.6,
    })
  }
  lines.sort((x, y) => y.amount - x.amount)

  const zoneOrder: ZoneKind[] = ['ceiling', 'arch', 'runway', 'mainTable']
  const byZone = zoneOrder.map(zone => {
    const zl = lines.filter(l => l.zone === zone)
    return {
      zone, name: ZONE_NAMES[zone],
      stems: zl.reduce((s, l) => s + l.count, 0),
      amount: zl.reduce((s, l) => s + l.amount, 0),
    }
  }).filter(z => z.stems > 0)

  return {
    lines,
    total: lines.reduce((s, l) => s + l.amount, 0),
    totalStems: lines.reduce((s, l) => s + l.count, 0),
    byZone,
  }
}

// 淡季缺货替代建议：同类、花头尺寸接近、当季到货率高
export function findSubstitutes(v: FlowerVariety, all: FlowerVariety[], season: Season, limit = 3): FlowerVariety[] {
  return all
    .filter(o => o.id !== v.id && o.category === v.category)
    .filter(o => o.seasons[season].availability >= 0.75)
    .filter(o => Math.abs(o.headDiameter - v.headDiameter) <= Math.max(3, v.headDiameter * 0.5))
    .sort((a, b) => a.seasons[season].price - b.seasons[season].price)
    .slice(0, limit)
}

export interface SwapPlan {
  original: OrderResult
  optimized: OrderLine[]
  optimizedTotal: number
  swaps: { from: string; to: string; zone: ZoneKind; save: number }[]
}

// 超预算换花方案：金额大的行优先换成同类的便宜品种
export function budgetSwap(result: OrderResult, varieties: Map<string, FlowerVariety>,
  season: Season, budget: number): SwapPlan | null {
  if (result.total <= budget) return null
  const optimized = result.lines.map(l => ({ ...l }))
  const swaps: SwapPlan['swaps'] = []
  let total = result.total

  const sorted = [...optimized].sort((a, b) => b.amount - a.amount)
  for (const line of sorted) {
    if (total <= budget) break
    const v = varieties.get(line.varietyId)
    if (!v) continue
    const alt = findSubstitutes(v, [...varieties.values()], season, 1)[0]
    if (!alt || alt.seasons[season].price >= line.price) continue
    const idx = optimized.findIndex(l => l.varietyId === line.varietyId && l.zone === line.zone)
    const newAmount = optimized[idx].purchase * alt.seasons[season].price
    swaps.push({ from: v.name, to: alt.name, zone: line.zone, save: line.amount - newAmount })
    optimized[idx].varietyId = alt.id
    optimized[idx].name = alt.name
    optimized[idx].price = alt.seasons[season].price
    optimized[idx].amount = newAmount
    total -= line.amount - newAmount
  }
  return { original: result, optimized, optimizedTotal: total, swaps }
}
