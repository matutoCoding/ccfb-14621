import type { DesignScheme, StructureNode, StructureType } from '@/types'
import { defaultZones } from '@/three/surface'
import { uid } from './store'

export const STRUCTURE_META: Record<StructureType, { label: string; role: string; params: Record<string, number> }> = {
  arch: {
    label: '花艺拱门',
    role: '拱门',
    params: { widthM: 3.2, heightM: 2.6, tubeRadiusM: 0.06 }
  },
  ring: {
    label: '铁艺圆环',
    role: '拱门',
    params: { radiusM: 1.4, heightM: 1.6, tubeRadiusM: 0.05 }
  },
  pillar: {
    label: '铁艺花柱',
    role: '路引',
    params: { radiusM: 0.35, heightM: 2.1, tubeRadiusM: 0.04 }
  },
  hanger: {
    label: '花瀑吊架',
    role: '吊顶',
    params: { widthM: 3, heightM: 2.6, tubeRadiusM: 0.05 }
  },
  tableDome: {
    label: '主桌半球花',
    role: '主桌',
    params: { radiusM: 0.6, heightM: 0.8, tubeRadiusM: 0.03 }
  }
}

export function createStructure(type: StructureType, index: number, position: [number, number, number]): StructureNode {
  const meta = STRUCTURE_META[type]
  return {
    id: uid('s'),
    type,
    label: `${meta.label} ${index}`,
    role: meta.role,
    position,
    rotationY: 0,
    params: { ...meta.params },
    hangPointId: null,
    zones: defaultZones(type).map((zone) => ({ ...zone }))
  }
}

export function createScheme(venueId: string, season: string): DesignScheme {
  return {
    id: uid('scheme'),
    name: `方案 ${new Date().toLocaleDateString('zh-CN')}`,
    venueId,
    season,
    budget: 80000,
    structures: [],
    updatedAt: Date.now()
  }
}

// 演示方案：拱门 + 两个路引 + 一组吊顶 + 两张主桌花，打开即可看到完整链路
export function createDemoStructures(): StructureNode[] {
  return [
    createStructure('arch', 1, [0, 0, 2]),
    createStructure('pillar', 1, [-2.4, 0, -1]),
    createStructure('pillar', 2, [2.4, 0, -1]),
    createStructure('hanger', 1, [0, 5.2, -2]),
    createStructure('tableDome', 1, [-4, 0.78, -9]),
    createStructure('tableDome', 2, [4, 0.78, -9])
  ]
}
