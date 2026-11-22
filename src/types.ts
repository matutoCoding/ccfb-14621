// 领域模型类型定义，全部可结构化克隆存入 IndexedDB

export type FlowerCategory = 'main' | 'filler' | 'green'
export type StructureType = 'arch' | 'ring' | 'pillar' | 'hanger' | 'tableDome'
export type CoverType = 'foam' | 'mesh'
export type ZoneKind =
  | 'archBand'
  | 'ringSector'
  | 'pillarSleeve'
  | 'hangerPanel'
  | 'domeShell'

// 花材品种
export interface FlowerMaterial {
  id: string
  name: string
  category: FlowerCategory
  headDiameterCm: number
  stemLengthCm: number
  perBunch: number
  lossRate: number
  baseColor: string
  seasons: SeasonalPrice[]
  replacements: string[] // 其他 material id
}

export interface SeasonalPrice {
  season: string
  pricePerBunch: number
  arrivalRate: number // 0~1，到货率
}

// 场地档案
export interface Venue {
  id: string
  name: string
  ceilingHeightM: number
  stageLengthM: number
  stageWidthM: number
  hallWidthM: number
  hallLengthM: number
  hangPoints: HangPoint[]
  tables: TableSpot[]
  note: string
}

export interface HangPoint {
  id: string
  x: number // 米，场地坐标系：T台沿 -Z，拱门在 +Z 端
  z: number
  y: number
  maxLoadKg: number
}

export interface TableSpot {
  id: string
  label: string
  x: number
  z: number
  radiusM: number
  seats: number
}

export interface StructureNode {
  id: string
  type: StructureType
  label: string
  role: string // 主桌 / 路引 / 拱门 / 吊顶
  position: [number, number, number]
  rotationY: number
  params: Record<string, number>
  hangPointId: string | null
  zones: FoamZone[]
}

export interface FoamZone {
  id: string
  label: string
  kind: ZoneKind
  cover: CoverType
  // 通用参数，按 kind 取用
  widthM: number
  heightM: number
  radiusM: number
  thicknessM: number
  u0: number
  u1: number
  v0: number
  v1: number
  mainMix: number // 主花占比
  fillerMix: number // 配花占比，余下为叶材
  density: number // 基准密度，朵/平方米
  maxReachCm: number // 枝长可达上限，超过即提示
  flowerData?: FlowerBuffer
}

export interface FlowerBuffer {
  // 每朵 12 个 float：x,y,z, qx,qy,qz,qw, scale, openness, mIndex, v0, flags
  // flags 位：1 手动补充 2 手动拔除（空位保留槽位，渲染跳过） 4 枝长不足
  data: number[]
  count: number
  materialIds: string[]
  unreachable: number // 枝长不足计数
  targetCount: number // 按密度推算的目标朵数，用于填充率诊断
}

export interface DesignScheme {
  id: string
  name: string
  venueId: string
  season: string
  budget: number
  structures: StructureNode[]
  updatedAt: number
}

export interface BuildTask {
  order: number
  title: string
  role: string
  isCeiling: boolean
  skeletonMinutes: number
  flowerMinutes: number
  crew: number
  detail: string
}

export interface OrderLine {
  materialId: string
  name: string
  role: string
  category: FlowerCategory
  heads: number
  lossHeads: number
  perBunch: number
  bunches: number
  unitPrice: number
  subtotal: number
  arrivalRate: number
}

export interface Checksum {
  rendered: number
  orderedHeads: number
  matched: boolean
}
