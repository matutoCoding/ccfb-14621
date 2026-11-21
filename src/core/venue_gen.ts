// 场地构件生成：吊点网格、桌位排布
import { RiggingPoint, TableSeat, uid } from '../lib/types'

export function riggingGrid(cols: number, rows: number, w: number, l: number, y: number, loadKg: number): RiggingPoint[] {
  const pts: RiggingPoint[] = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      pts.push({
        id: uid(),
        x: -w / 2 + (w / Math.max(1, cols - 1)) * i,
        z: -l / 2 + (l / Math.max(1, rows - 1)) * j,
        y, loadKg,
      })
    }
  }
  return pts
}

export function tableGrid(count: number, w: number, l: number, runwayWidth: number): TableSeat[] {
  const tables: TableSeat[] = [{ id: uid(), x: 0, z: -l / 2 + 3, kind: 'main' }]
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (w / l))))
  const rows = Math.max(1, Math.ceil(count / cols))
  let n = 0
  for (let r = 0; r < rows && n < count; r++) {
    for (let c = 0; c < cols && n < count; c++) {
      const x = -w / 2 + 3 + (w - 6) * (c / Math.max(1, cols - 1))
      const z = -l / 2 + 8 + (l - 14) * (r / Math.max(1, rows - 1))
      if (Math.abs(x) < runwayWidth / 2 + 1.5) continue // 避开T台
      tables.push({ id: uid(), x, z, kind: 'guest' })
      n++
    }
  }
  return tables
}
