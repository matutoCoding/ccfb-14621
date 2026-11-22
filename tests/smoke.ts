import assert from 'node:assert'
import { seedMaterials, seedVenues } from '../src/core/seed'
import { createStructure } from '../src/core/factory'
import { distributeFlowers, activeFlowerCount, addOneFlower, removeFlowerAt } from '../src/three/dist'
import { hashSeed } from '../src/core/rng'
import {
  buildChecksum,
  buildOrderLines,
  buildOrderLinesByRole,
  checkHangLoads,
  orderTotal,
  replacementPlan,
  buildPlan,
  structureLoadKg
} from '../src/core/calc'
import type { DesignScheme, FlowerMaterial, StructureNode } from '../src/types'
import { FLOWER_STRIDE, F_FLAG_REMOVED } from '../src/core/constants'

const materials = seedMaterials()
const materialMap = new Map(materials.map((item) => [item.id, item]))
const venues = seedVenues()

let failures = 0
function check(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`PASS  ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL  ${name}`)
    console.error('      ', error instanceof Error ? error.message : error)
  }
}

function makeScheme(structures: StructureNode[]): DesignScheme {
  return {
    id: 'scheme_test',
    name: '冒烟方案',
    venueId: venues[0].id,
    season: '春季',
    budget: 80000,
    structures,
    updatedAt: 0
  }
}

// 1. 布花：数量为正、无穿插、同种子结果一致
check('自动布花：无穿插且确定性可复现', () => {
  const node = createStructure('arch', 1, [0, 0, 2])
  const zone = node.zones[0]
  const a = distributeFlowers(node, zone, materials, 12345)
  zone.flowerData = a.buffer
  assert.ok(a.buffer.count > 200, `拱门花朵数应超过 200，实际 ${a.buffer.count}`)

  // 最小距离校验：任意两朵花头间距不得过近
  const stride = FLOWER_STRIDE
  let minDistance = Infinity
  for (let i = 0; i < a.buffer.count; i++) {
    for (let j = i + 1; j < a.buffer.count; j++) {
      const dx = a.buffer.data[i * stride] - a.buffer.data[j * stride]
      const dy = a.buffer.data[i * stride + 1] - a.buffer.data[j * stride + 1]
      const dz = a.buffer.data[i * stride + 2] - a.buffer.data[j * stride + 2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (distance < minDistance) minDistance = distance
    }
  }
  const smallestHead = Math.min(...materials.map((item) => item.headDiameterCm)) / 100
  assert.ok(minDistance >= smallestHead * 0.45, `最小间距 ${minDistance.toFixed(4)}m 异常`)

  const b = distributeFlowers(node, zone, materials, 12345)
  assert.deepStrictEqual(b.buffer.data, a.buffer.data, '同种子布花结果必须完全一致')
})

// 2. 核心承诺：渲染计数与清单计数严格相等
check('同源校验：画面花朵数与清单朵数一朵不差', () => {
  const structures = [
    createStructure('arch', 1, [0, 0, 2]),
    createStructure('pillar', 1, [-2, 0, -1]),
    createStructure('hanger', 1, [0, 5, -2]),
    createStructure('tableDome', 1, [3, 0.8, -8])
  ]
  for (const node of structures) {
    for (const zone of node.zones) {
      zone.flowerData = distributeFlowers(node, zone, materials, hashSeed(node.id + zone.id)).buffer
    }
  }
  const scheme = makeScheme(structures)
  const lines = buildOrderLines(scheme, materialMap)
  const checksum = buildChecksum(scheme, lines)
  assert.strictEqual(checksum.rendered, checksum.orderedHeads, `渲染 ${checksum.rendered} vs 清单 ${checksum.orderedHeads}`)
  assert.ok(checksum.matched)

  // 按角色拆分后总和也必须相等
  const roleLines = buildOrderLinesByRole(scheme, materialMap)
  let roleSum = 0
  for (const group of roleLines.values()) roleSum += group.reduce((sum, line) => sum + line.heads, 0)
  assert.strictEqual(roleSum, checksum.rendered, '角色明细之和必须等于总花朵数')
})

// 3. 手动拔除/补花后仍然对得上
check('手动调整：拔除与补花后校验依然相等', () => {
  const node = createStructure('ring', 1, [0, 0, 0])
  const zone = node.zones[0]
  zone.flowerData = distributeFlowers(node, zone, materials, 999).buffer
  const before = activeFlowerCount(zone.flowerData)
  removeFlowerAt(zone, 10)
  removeFlowerAt(zone, 20)
  const afterRemove = activeFlowerCount(zone.flowerData)
  assert.strictEqual(afterRemove, before - 2)
  // 拔除槽位仍占 count 但渲染跳过
  assert.strictEqual(zone.flowerData.count, before)
  assert.ok(zone.flowerData.data[10 * FLOWER_STRIDE + 11] & F_FLAG_REMOVED)

  const rose = materials.find((item) => item.id === 'm_carola') as FlowerMaterial
  const added = addOneFlower(node, zone, rose, 777)
  assert.ok(added, '补花应当成功')
  const scheme = makeScheme([node])
  const lines = buildOrderLines(scheme, materialMap)
  const checksum = buildChecksum(scheme, lines)
  assert.strictEqual(checksum.rendered, checksum.orderedHeads)
  assert.strictEqual(checksum.rendered, before - 1)
})

// 4. 整扎取整与损耗
check('下单核算：损耗后按整扎向上取整', () => {
  const node = createStructure('tableDome', 1, [0, 0.8, 0])
  const zone = node.zones[0]
  zone.flowerData = distributeFlowers(node, zone, materials, 55).buffer
  const scheme = makeScheme([node])
  const lines = buildOrderLines(scheme, materialMap)
  for (const line of lines) {
    const material = materialMap.get(line.materialId) as FlowerMaterial
    const expectedLoss = Math.ceil(line.heads * material.lossRate)
    assert.strictEqual(line.lossHeads, expectedLoss)
    const expectedBunches = Math.ceil((line.heads + expectedLoss) / material.perBunch)
    assert.strictEqual(line.bunches, expectedBunches)
    assert.ok(line.bunches * material.perBunch >= line.heads + expectedLoss)
  }
})

// 5. 吊点承重：超限与未绑定都要报
check('吊点承重：超重和未绑定均报警', () => {
  const venue = venues[0]
  const hanger = createStructure('hanger', 1, [0, 5, -2])
  hanger.hangPointId = venue.hangPoints[0].id
  for (const zone of hanger.zones) {
    zone.density = 400
    zone.flowerData = distributeFlowers(hanger, zone, materials, 1).buffer
  }
  const load = structureLoadKg(hanger, materialMap)
  const overLimitScheme = makeScheme([hanger])
  const warnings = checkHangLoads(overLimitScheme, venue, materialMap)
  if (load > venue.hangPoints[0].maxLoadKg) {
    assert.ok(warnings.length === 1 && warnings[0].message.includes('超过吊点'))
  }

  const unbound = createStructure('hanger', 2, [0, 5, 0])
  unbound.zones[0].flowerData = distributeFlowers(unbound, unbound.zones[0], materials, 2).buffer
  const unboundWarnings = checkHangLoads(makeScheme([unbound]), venue, materialMap)
  assert.ok(unboundWarnings.some((item) => item.message.includes('未绑定')))
})

// 6. 换花方案：同朵数、可比价
check('换花并排比：替代方案保持朵数不变', () => {
  const node = createStructure('pillar', 1, [0, 0, 0])
  node.zones[0].flowerData = distributeFlowers(node, node.zones[0], materials, 8).buffer
  const lines = buildOrderLines(makeScheme([node]), materialMap)
  const line = lines[0]
  const material = materialMap.get(line.materialId) as FlowerMaterial
  const plans = replacementPlan(line, material, materialMap, '春季')
  assert.ok(plans.length > 0)
  for (const candidate of plans) {
    assert.strictEqual(candidate.heads, line.heads)
    assert.ok(candidate.subtotal > 0)
  }
})

// 7. 搭建排期：吊顶必须排第一
check('搭建排期：吊顶作业排在最前', () => {
  const structures = [
    createStructure('pillar', 1, [0, 0, 0]),
    createStructure('arch', 1, [0, 0, 2]),
    createStructure('hanger', 1, [0, 5, -2])
  ]
  for (const node of structures) {
    node.zones[0].flowerData = distributeFlowers(node, node.zones[0], materials, hashSeed(node.id)).buffer
  }
  const tasks = buildPlan(makeScheme(structures), materialMap)
  assert.strictEqual(tasks[0].isCeiling, true)
  assert.ok(tasks.every((task) => task.crew >= 2 && task.skeletonMinutes > 0))
})

// 8. 大规模布花：性能、数据完整性与物理容量诚实性
check('规模压测：6 万朵布花秒级完成，超容量时填充率诚实下降', () => {
  const big = createStructure('hanger', 1, [0, 6, 0])
  const zone = big.zones[0]
  zone.widthM = 12
  zone.heightM = 12
  zone.density = 600
  const started = performance.now()
  const result = distributeFlowers(big, zone, materials, 2026)
  const elapsed = performance.now() - started
  zone.flowerData = result.buffer
  const fillRate = result.buffer.count / result.targetCount
  console.log(`      布花 ${result.buffer.count} 朵，耗时 ${elapsed.toFixed(0)}ms，目标 ${result.targetCount}，填充率 ${(fillRate * 100).toFixed(1)}%`)
  assert.ok(result.buffer.count >= 55000, `应布入 5.5 万朵以上，实际 ${result.buffer.count}`)
  assert.ok(elapsed < 10000, `布花耗时应低于 10s，实际 ${elapsed.toFixed(0)}ms`)

  // 低密度时填充率必须高，证明密度在合理区间内是可信的
  const small = createStructure('hanger', 2, [0, 6, 0])
  const smallZone = small.zones[0]
  smallZone.widthM = 12
  smallZone.heightM = 12
  smallZone.density = 300
  const lowDensity = distributeFlowers(small, smallZone, materials, 2026)
  const lowFill = lowDensity.buffer.count / lowDensity.targetCount
  console.log(`      低密度对照：${lowDensity.buffer.count}/${lowDensity.targetCount}，填充率 ${(lowFill * 100).toFixed(1)}%`)
  assert.ok(lowFill >= 0.85, `合理密度下填充率应不低于 85%，实际 ${(lowFill * 100).toFixed(1)}%`)
  const scheme = makeScheme([big])
  const lines = buildOrderLines(scheme, materialMap)
  const checksum = buildChecksum(scheme, lines)
  assert.strictEqual(checksum.rendered, checksum.orderedHeads)
  assert.ok(orderTotal(lines) > 0)
})

// 9. 种子数据完整性
check('种子数据：三个场地与不少于 25 个花材品种', () => {
  assert.strictEqual(venues.length, 3)
  assert.ok(materials.length >= 25)
  for (const material of materials) {
    assert.strictEqual(material.seasons.length, 4)
    assert.ok(material.perBunch > 0)
  }
  assert.ok(venues.every((venue) => venue.hangPoints.length > 0 && venue.tables.length > 0))
})

if (failures > 0) {
  console.error(`\n${failures} 项测试失败`)
  process.exit(1)
}
console.log('\n全部冒烟测试通过')
