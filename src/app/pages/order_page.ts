import { h, mount, toast } from '@/core/dom'
import {
  buildChecksum,
  buildOrderLines,
  buildOrderLinesByRole,
  buildPlan,
  checkHangLoads,
  orderTotal,
  replacementPlan
} from '@/core/calc'
import { store } from '@/core/store'
import type { DesignScheme, FlowerMaterial, OrderLine } from '@/types'
import { fmtMoney, fmtNum } from '@/core/dom'

export function renderOrderPage(container: HTMLElement): void {
  const draw = (): void => {
    const scheme = store.currentScheme
    if (!scheme) {
      mount(container, h('div', { class: 'empty-state' }, [
        h('div', { class: 'empty-icon' }, ['单']),
        h('h3', {}, ['没有选中方案']),
        h('p', { class: 'muted' }, ['先在结构搭建页选择方案，完成插花后这里自动出核算清单'])
      ]))
      return
    }

    const map = store.materialMap
    const lines = buildOrderLines(scheme, map)
    const roleLines = buildOrderLinesByRole(scheme, map)
    const total = orderTotal(lines)
    const checksum = buildChecksum(scheme, lines)
    const overBudget = total > scheme.budget
    const venue = store.state.venues.find((item) => item.id === scheme.venueId)
    const loadWarnings = checkHangLoads(scheme, venue, map)
    const tasks = buildPlan(scheme, map)

    mount(container, h('div', { class: 'col' }, [
      summaryBar(lines, total, scheme.budget, checksum),
      ...loadWarnings.map((warning) => h('div', { class: 'warning-banner danger-banner' }, [h('strong', {}, ['吊点问题']), h('span', {}, [warning.message])])),
      overBudget
        ? h('div', { class: 'warning-banner' }, [
            h('strong', {}, ['超预算']),
            h('span', {}, [`合计 ${fmtMoney(total)}，超出预算 ${fmtMoney(total - scheme.budget)}，可参考下方换花方案压缩成本`])
          ])
        : h('div', { class: 'warning-banner' }, [
            h('strong', {}, ['预算情况']),
            h('span', {}, [`合计 ${fmtMoney(total)}，预算内剩余 ${fmtMoney(scheme.budget - total)}`])
          ]),
      roleSections(scheme, roleLines),
      masterTable(lines, scheme.season, map),
      buildSchedule(tasks),
      h('div', { style: 'height:var(--sp-5)' })
    ]))
  }

  draw()
}

function summaryBar(lines: OrderLine[], total: number, budget: number, checksum: ReturnType<typeof buildChecksum>): HTMLElement {
  const totalBunches = lines.reduce((sum, line) => sum + line.bunches, 0)
  const lowArrival = lines.filter((line) => line.arrivalRate < 0.7).length
  return h('div', { class: 'stat-grid' }, [
    h('div', { class: 'stat-tile' }, [h('div', { class: 'stat-value primary-text' }, [fmtNum(checksum.rendered)]), h('div', { class: 'stat-label' }, ['画面实际花朵'])]),
    h('div', { class: 'stat-tile' }, [
      h('div', { class: `stat-value ${checksum.matched ? 'success-text checksum-ok' : 'checksum-bad'}` }, [checksum.matched ? '一朵不差' : '对不上!']),
      h('div', { class: 'stat-label' }, [`清单 ${fmtNum(checksum.orderedHeads)} 朵，同源校验`])
    ]),
    h('div', { class: 'stat-tile' }, [h('div', { class: 'stat-value' }, [fmtNum(totalBunches)]), h('div', { class: 'stat-label' }, ['总扎数（含损耗取整）'])]),
    h('div', { class: 'stat-tile' }, [
      h('div', { class: `stat-value ${total > budget ? 'danger-text' : ''}` }, [fmtMoney(total)]),
      h('div', { class: 'stat-label' }, [`预算 ${fmtMoney(budget)}${lowArrival > 0 ? ` · ${lowArrival} 个品种到货率低` : ''}`])
    ])
  ])
}

function roleSections(
  scheme: DesignScheme,
  roleLines: Map<string, OrderLine[]>
): HTMLElement {
  return h('div', { class: 'list-stack' }, scheme.structures.map((node) => {
    const lines = roleLines.get(node.id) ?? []
    const subtotal = orderTotal(lines)
    return h('div', { class: 'card col' }, [
      h('div', { class: 'row spread' }, [
        h('h3', {}, [`${node.label} · ${node.role}`]),
        h('span', { class: 'badge primary' }, [fmtMoney(subtotal)])
      ]),
      lines.length === 0
        ? h('p', { class: 'muted' }, ['该结构还没有插花，去插花编辑页布花'])
        : h('div', { class: 'table-wrap' }, [
            h('table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['品种']), h('th', {}, ['类别']), h('th', {}, ['需求朵数']),
                h('th', {}, ['损耗朵数']), h('th', {}, ['支/扎']), h('th', {}, ['下单扎数']),
                h('th', {}, ['扎价']), h('th', {}, ['小计'])
              ])]),
              h('tbody', {}, lines.map((line) => h('tr', {}, [
                h('td', {}, [line.name]),
                h('td', {}, [line.category === 'main' ? '主花' : line.category === 'filler' ? '配花' : '叶材']),
                h('td', {}, [fmtNum(line.heads)]),
                h('td', {}, [fmtNum(line.lossHeads)]),
                h('td', {}, [String(line.perBunch)]),
                h('td', {}, [fmtNum(line.bunches)]),
                h('td', {}, [fmtMoney(line.unitPrice)]),
                h('td', {}, [fmtMoney(line.subtotal)])
              ])))
            ])
          ])
    ])
  }))
}

function masterTable(
  lines: OrderLine[],
  season: string,
  map: Map<string, FlowerMaterial>
): HTMLElement {
  return h('div', { class: 'card col' }, [
    h('h3', {}, ['全方案汇总采购单（按品种合并）']),
    h('div', { class: 'table-wrap' }, [
      h('table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['品种']), h('th', {}, ['总朵数']), h('th', {}, ['含损耗']),
          h('th', {}, ['扎数']), h('th', {}, [`${season}到货率`]), h('th', {}, ['小计']), h('th', {}, ['换花并排比'])
        ])]),
        h('tbody', {}, lines.map((line) => {
          const material = map.get(line.materialId)
          const alternatives = material ? replacementPlan(line, material, map as never, season) : []
          return h('tr', {}, [
            h('td', {}, [line.name]),
            h('td', {}, [fmtNum(line.heads)]),
            h('td', {}, [fmtNum(line.heads + line.lossHeads)]),
            h('td', {}, [fmtNum(line.bunches)]),
            h('td', {}, [
              h('span', { class: line.arrivalRate < 0.7 ? 'badge warning' : 'badge success' }, [`${Math.round(line.arrivalRate * 100)}%`])
            ]),
            h('td', {}, [fmtMoney(line.subtotal)]),
            h('td', {}, [alternatives.length > 0
              ? h('div', { class: 'col' }, alternatives.slice(0, 3).map((candidate) => {
                  const delta = candidate.subtotal - line.subtotal
                  return h('span', { class: delta <= 0 ? 'success-text' : 'warning-text' }, [
                    `${candidate.name}：${fmtNum(candidate.bunches)} 扎 / ${fmtMoney(candidate.subtotal)}（${delta <= 0 ? '省' : '贵'} ${fmtMoney(Math.abs(delta))}，到货率 ${Math.round(candidate.arrivalRate * 100)}%）`
                  ])
                }))
              : h('span', { class: 'faint' }, ['无替代'])])
          ])
        }))
      ])
    ]),
    h('button', {
      onclick: () => {
        const csv = toCsv(lines)
        const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `花材采购单_${Date.now()}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
        toast('采购单 CSV 已导出，发给花市拿货', 'success')
      }
    }, ['导出采购单 CSV'])
  ])
}

function buildSchedule(tasks: ReturnType<typeof buildPlan>): HTMLElement {
  return h('div', { class: 'card col' }, [
    h('h3', {}, ['前夜进场搭建顺序']),
    h('p', { class: 'muted' }, ['吊顶作业排在最前，地面组立与插花随后；工时按铁艺组立与每 45 支/人时插花效率估算']),
    h('div', { class: 'table-wrap' }, [
      h('table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['顺序']), h('th', {}, ['作业项']), h('th', {}, ['类型']),
          h('th', {}, ['骨架工时']), h('th', {}, ['插花工时']), h('th', {}, ['建议人手']), h('th', {}, ['说明'])
        ])]),
        h('tbody', {}, tasks.map((task) => h('tr', {}, [
          h('td', {}, [String(task.order)]),
          h('td', {}, [task.title]),
          h('td', {}, [task.isCeiling ? h('span', { class: 'badge primary' }, ['吊顶优先']) : h('span', { class: 'badge' }, [task.role])]),
          h('td', {}, [`${task.skeletonMinutes} 分钟`]),
          h('td', {}, [`${task.flowerMinutes} 分钟`]),
          h('td', {}, [`${task.crew} 人`]),
          h('td', {}, [task.detail])
        ])))
      ])
    ])
  ])
}

function toCsv(lines: OrderLine[]): string {
  const header = ['品种', '类别', '需求朵数', '损耗朵数', '含损耗总量', '每扎支数', '下单扎数', '扎价', '小计', '到货率']
  const rows = lines.map((line) => [
    line.name,
    line.category,
    line.heads,
    line.lossHeads,
    line.heads + line.lossHeads,
    line.perBunch,
    line.bunches,
    line.unitPrice,
    line.subtotal,
    `${Math.round(line.arrivalRate * 100)}%`
  ])
  return [header, ...rows].map((row) => row.join(',')).join('\n')
}
