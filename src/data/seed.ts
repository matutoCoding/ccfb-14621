// 测试场地 + 示例方案 种子数据
import { dbAll, dbPut } from '../lib/db'
import { Project, StructureItem, uid, Venue } from '../lib/types'
import { riggingGrid, tableGrid } from '../core/venue_gen'
import { seedFlowers } from './seed_flowers'

function makeVenue(name: string, length: number, width: number, height: number,
  runwayLen: number, runwayWidth: number, tableCount: number,
  screenW: number, screenH: number, rig: RiggingPoint[]): Venue {
  const now = Date.now()
  return {
    id: uid(), name, length, width, height,
    riggingPoints: rig,
    runway: { length: runwayLen, width: runwayWidth },
    tables: tableGrid(tableCount, width, length, runwayWidth),
    screen: { width: screenW, height: screenH },
    createdAt: now, updatedAt: now,
  }
}

export function seedVenues(): Venue[] {
  return [
    makeVenue('君悦宴会厅', 40, 25, 8, 12, 2.4, 28, 8, 4.5, riggingGrid(4, 3, 20, 30, 7.5, 150)),
    makeVenue('临江婚礼堂', 30, 20, 6, 10, 2, 18, 6, 3.5, riggingGrid(3, 2, 14, 20, 5.5, 100)),
    makeVenue('草坪玻璃房', 24, 16, 5, 8, 1.8, 12, 5, 3, riggingGrid(2, 2, 10, 14, 4.5, 60)),
  ]
}

function makeStructure(projectId: string, kind: StructureItem['kind'], name: string,
  zone: StructureItem['zone'], params: Record<string, number>,
  position: [number, number, number], rotationY: number, segCount: number): StructureItem {
  const now = Date.now()
  return {
    id: uid(), projectId, kind, name, zone, params, position, rotationY,
    foam: new Array(segCount).fill(true),
    recipe: { main: '', fillers: [], leaves: [], density: 8, gradient: 0.4 },
    createdAt: now, updatedAt: now,
  }
}

// 首次启动时灌入种子数据
export async function ensureSeeded(): Promise<void> {
  const venues = await dbAll<Venue>('venues')
  if (venues.length > 0) return

  const flowers = seedFlowers()
  for (const f of flowers) await dbPut('flowers', f)

  const vs = seedVenues()
  for (const v of vs) await dbPut('venues', v)

  const now = Date.now()
  const project: Project = {
    id: uid(), name: '示例婚礼方案', venueId: vs[0].id,
    season: 'spring', budget: 80000, crewSize: 6,
    entryTime: new Date(now + 24 * 3600 * 1000).toISOString().slice(0, 16),
    createdAt: now, updatedAt: now,
  }
  await dbPut('projects', project)

  const v = vs[0]
  const stageZ = -v.length / 2 + 4
  const structures = [
    makeStructure(project.id, 'arch', '主背景拱门', 'arch',
      { width: 4, height: 3.2, tube: 0.025, foamRadius: 0.12 }, [0, 0, stageZ], 0, 40),
    makeStructure(project.id, 'waterfall', '主桌吊顶花瀑', 'ceiling',
      { width: 6, depth: 2, hang: 0.6, tube: 0.02, foamRadius: 0.1 }, [0, v.height - 1.2, stageZ + 1], 0, 60),
    makeStructure(project.id, 'column', '路引花柱·左1', 'runway',
      { height: 1.6, foamRadius: 0.18, tube: 0.02 }, [-2.2, 0, stageZ + 5], 0, 6),
    makeStructure(project.id, 'column', '路引花柱·右1', 'runway',
      { height: 1.6, foamRadius: 0.18, tube: 0.02 }, [2.2, 0, stageZ + 5], 0, 6),
    makeStructure(project.id, 'ring', '主桌圆环桌花', 'mainTable',
      { radius: 0.5, tube: 0.015, foamRadius: 0.08 }, [0, 0.75, stageZ + 2.5], 0, 12),
  ]
  for (const s of structures) await dbPut('structures', s)
}
