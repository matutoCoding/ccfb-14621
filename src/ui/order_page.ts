// 花材下单页：按区域明细、整扎取整、缺货替代、超预算换花、搭建排程
import { dbAll, dbPut } from '../lib/db'
import { el, field, fmtInt, fmtMoney, numInput, select } from '../lib/dom'
import { FlowerVariety, PlacementRecord, SEASON_NAMES, Season, ZONE_NAMES } from '../lib/types'
import { budgetSwap, computeOrder, findSubstitutes } from '../core/order'
import { buildSchedule } from '../core/schedule'
import { getCurrentProjectId, loadCtx } from '../lib/state'

const SEASONS = Object.entries(SEASON_NAMES) as [Season, string][]

export async function renderOrderPage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  const project = ctx.projects.find(p => p.id === getCurrentProjectId()) ?? ctx.projects[0]
  if (!project) { root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '请先创建方案' })])); return }
  const structures = ctx.structures.filter(s => s.projectId === project.id)
  const placements = new Map<string, PlacementRecord>()
  for (const r of await dbAll<PlacementRecord>('placements')) placements.set(r.id, r)

  const rerender = () => { root.innerHTML = ''; renderOrderPage(root) }

  const result = computeOrder(structures, placements, ctx.flowerMap, project.season)
  const swap = budgetSwap(result, ctx.flowerMap, project.season, project.budget)
  const over = result.total > project.budget

  const head = el('div', { class: 'page-head' }, [
    el('div', {}, [
      el('h1', { text: `花材下单 · ${project.name}` }),
      el('div', { class: 'sub', text: '清单支数与画面实际插着的花完全一致，加损耗后按整扎取整' }),
    ]),
    el('div', { class: 'toolbar' }, [
      field('季节', select(SEASONS, project.season, async v => { project.season = v; await dbPut('projects', project); rerender() })),
      field('预算(元)', numInput(project.budget, async v => { project.budget = v; await dbPut('projects', project); rerender() }, 1000)),
      field('施工人数', numInput(project.crewSize, async v => { project.crewSize = Math.max(1, Math.round(v)); await dbPut('projects', project); rerender() })),
    ]),
  ])

  const tab = (sessionStorage.getItem('flora_order_tab') as 'order' | 'schedule') ?? 'order'
  const tabs = el('div', { class: 'tabs' }, [
    el('div', {
      class: `tab ${tab === 'order' ? 'active' : ''}`, text: '花材清单',
      onclick: () => { sessionStorage.setItem('flora_order_tab', 'order'); rerender() },
    }),
    el('div', {
      class: `tab ${tab === 'schedule' ? 'active' : ''}`, text: '搭建排程',
      onclick: () => { sessionStorage.setItem('flora_order_tab', 'schedule'); rerender() },
    }),
  ])

  root.append(head, tabs)
  if (tab === 'order') renderOrder(root, result, swap, over, project.budget, ctx.flowerMap, project.season)
  else renderSchedule(root)
}

function renderOrder(root: HTMLElement, result: ReturnType<typeof computeOrder>,
  swap: ReturnType<typeof budgetSwap>, over: boolean, budget: number,
  flowerMap: Map<string, FlowerVariety>, season: Season): void {
  if (result.lines.length === 0) {
    root.append(el('div', { class: 'card' }, [el('div', { class: 'empty' }, [
      el('div', { class: 't', text: '还没有布花数据' }),
      el('div', { text: '请先到「插花编辑」页对结构件自动布花' }),
    ])]))
    return
  }

  // 汇总
  root.append(el('div', { class: 'card' }, [
    el('div', { class: 'stat-row' }, [
      stat('实际用花', `${fmtInt(result.totalStems)} 支`),
      stat('采购金额', fmtMoney(result.total), over ? 'danger' : ''),
      stat('预算', fmtMoney(budget), ''),
      stat('预算差额', fmtMoney(result.total - budget), over ? 'danger' : 'ok'),
      ...result.byZone.map(z => stat(z.name, `${fmtInt(z.stems)} 支`)),
    ]),
  ]))

  // 明细
  const rows = result.lines.map(l => {
    const v = flowerMap.get(l.varietyId)
    const subs = l.shortage && v ? findSubstitutes(v, [...flowerMap.values()], season) : []
    return el('tr', { class: l.shortage ? 'row-warn' : '' }, [
      el('td', {}, [el('span', { class: 'badge', text: ZONE_NAMES[l.zone] })]),
      el('td', { text: l.name }),
      el('td', { class: 'num', text: fmtInt(l.count) }),
      el('td', { class: 'num', text: fmtInt(l.withLoss) }),
      el('td', { class: 'num', text: `${l.bunches}` }),
      el('td', { class: 'num', text: fmtInt(l.purchase) }),
      el('td', { class: 'num', text: `¥${l.price}` }),
      el('td', { class: 'num', text: fmtMoney(l.amount) }),
      el('td', {}, l.shortage
        ? [el('span', { class: 'badge warn', text: `缺货${Math.round(l.availability * 100)}%` }),
           el('div', { class: 'sub', text: subs.length ? `可换：${subs.map(s => s.name).join('/')}` : '无合适替代', style: 'color:var(--c-text-2)' })]
        : [el('span', { class: 'badge ok', text: '充足' })]),
    ])
  })
  root.append(el('div', { class: 'card' }, [
    el('h2', { text: '采购明细' }),
    el('table', { class: 'tbl' }, [
      el('thead', {}, [el('tr', {}, ['区域', '品种', '画面支数', '含损耗', '整扎', '采购支数', '单价', '金额', '到货'].map(t => el('th', { text: t })))]),
      el('tbody', {}, rows),
    ]),
    el('div', { class: 'toolbar', style: 'margin-top:12px' }, [
      el('button', { class: 'btn', text: '导出 CSV', onclick: () => exportCsv(result) }),
    ]),
  ]))

  // 超预算换花方案并排对比
  if (swap) {
    const cmpRows = swap.swaps.map(s => el('tr', {}, [
      el('td', {}, [el('span', { class: 'badge', text: ZONE_NAMES[s.zone] })]),
      el('td', { text: s.from }),
      el('td', { text: '→' }),
      el('td', { text: s.to, style: 'color:var(--c-accent);font-weight:500' }),
      el('td', { class: 'num', text: `省 ${fmtMoney(s.save)}` }),
    ]))
    root.append(el('div', { class: 'card' }, [
      el('h2', { text: '超预算换花方案' }),
      el('div', { class: 'stat-row', style: 'margin-bottom:16px' }, [
        stat('原方案', fmtMoney(swap.original.total), 'danger'),
        stat('换花后', fmtMoney(swap.optimizedTotal), swap.optimizedTotal > budget ? 'warn' : 'ok'),
        stat('节省', fmtMoney(swap.original.total - swap.optimizedTotal), 'ok'),
      ]),
      el('table', { class: 'tbl' }, [
        el('thead', {}, [el('tr', {}, ['区域', '原品种', '', '替换品种', '节省'].map(t => el('th', { text: t })))]),
        el('tbody', {}, cmpRows),
      ]),
    ]))
  }
}

function renderSchedule(root: HTMLElement): void {
  loadCtx().then(async ctx => {
    const project = ctx.projects.find(p => p.id === getCurrentProjectId()) ?? ctx.projects[0]
    if (!project) return
    const structures = ctx.structures.filter(s => s.projectId === project.id)
    const placements = new Map<string, PlacementRecord>()
    for (const r of await dbAll<PlacementRecord>('placements')) placements.set(r.id, r)
    const tasks = buildSchedule(project, structures, placements)
    if (tasks.length === 0) {
      root.append(el('div', { class: 'card' }, [el('div', { class: 'empty' }, [el('div', { class: 't', text: '没有结构件' })])]))
      return
    }
    const fmtT = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    root.append(el('div', { class: 'card' }, [
      el('h2', { text: `搭建顺序（吊顶优先 · ${project.crewSize}人 · ${project.entryTime.replace('T', ' ')} 进场）` }),
      el('table', { class: 'tbl' }, [
        el('thead', {}, [el('tr', {}, ['#', '阶段', '结构件', '工序', '人时', '人数', '工时h', '开始', '结束'].map(t => el('th', { text: t })))]),
        el('tbody', {}, tasks.map((t, i) => el('tr', {}, [
          el('td', { text: String(i + 1) }),
          el('td', {}, [el('span', { class: 'badge', text: t.phase })]),
          el('td', { text: t.structureName }),
          el('td', { text: t.work }),
          el('td', { class: 'num', text: String(t.manHours) }),
          el('td', { class: 'num', text: String(t.crew) }),
          el('td', { class: 'num', text: String(t.hours) }),
          el('td', { text: fmtT(t.start) }),
          el('td', { text: fmtT(t.end) }),
        ]))),
      ]),
    ]))
  })
}

function stat(k: string, v: string, cls: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('div', { class: `v ${cls}`, text: v }),
    el('div', { class: 'k', text: k }),
  ])
}

function exportCsv(result: ReturnType<typeof computeOrder>): void {
  const head = '区域,品种,画面支数,含损耗支数,整扎数,采购支数,单价,金额\n'
  const body = result.lines.map(l =>
    `${ZONE_NAMES[l.zone]},${l.name},${l.count},${l.withLoss},${l.bunches},${l.purchase},${l.price},${l.amount}`).join('\n')
  const blob = new Blob(['﻿' + head + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '花材采购清单.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
