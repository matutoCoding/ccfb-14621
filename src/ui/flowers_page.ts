// 花材库页：品种档案、季节价格与到货率、缺货替代建议
import { dbDel, dbPut } from '../lib/db'
import { el, field, fmt, numInput, select, textInput } from '../lib/dom'
import { CATEGORY_NAMES, FlowerCategory, FlowerVariety, SEASON_NAMES, Season, uid } from '../lib/types'
import { findSubstitutes } from '../core/order'
import { clearGeometryCache } from '../three/flower_geo'
import { loadCtx } from '../lib/state'

const CATS = Object.entries(CATEGORY_NAMES) as [FlowerCategory, string][]
const SEASONS = Object.entries(SEASON_NAMES) as [Season, string][]

export async function renderFlowersPage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  let season: Season = 'spring'
  let editing: FlowerVariety | null = null

  const rerender = () => { root.innerHTML = ''; renderFlowersPage(root) }

  const head = el('div', { class: 'page-head' }, [
    el('div', {}, [
      el('h1', { text: '花材库' }),
      el('div', { class: 'sub', text: '花头直径、枝长、每扎支数、损耗率与四季价格/到货率；淡季缺货自动给出替代建议' }),
    ]),
    el('div', { class: 'toolbar' }, [
      el('span', { class: 'badge', text: '查看季节' }),
      select(SEASONS, season, v => { season = v; rerender() }),
      el('button', { class: 'btn btn-primary', text: '新增品种', onclick: () => { editing = newBlank(); rerender() } }),
    ]),
  ])

  const rows = ctx.flowers.map(v => {
    const si = v.seasons[season]
    const shortage = si.availability < 0.6
    const subs = shortage ? findSubstitutes(v, ctx.flowers, season) : []
    return el('tr', { class: shortage ? 'row-warn' : '' }, [
      el('td', { text: v.name }),
      el('td', {}, [el('span', { class: 'badge', text: CATEGORY_NAMES[v.category] })]),
      el('td', { class: 'num', text: `${v.headDiameter}` }),
      el('td', { class: 'num', text: `${v.stemLength}` }),
      el('td', { class: 'num', text: `${v.bunchSize}` }),
      el('td', { class: 'num', text: `${Math.round(v.lossRate * 100)}%` }),
      el('td', { class: 'num', text: `¥${fmt(si.price)}` }),
      el('td', {}, [el('span', {
        class: `badge ${shortage ? 'warn' : 'ok'}`,
        text: shortage ? `缺货 ${Math.round(si.availability * 100)}%` : `${Math.round(si.availability * 100)}%`,
      })]),
      el('td', { text: subs.length > 0 ? `可换：${subs.map(s => s.name).join(' / ')}` : '', style: 'color:var(--c-text-2)' }),
      el('td', {}, [
        el('button', { class: 'btn btn-sm', text: '编辑', onclick: () => { editing = v; rerender() } }),
        el('button', {
          class: 'btn btn-sm btn-danger', text: '删除', style: 'margin-left:8px',
          onclick: async () => { if (confirm(`删除品种「${v.name}」？`)) { await dbDel('flowers', v.id); rerender() } },
        }),
      ]),
    ])
  })

  const tableCard = el('div', { class: 'card' }, [
    el('table', { class: 'tbl' }, [
      el('thead', {}, [el('tr', {}, ['品种', '类别', '花头cm', '枝长cm', '每扎', '损耗', `${SEASON_NAMES[season]}季价/支`, '到货率', '替代建议', ''].map(t => el('th', { text: t })))]),
      el('tbody', {}, rows),
    ]),
  ])

  root.append(head, tableCard)
  if (editing) root.append(editForm(editing, async saved => {
    await dbPut('flowers', saved)
    clearGeometryCache() // 花头尺寸可能变了，重建程序几何体
    editing = null
    rerender()
  }, () => { editing = null; rerender() }))
}

function newBlank(): FlowerVariety {
  const now = Date.now()
  const price = { price: 2, availability: 0.9 }
  return {
    id: uid(), name: '', category: 'main', form: 'rose',
    headDiameter: 8, stemLength: 50, bunchSize: 10, lossRate: 0.1, stemWeight: 40,
    colors: ['#e0e0e0'],
    seasons: { spring: { ...price }, summer: { ...price }, autumn: { ...price }, winter: { ...price } },
    createdAt: now, updatedAt: now,
  }
}

function editForm(v: FlowerVariety, onSave: (v: FlowerVariety) => void, onCancel: () => void): HTMLElement {
  const seasonInputs: [Season, string][] = SEASONS
  return el('div', { class: 'card' }, [
    el('h2', { text: ctx_name(v) }),
    el('div', { class: 'form-grid' }, [
      field('品种名称', textInput(v.name, x => { v.name = x })),
      field('类别', select(CATS, v.category, x => { v.category = x })),
      field('花头直径 cm', numInput(v.headDiameter, x => { v.headDiameter = x })),
      field('枝长 cm', numInput(v.stemLength, x => { v.stemLength = x })),
      field('每扎支数', numInput(v.bunchSize, x => { v.bunchSize = Math.max(1, Math.round(x)) })),
      field('损耗率 0-1', numInput(v.lossRate, x => { v.lossRate = x }, 0.01)),
      field('单支克重 g', numInput(v.stemWeight, x => { v.stemWeight = x })),
      field('颜色(逗号分隔)', textInput(v.colors.join(','), x => { v.colors = x.split(',').map(s => s.trim()).filter(Boolean) })),
    ]),
    el('h2', { text: '四季价格 / 到货率', style: 'margin-top:16px' }),
    el('div', { class: 'form-grid' }, seasonInputs.flatMap(([s, name]) => [
      field(`${name}季单价`, numInput(v.seasons[s].price, x => { v.seasons[s].price = x }, 0.1)),
      field(`${name}季到货率`, numInput(v.seasons[s].availability, x => { v.seasons[s].availability = x }, 0.05)),
    ])),
    el('div', { class: 'toolbar', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn-primary', text: '保存', onclick: () => {
        if (!v.name.trim()) { alert('请填写品种名称'); return }
        v.updatedAt = Date.now()
        onSave(v)
      } }),
      el('button', { class: 'btn', text: '取消', onclick: onCancel }),
    ]),
  ])
}

const ctx_name = (v: FlowerVariety) => v.name ? `编辑：${v.name}` : '新增品种'
