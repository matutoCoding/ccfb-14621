export const FLOWER_STRIDE = 12
export const F_FLAG_MANUAL = 1
export const F_FLAG_REMOVED = 2
export const F_FLAG_UNREACHABLE = 4

export const SEASONS = ['春季', '夏季', '秋季', '冬季']

export const LIGHTING_PRESETS = [
  { id: 'warm', name: '暖白宴会场', ambient: 0xfff1dd, intensity: 0.85, key: 0xffe6bd, keyIntensity: 2.4, fog: 0x1a1410 },
  { id: 'cool', name: '冷白现代场', ambient: 0xe8f0ff, intensity: 0.95, key: 0xffffff, keyIntensity: 2.2, fog: 0x10141c },
  { id: 'spot', name: '追光仪式场', ambient: 0x55556a, intensity: 0.35, key: 0xfff2d8, keyIntensity: 4.2, fog: 0x050508 }
] as const

// 开放度分桶：同品种按桶选几何体，桶内再叠加实例缩放与朝向差异
export const OPENNESS_BUCKETS = 4
export const BUCKET_EDGES = [0.15, 0.4, 0.65, 0.85, 1]

// 渲染像素比上限，保 1080p 帧率
export const MAX_PIXEL_RATIO = 1.5

export const STORAGE_KEYS = {
  db: 'floral-studio-db',
  version: 1,
  stores: {
    venues: 'venues',
    materials: 'materials',
    schemes: 'schemes',
    meta: 'meta'
  }
}
