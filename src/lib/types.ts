// 全局数据模型
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type FlowerCategory = 'main' | 'filler' | 'leaf'
export type ZoneKind = 'ceiling' | 'arch' | 'runway' | 'mainTable'
export type FlowerForm = 'rose' | 'hydrangea' | 'orchid' | 'eucalyptus' | 'spray' | 'leaf'

export const SEASON_NAMES: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
export const CATEGORY_NAMES: Record<FlowerCategory, string> = { main: '主花', filler: '配花', leaf: '叶材' }
export const ZONE_NAMES: Record<ZoneKind, string> = { ceiling: '吊顶花瀑', arch: '拱门', runway: '路引', mainTable: '主桌花' }

export interface RiggingPoint { id: string; x: number; y: number; z: number; loadKg: number }
export interface TableSeat { id: string; x: number; z: number; kind: 'main' | 'guest' }

export interface Venue {
  id: string; name: string
  length: number; width: number; height: number
  riggingPoints: RiggingPoint[]
  runway: { length: number; width: number }
  tables: TableSeat[]
  screen: { width: number; height: number }
  createdAt: number; updatedAt: number
}

export interface SeasonInfo { price: number; availability: number }

export interface FlowerVariety {
  id: string; name: string; category: FlowerCategory; form: FlowerForm
  headDiameter: number // cm
  stemLength: number // cm
  bunchSize: number // 每扎支数
  lossRate: number // 损耗率 0-1
  stemWeight: number // 单支克重
  colors: string[]
  seasons: Record<Season, SeasonInfo>
  createdAt: number; updatedAt: number
}

export type StructureKind = 'arch' | 'ring' | 'column' | 'waterfall'
export const STRUCTURE_NAMES: Record<StructureKind, string> = { arch: '拱门', ring: '圆环', column: '花柱', waterfall: '花瀑吊架' }

export interface Recipe {
  main: string // 主花品种 id
  fillers: string[]
  leaves: string[]
  density: number // 主花 朵/米
  gradient: number // 边缘稀疏程度 0-1
}

export interface StructureItem {
  id: string; projectId: string; kind: StructureKind; name: string
  zone: ZoneKind
  params: Record<string, number>
  position: [number, number, number]
  rotationY: number // 弧度
  foam: boolean[] // 每段是否包花泥
  recipe: Recipe
  createdAt: number; updatedAt: number
}

// 场景里实际插着的一朵花，清单核算的唯一数据源
export interface PlacedFlower {
  varietyId: string
  p: [number, number, number] // 世界坐标(米)
  n: [number, number, number] // 花头朝向
  s: number // 缩放(开放度)
  c: number // 颜色索引
  seed: number
}

export interface PlacementRecord { id: string; list: PlacedFlower[] } // id = structureId

export interface Project {
  id: string; name: string; venueId: string
  season: Season; budget: number
  crewSize: number; entryTime: string // 进场时间 ISO
  createdAt: number; updatedAt: number
}

export const uid = () => Math.random().toString(36).slice(2, 10)
