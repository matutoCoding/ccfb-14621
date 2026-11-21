// 默认花材库：25 个婚礼常见品种
import { FlowerVariety, Season, SeasonInfo, uid } from '../lib/types'

const seasons = (p: [number, number, number, number], a: [number, number, number, number]): Record<Season, SeasonInfo> => ({
  spring: { price: p[0], availability: a[0] },
  summer: { price: p[1], availability: a[1] },
  autumn: { price: p[2], availability: a[2] },
  winter: { price: p[3], availability: a[3] },
})

type Row = [string, FlowerVariety['category'], FlowerVariety['form'], number, number, number, number, number, string[], [number, number, number, number], [number, number, number, number]]

// 名称, 类别, 形态, 花头cm, 枝长cm, 每扎, 损耗, 克重, 颜色, 四季价, 四季到货率
const ROWS: Row[] = [
  ['卡罗拉玫瑰', 'main', 'rose', 8, 60, 20, 0.10, 40, ['#c81e3a', '#e35d6a'], [2.5, 1.8, 2.2, 3.5], [0.95, 0.95, 0.95, 0.85]],
  ['粉雪山玫瑰', 'main', 'rose', 8, 55, 20, 0.10, 40, ['#f2c4ce'], [3.0, 2.0, 2.5, 4.0], [0.90, 0.95, 0.90, 0.80]],
  ['坦尼克白玫瑰', 'main', 'rose', 9, 60, 20, 0.10, 45, ['#f5f2ea'], [3.0, 2.2, 2.6, 4.2], [0.90, 0.95, 0.90, 0.75]],
  ['香槟玫瑰', 'main', 'rose', 7, 55, 20, 0.10, 38, ['#eed9b7'], [2.8, 2.0, 2.4, 3.8], [0.90, 0.95, 0.90, 0.80]],
  ['蓝绣球', 'main', 'hydrangea', 15, 50, 5, 0.15, 120, ['#7f9fd4'], [8, 6, 7, 12], [0.85, 0.90, 0.85, 0.50]],
  ['粉绣球', 'main', 'hydrangea', 15, 50, 5, 0.15, 120, ['#e8a7bf'], [8, 6, 7, 12], [0.85, 0.90, 0.85, 0.50]],
  ['白蝴蝶兰', 'main', 'orchid', 10, 80, 10, 0.08, 60, ['#f6f4ef'], [15, 13, 14, 18], [0.90, 0.90, 0.90, 0.85]],
  ['粉蝴蝶兰', 'main', 'orchid', 10, 80, 10, 0.08, 60, ['#e9b8d2'], [15, 13, 14, 18], [0.90, 0.90, 0.90, 0.85]],
  ['芍药', 'main', 'rose', 12, 45, 10, 0.20, 50, ['#f3c6d3', '#f6efe8'], [6, 3.5, 8, 15], [0.80, 0.90, 0.40, 0.10]],
  ['洋牡丹', 'main', 'rose', 6, 40, 10, 0.15, 25, ['#e8849c', '#f4ead8'], [3, 4.5, 2.5, 2], [0.85, 0.30, 0.90, 0.90]],
  ['郁金香', 'main', 'rose', 6, 45, 10, 0.12, 30, ['#e7b7c8', '#f2e6c9'], [2.5, 5, 3, 2], [0.90, 0.20, 0.70, 0.95]],
  ['西伯利亚百合', 'main', 'rose', 14, 70, 10, 0.10, 70, ['#f7f5ef'], [6, 5, 5.5, 8], [0.90, 0.90, 0.90, 0.80]],
  ['满天星', 'filler', 'spray', 3, 60, 10, 0.15, 15, ['#f4f2ee'], [1.5, 1.2, 1.3, 2], [0.95, 0.95, 0.95, 0.90]],
  ['洋桔梗', 'filler', 'spray', 5, 55, 10, 0.12, 30, ['#cdb4de', '#f6efe8'], [2, 1.6, 1.8, 2.8], [0.90, 0.90, 0.90, 0.85]],
  ['小雏菊', 'filler', 'spray', 4, 50, 10, 0.12, 20, ['#f6f3ec'], [1.2, 1.0, 1.1, 1.8], [0.95, 0.95, 0.95, 0.90]],
  ['紫罗兰', 'filler', 'spray', 4, 50, 10, 0.15, 25, ['#9d8bd0'], [1.8, 2.5, 1.6, 2], [0.90, 0.50, 0.90, 0.90]],
  ['飞燕草', 'filler', 'spray', 8, 70, 10, 0.12, 35, ['#7c8fd6'], [2.5, 2, 2.2, 3.5], [0.85, 0.85, 0.85, 0.70]],
  ['蕾丝花', 'filler', 'spray', 6, 55, 10, 0.15, 20, ['#f4f1ea'], [1.5, 1.3, 1.4, 2.2], [0.90, 0.90, 0.90, 0.80]],
  ['多头玫瑰', 'filler', 'spray', 4, 50, 10, 0.12, 35, ['#d96a7f', '#f0d9c5'], [2.5, 2, 2.2, 3.2], [0.90, 0.90, 0.90, 0.85]],
  ['圆叶尤加利', 'leaf', 'eucalyptus', 3, 60, 5, 0.10, 40, ['#8fa88f'], [1.5, 1.2, 1.3, 2], [0.95, 0.95, 0.95, 0.90]],
  ['细叶尤加利', 'leaf', 'eucalyptus', 2, 55, 5, 0.10, 35, ['#9db39d'], [1.4, 1.1, 1.2, 1.9], [0.95, 0.95, 0.95, 0.90]],
  ['栀子叶', 'leaf', 'leaf', 4, 40, 10, 0.10, 30, ['#4f7a52'], [1.0, 0.8, 0.9, 1.5], [0.95, 0.95, 0.95, 0.90]],
  ['龟背叶', 'leaf', 'leaf', 20, 60, 5, 0.08, 50, ['#3e6b45'], [2, 1.8, 1.9, 2.8], [0.90, 0.90, 0.90, 0.85]],
  ['散尾葵', 'leaf', 'leaf', 30, 80, 5, 0.10, 60, ['#5b8a5f'], [1.5, 1.2, 1.3, 2], [0.90, 0.90, 0.90, 0.80]],
  ['常春藤', 'leaf', 'leaf', 3, 50, 10, 0.10, 25, ['#55795a'], [1.0, 0.9, 1.0, 1.4], [0.95, 0.95, 0.95, 0.90]],
]

export function seedFlowers(): FlowerVariety[] {
  const now = Date.now()
  return ROWS.map(([name, category, form, headDiameter, stemLength, bunchSize, lossRate, stemWeight, colors, p, a]) => ({
    id: uid(), name, category, form, headDiameter, stemLength, bunchSize, lossRate, stemWeight,
    colors: colors, seasons: seasons(p, a), createdAt: now, updatedAt: now,
  }))
}
