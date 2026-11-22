import { SEASONS } from './constants'
import type { FlowerMaterial, TableSpot, Venue, HangPoint, FlowerCategory } from '@/types'

// 元组：id, 名称, 类别, 花头直径cm, 枝长cm, 每扎支数, 损耗率, 基色, 基准扎价, 四季到货率
type Row = [string, string, FlowerCategory, number, number, number, number, string, number, number[]]

const ROWS: Row[] = [
  // 主花
  ['m_carola', '卡罗拉红玫瑰', 'main', 7, 55, 20, 0.08, '#b0243a', 45, [0.95, 0.9, 0.92, 0.85]],
  ['m_champagne', '香槟玫瑰', 'main', 7, 55, 20, 0.08, '#e8c9a0', 52, [0.92, 0.88, 0.9, 0.8]],
  ['m_tineke', '坦尼克白玫瑰', 'main', 7, 58, 20, 0.08, '#f4f1ea', 48, [0.93, 0.9, 0.9, 0.82]],
  ['m_lizhi', '粉荔枝玫瑰', 'main', 8, 50, 20, 0.1, '#f2c6d4', 58, [0.85, 0.7, 0.8, 0.6]],
  ['m_phalaenopsis', '蝴蝶兰', 'main', 10, 60, 10, 0.12, '#efe2f5', 120, [0.8, 0.75, 0.78, 0.85]],
  ['m_cymbidium', '大花蕙兰', 'main', 9, 55, 8, 0.1, '#d98fb5', 140, [0.7, 0.65, 0.75, 0.9]],
  ['m_peony', '芍药', 'main', 11, 45, 10, 0.12, '#e8a7c0', 160, [0.9, 0.3, 0.4, 0.2]],
  ['m_sunflower', '向日葵', 'main', 12, 70, 10, 0.07, '#f5c542', 38, [0.75, 0.95, 0.9, 0.5]],
  // 配花
  ['f_hydrangea_w', '白绣球', 'filler', 18, 45, 5, 0.12, '#eef0f2', 55, [0.85, 0.8, 0.82, 0.75]],
  ['f_hydrangea_p', '粉绣球', 'filler', 18, 45, 5, 0.12, '#f3d3e0', 62, [0.82, 0.78, 0.8, 0.7]],
  ['f_carnation', '康乃馨', 'filler', 5, 50, 25, 0.09, '#e88aa8', 32, [0.95, 0.92, 0.93, 0.9]],
  ['f_eustoma', '洋桔梗', 'filler', 6, 55, 15, 0.1, '#d9c2ec', 42, [0.9, 0.85, 0.88, 0.8]],
  ['f_babybreath', '满天星', 'filler', 1.2, 60, 30, 0.15, '#f6f3fb', 28, [0.9, 0.88, 0.9, 0.85]],
  ['f_chrysanthemum', '小菊', 'filler', 4, 48, 20, 0.08, '#f0d76a', 26, [0.92, 0.9, 0.9, 0.88]],
  ['f_pingpong', '乒乓菊', 'filler', 6, 45, 12, 0.09, '#fff4d6', 36, [0.88, 0.85, 0.86, 0.8]],
  ['f_chamomile', '洋甘菊', 'filler', 3, 50, 20, 0.12, '#fbf6dc', 30, [0.85, 0.9, 0.88, 0.7]],
  ['f_campanula', '风铃花', 'filler', 4, 52, 15, 0.12, '#b9a7e0', 38, [0.8, 0.75, 0.78, 0.72]],
  ['f_ammi', '蕾丝花', 'filler', 3, 55, 18, 0.13, '#f4f2ee', 34, [0.82, 0.78, 0.8, 0.74]],
  // 叶材
  ['g_eucalyptus', '尤加利叶', 'green', 6, 60, 10, 0.1, '#8fa59b', 35, [0.92, 0.9, 0.9, 0.88]],
  ['g_eucalyptus_r', '圆叶尤加利', 'green', 7, 58, 10, 0.1, '#9db3a6', 40, [0.9, 0.88, 0.88, 0.85]],
  ['g_monstera', '龟背竹', 'green', 30, 65, 5, 0.08, '#2f5d46', 48, [0.85, 0.9, 0.88, 0.8]],
  ['g_areca', '散尾葵', 'green', 80, 90, 5, 0.07, '#3d6e4c', 42, [0.88, 0.9, 0.88, 0.82]],
  ['g_asplenium', '鸟巢蕨', 'green', 22, 50, 8, 0.1, '#3a6b4f', 30, [0.85, 0.85, 0.85, 0.8]],
  ['g_fern', '高山羊齿', 'green', 12, 45, 12, 0.12, '#4a7d55', 22, [0.9, 0.88, 0.88, 0.85]],
  ['g_dusty', '银叶菊', 'green', 8, 40, 15, 0.12, '#c4ccc4', 28, [0.8, 0.7, 0.75, 0.65]],
  ['g_pine', '蓬莱松', 'green', 5, 48, 10, 0.1, '#547d57', 26, [0.88, 0.85, 0.86, 0.8]],
  ['g_ivy', '常春藤', 'green', 6, 80, 10, 0.1, '#3f6b42', 24, [0.9, 0.9, 0.88, 0.85]],
  ['g_ruscus', '叶上花', 'green', 7, 55, 10, 0.09, '#47704f', 32, [0.88, 0.86, 0.86, 0.82]]
]

export function seedMaterials(): FlowerMaterial[] {
  const list: FlowerMaterial[] = ROWS.map(([id, name, category, headDiameterCm, stemLengthCm, perBunch, lossRate, baseColor, basePrice, arrivals]) => ({
    id,
    name,
    category,
    headDiameterCm,
    stemLengthCm,
    perBunch,
    lossRate,
    baseColor,
    seasons: SEASONS.map((season, i) => {
      const arrivalRate = arrivals[i]
      // 到货率越低，市价越高
      return {
        season,
        arrivalRate,
        pricePerBunch: Math.round(basePrice * (1.7 - arrivalRate * 0.7))
      }
    }),
    replacements: []
  }))
  // 同类品种互为替代，优先取同色系临近品种
  for (const material of list) {
    material.replacements = list
      .filter((item) => item.category === material.category && item.id !== material.id)
      .slice(0, 3)
      .map((item) => item.id)
  }
  return list
}

function hangPoints(points: [number, number, number, number][]): HangPoint[] {
  return points.map(([x, z, y, maxLoadKg], i) => ({ id: `hp${i + 1}`, x, z, y, maxLoadKg }))
}

function roundTables(rows: [number, number, number, number][]): TableSpot[] {
  return rows.map(([x, z, radiusM, seats], i) => ({
    id: `tb${i + 1}`,
    label: `${i + 1}号桌`,
    x,
    z,
    radiusM,
    seats
  }))
}

export function seedVenues(): Venue[] {
  return [
    {
      id: 'v_star_hall',
      name: '星辰大宴会厅',
      ceilingHeightM: 8,
      hallWidthM: 24,
      hallLengthM: 30,
      stageWidthM: 12,
      stageLengthM: 12,
      hangPoints: hangPoints([
        [0, 4, 8, 80], [0, 0, 8, 80], [0, -4, 8, 80],
        [-4, 4, 8, 60], [-4, 0, 8, 60], [-4, -4, 8, 60]
      ]),
      tables: roundTables([
        [-7, -2, 1.8, 10], [-7, -7, 1.8, 10], [-7, -12, 1.8, 10],
        [7, -2, 1.8, 10], [7, -7, 1.8, 10], [7, -12, 1.8, 10],
        [-3.5, -17, 1.8, 10], [3.5, -17, 1.8, 10],
        [-7, -17, 1.5, 8], [7, -17, 1.5, 8],
        [0, -21, 1.8, 10], [0, -25, 1.5, 8]
      ]),
      note: '层高充足，吊顶主通道六个吊点，单吊点限重 80kg'
    },
    {
      id: 'v_lake_hall',
      name: '湖畔水晶厅',
      ceilingHeightM: 6,
      hallWidthM: 16,
      hallLengthM: 20,
      stageWidthM: 8,
      stageLengthM: 10,
      hangPoints: hangPoints([
        [0, 3, 6, 40], [0, -1, 6, 40], [0, -5, 6, 40], [-3, -1, 6, 30]
      ]),
      tables: roundTables([
        [-4, -4, 1.5, 8], [4, -4, 1.5, 8],
        [-4, -9, 1.5, 8], [4, -9, 1.5, 8],
        [-4, -14, 1.5, 8], [4, -14, 1.5, 8],
        [0, -17, 1.5, 8], [0, -12, 1.2, 6]
      ]),
      note: '水晶吊灯占用中央吊点，花瀑需绕行，单吊点限重 40kg'
    },
    {
      id: 'v_rose_hall',
      name: '玫瑰小厅',
      ceilingHeightM: 4.5,
      hallWidthM: 10,
      hallLengthM: 14,
      stageWidthM: 6,
      stageLengthM: 8,
      hangPoints: hangPoints([
        [0, 2, 4.5, 25], [0, -2, 4.5, 25]
      ]),
      tables: roundTables([
        [-2.5, -3, 1.4, 8], [2.5, -3, 1.4, 8],
        [-2.5, -8, 1.4, 8], [2.5, -8, 1.4, 8],
        [0, -12, 1.4, 8], [0, -6, 1.2, 6]
      ]),
      note: '层高低，吊架下垂空间有限，注意花瀑净空不压头'
    }
  ]
}
