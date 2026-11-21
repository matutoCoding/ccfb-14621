// 搭建排程：吊顶优先，按结构件与花材量算工时和人手
import { PlacementRecord, Project, StructureItem, ZONE_NAMES, ZoneKind } from '../lib/types'
import { foamLength, pathLength } from './geometry_structures'

export interface BuildTask {
  phase: string
  structureName: string
  zone: ZoneKind
  work: string
  manHours: number // 人时
  crew: number // 投入人数
  hours: number // 实际工时
  start: Date
  end: Date
}

const FRAME_MAN_H_PER_M = 0.12 // 骨架组装 人时/米
const FOAM_MAN_H_PER_M = 0.08 // 包花泥 人时/米
const FLOWERS_PER_MAN_H = 90 // 插花 朵/人时
const HOIST_MAN_H = 1.5 // 吊装基础人时

const ZONE_ORDER: ZoneKind[] = ['ceiling', 'arch', 'runway', 'mainTable']

export function buildSchedule(
  project: Project,
  structures: StructureItem[],
  placements: Map<string, PlacementRecord>
): BuildTask[] {
  const sorted = [...structures].sort(
    (a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone)
  )
  const tasks: BuildTask[] = []
  let cursor = new Date(project.entryTime)
  if (Number.isNaN(cursor.getTime())) cursor = new Date()

  const push = (s: StructureItem, work: string, manHours: number) => {
    const crew = Math.max(1, Math.min(project.crewSize, Math.ceil(manHours / 1.5)))
    const hours = manHours / crew
    const start = new Date(cursor)
    const end = new Date(cursor.getTime() + hours * 3600 * 1000)
    tasks.push({
      phase: ZONE_NAMES[s.zone], structureName: s.name, zone: s.zone, work,
      manHours: Math.round(manHours * 10) / 10, crew,
      hours: Math.round(hours * 10) / 10, start, end,
    })
    cursor = end
  }

  for (const s of sorted) {
    const frameLen = pathLength(s)
    const flowerCount = placements.get(s.id)?.list.length ?? 0
    if (s.zone === 'ceiling') push(s, '吊架组装+吊装', frameLen * FRAME_MAN_H_PER_M + HOIST_MAN_H)
    else push(s, '骨架组装', frameLen * FRAME_MAN_H_PER_M)
    push(s, '包花泥/绑网格', foamLength(s) * FOAM_MAN_H_PER_M + 0.2)
    if (flowerCount > 0) push(s, '插花', flowerCount / FLOWERS_PER_MAN_H)
  }
  return tasks
}
