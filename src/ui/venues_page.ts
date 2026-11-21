// 场地档案页：宴会厅建档，层高/吊点/T台/桌位
import { dbDel, dbPut } from '../lib/db'
import { el, field, fmt, numInput, textInput } from '../lib/dom'
import { uid, Venue } from '../lib/types'
import { riggingGrid, tableGrid } from '../core/venue_gen'
import { loadCtx } from '../lib/state'

interface VenueDraft {
  id: string; name: string
  length: number; width: number; height: number
  runwayLen: number; runwayWidth: number
  tableCount: number
  screenW: number; screenH: number
  rigCols: number; rigRows: number; rigLoad: number
}

const blank = (): VenueDraft => ({
  id: '', name: '', length: 30, width: 20, height: 6,
  runwayLen: 10, runwayWidth: 2, tableCount: 20,
  screenW: 6, screenH: 3.5, rigCols: 3, rigRows: 2, rigLoad: 100,
})

function toDraft(v: Venue): VenueDraft {
  const cols = v.riggingPoints.length > 0 ? Math.round(Math.sqrt(v.riggingPoints.length * (v.width / v.length))) : 3
  return {
    id: v.id, name: v.name, length: v.length, width: v.width, height: v.height,
    runwayLen: v.runway.length, runwayWidth: v.runway.width,
    tableCount: v.tables.filter(t => t.kind === 'guest').length,
    screenW: v.screen.width, screenH: v.screen.height,
    rigCols: cols, rigRows: Math.max(1, Math.round(v.riggingPoints.length / Math.max(1, cols))),
    rigLoad: v.riggingPoints[0]?.loadKg ?? 100,
  }
}

export async function renderVenuesPage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  let draft = blank()

  const rerender = () => renderVenuesPage(root)

  const save = async () => {
    if (!draft.name.trim()) { alert('请填写场地名称'); return }
    const now = Date.now()
    const existing = ctx.venues.find(v => v.id === draft.id)
    const venue: Venue = {
      id: draft.id || uid(), name: draft.name,
      length: draft.length, width: draft.width, height: draft.height,
      runway: { length: draft.runwayLen, width: draft.runwayWidth },
      tables: tableGrid(draft.tableCount, draft.width, draft.length, draft.runwayWidth),
      screen: { width: draft.screenW, height: draft.screenH },
      riggingPoints: riggingGrid(draft.rigCols, draft.rigRows, draft.width * 0.8, draft.length * 0.8, draft.height - 0.5, draft.rigLoad),
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    }
    await dbPut('venues', venue)
    draft = blank()
    await rerender()
  }

  const listCard = el('div', { class: 'card' }, [
    el('h2', { text: `已建档场地（${ctx.venues.length}）` }),
    ctx.venues.length === 0
      ? el('div', { class: 'empty' }, [el('div', { class: 't', text: '还没有场地档案' }), el('div', { text: '在右侧填写宴会厅参数建立第一个档案' })])
      : el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, ['名称', '厅体(长×宽×高)', '吊点', 'T台', '桌位', '背景屏', ''].map(t => el('th', { text: t })))]),
          el('tbody', {}, ctx.venues.map(v => el('tr', {}, [
            el('td', { text: v.name }),
            el('td', { text: `${v.length}×${v.width}×${v.height}m` }),
            el('td', { text: `${v.riggingPoints.length}个 · 单点${v.riggingPoints[0]?.loadKg ?? 0}kg` }),
            el('td', { text: `${v.runway.length}×${v.runway.width}m` }),
            el('td', { text: `主桌1 + 客桌${v.tables.filter(t => t.kind === 'guest').length}` }),
            el('td', { text: `${v.screen.width}×${v.screen.height}m` }),
            el('td', {}, [
              el('button', { class: 'btn btn-sm', text: '编辑', onclick: () => { draft = toDraft(v); rerender() } }),
              el('button', {
                class: 'btn btn-sm btn-danger', text: '删除', style: 'margin-left:8px',
                onclick: async () => { if (confirm(`删除场地「${v.name}」？`)) { await dbDel('venues', v.id); rerender() } },
              }),
            ]),
          ]))),
        ]),
  ])

  const d = () => draft
  const formCard = el('div', { class: 'card' }, [
    el('h2', { text: draft.id ? '编辑场地' : '新建场地' }),
    field('场地名称', textInput(draft.name, v => { draft.name = v })),
    el('div', { class: 'form-grid' }, [
      field('厅长 (m)', numInput(d().length, v => { draft.length = v })),
      field('厅宽 (m)', numInput(d().width, v => { draft.width = v })),
      field('层高 (m)', numInput(d().height, v => { draft.height = v })),
      field('T台长 (m)', numInput(d().runwayLen, v => { draft.runwayLen = v })),
      field('T台宽 (m)', numInput(d().runwayWidth, v => { draft.runwayWidth = v })),
      field('客桌数量', numInput(d().tableCount, v => { draft.tableCount = Math.round(v) })),
      field('背景屏宽 (m)', numInput(d().screenW, v => { draft.screenW = v })),
      field('背景屏高 (m)', numInput(d().screenH, v => { draft.screenH = v })),
      field('单吊点承重 (kg)', numInput(d().rigLoad, v => { draft.rigLoad = v })),
      field('吊点列数', numInput(d().rigCols, v => { draft.rigCols = Math.max(1, Math.round(v)) })),
      field('吊点行数', numInput(d().rigRows, v => { draft.rigRows = Math.max(1, Math.round(v)) })),
    ]),
    el('div', { class: 'toolbar', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn-primary', text: draft.id ? '保存修改' : '建立档案', onclick: save }),
      draft.id ? el('button', { class: 'btn', text: '取消编辑', onclick: () => { draft = blank(); rerender() } }) : '',
    ]),
    el('div', { class: 'sub', style: 'color:var(--c-text-3);margin-top:12px',
      text: `吊点按 ${draft.rigCols}×${draft.rigRows} 网格均布在顶面下 0.5m，桌位自动排布并避开T台；吊顶花瀑超重会在结构搭建页直接报警。` }),
  ])

  root.append(
    el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('h1', { text: '场地档案' }),
        el('div', { class: 'sub', text: '宴会厅层高、吊点承重、T台与桌位排布建档，吊顶承重超限自动报警' }),
      ]),
    ]),
    el('div', { style: 'display:grid;grid-template-columns:1.4fr 1fr;gap:16px;align-items:start' }, [listCard, formCard])
  )
}
