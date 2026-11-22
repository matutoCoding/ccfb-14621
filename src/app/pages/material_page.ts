import { h, mount, toast } from '@/core/dom'
import { SEASONS } from '@/core/constants'
import { store, uid } from '@/core/store'
import type { FlowerCategory, FlowerMaterial } from '@/types'

const CATEGORY_LABEL: Record<FlowerCategory, string> = {
  main: '主花',
  filler: '配花',
  green: '叶材'
}

export function renderMaterialPage(container: HTMLElement): void {
  let filter: FlowerCategory | 'all' = 'all'
  let editingId = store.state.materials[0]?.id ?? ''

  const draw = (): void => {
    const materials = store.state.materials.filter((item) => filter === 'all' || item.category === filter)
    const editing = store.state.materials.find((item) => item.id === editingId) ?? store.state.materials[0]
    editingId = editing?.id ?? ''

    const toolbar = h('div', { class: 'toolbar' }, [
      ...(['all', 'main', 'filler', 'green'] as const).map((value) =>
        h('button', {
          class: filter === value ? 'primary' : '',
          onclick: () => {
            filter = value
            draw()
          }
        }, [value === 'all' ? '全部' : CATEGORY_LABEL[value]])
      ),
      h('button', {
        class: 'primary',
        onclick: async () => {
          const created: FlowerMaterial = {
            id: uid('m'),
            name: '新花材',
            category: 'main',
            headDiameterCm: 6,
            stemLengthCm: 50,
            perBunch: 20,
            lossRate: 0.1,
            baseColor: '#e8c9a0',
            seasons: SEASONS.map((season) => ({ season, pricePerBunch: 40, arrivalRate: 0.85 })),
            replacements: []
          }
          await store.saveMaterial(created)
          editingId = created.id
          draw()
        }
      }, ['新增品种'])
    ])

    const table = h('div', { class: 'table-wrap' }, [
      h('table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['品种']), h('th', {}, ['类别']), h('th', {}, ['花头cm']), h('th', {}, ['枝长cm']),
          h('th', {}, ['支/扎']), h('th', {}, ['损耗']), h('th', {}, ['当季到货率']), h('th', {}, ['状态'])
        ])]),
        h('tbody', {}, materials.map((item) => {
          const current = item.seasons.find((season) => season.season === currentSeason()) ?? item.seasons[0]
          const shortage = current.arrivalRate < 0.7
          return h('tr', {
            style: item.id === editingId ? 'background:var(--c-primary-soft)' : '',
            onclick: () => {
              editingId = item.id
              draw()
            }
          }, [
            h('td', {}, [h('span', { class: 'row' }, [h('span', { class: 'color-dot', style: `background:${item.baseColor}` }), item.name])]),
            h('td', {}, [CATEGORY_LABEL[item.category]]),
            h('td', {}, [String(item.headDiameterCm)]),
            h('td', {}, [String(item.stemLengthCm)]),
            h('td', {}, [String(item.perBunch)]),
            h('td', {}, [`${Math.round(item.lossRate * 100)}%`]),
            h('td', {}, [`${Math.round(current.arrivalRate * 100)}%`]),
            h('td', {}, [shortage ? h('span', { class: 'badge warning' }, ['淡季缺货']) : h('span', { class: 'badge success' }, ['供应稳定'])])
          ])
        }))
      ])
    ])

    const side = h('div', { class: 'side-panel' })
    if (editing) mount(side, materialForm(editing, draw))

    mount(container, h('div', { class: 'col' }, [
      toolbar,
      table,
      shortageBanner(),
      h('div', { style: 'height:var(--sp-4)' }),
      editing ? side : h('span')
    ]))
  }

  draw()
}

function currentSeason(): string {
  const month = new Date().getMonth() + 1
  if (month <= 3) return '春季'
  if (month <= 6) return '夏季'
  if (month <= 9) return '秋季'
  return '冬季'
}

function shortageBanner(): HTMLElement {
  const season = currentSeason()
  const short = store.state.materials.filter((item) => {
    const current = item.seasons.find((entry) => entry.season === season) ?? item.seasons[0]
    return current.arrivalRate < 0.7
  })
  if (short.length === 0) {
    return h('div', { class: 'warning-banner' }, [
      h('strong', {}, ['季节提示']),
      h('span', {}, [`${season}全部品种到货率不低于 70%，暂无缺货风险`])
    ])
  }
  return h('div', { class: 'warning-banner' }, [
    h('strong', {}, ['淡季替代建议']),
    h('div', { class: 'col' }, short.map((item) => {
      const replacements = item.replacements
        .map((id) => store.materialMap.get(id))
        .filter((candidate): candidate is FlowerMaterial => Boolean(candidate))
        .map((candidate) => {
          const seasonal = candidate.seasons.find((entry) => entry.season === season) ?? candidate.seasons[0]
          return `${candidate.name}（到货率 ${Math.round(seasonal.arrivalRate * 100)}%）`
        })
      return h('span', {}, [`${item.name} → ${replacements.join(' / ') || '暂无同类替代'}`])
    }))
  ])
}

function materialForm(material: FlowerMaterial, redraw: () => void): HTMLElement {
  const field = (label: string, input: HTMLElement) => h('div', { class: 'field' }, [h('label', {}, [label]), input])
  const card = h('div', { class: 'card col' })

  const numeric = (key: keyof FlowerMaterial, step: number, fractionDigits = 0) =>
    h('input', {
      type: 'number',
      step: String(step),
      value: String(material[key] as number),
      oninput: (event: Event) => {
        const value = Number.parseFloat((event.target as HTMLInputElement).value)
        if (Number.isFinite(value)) {
          ;(material[key] as number) = value
        }
      }
    })

  mount(card, h('div', { class: 'col' }, [
    h('div', { class: 'row spread' }, [
      h('h3', {}, ['品种详情']),
      h('button', {
        class: 'danger',
        onclick: async () => {
          if (window.confirm(`确认删除 ${material.name}？已布在方案里的花会失去品种映射`)) {
            await store.removeMaterial(material.id)
            redraw()
          }
        }
      }, ['删除品种'])
    ]),
    field('名称', h('input', { value: material.name, oninput: (event: Event) => { material.name = (event.target as HTMLInputElement).value } })),
    h('div', { class: 'form-grid' }, [
      field('类别', h('select', {
        onchange: (event: Event) => {
          material.category = (event.target as HTMLSelectElement).value as FlowerCategory
          redraw()
        }
      }, (['main', 'filler', 'green'] as FlowerCategory[]).map((value) => {
        const option = h('option', { value: value }, [CATEGORY_LABEL[value]])
        option.selected = material.category === value
        return option
      }))),
      field('基色', h('input', { type: 'color', value: material.baseColor, oninput: (event: Event) => { material.baseColor = (event.target as HTMLInputElement).value; redraw() } })),
      field('花头直径(cm)', numeric('headDiameterCm', 0.5)),
      field('枝长(cm)', numeric('stemLengthCm', 1)),
      field('每扎支数', numeric('perBunch', 1)),
      field('损耗率', numeric('lossRate', 0.01))
    ]),
    h('h3', {}, ['季节价格与到货率']),
    h('div', { class: 'table-wrap' }, [
      h('table', {}, [
        h('thead', {}, [h('tr', {}, [h('th', {}, ['季节']), h('th', {}, ['扎价(元)']), h('th', {}, ['到货率'])])]),
        h('tbody', {}, material.seasons.map((seasonal) => h('tr', {}, [
          h('td', {}, [seasonal.season]),
          h('td', {}, [h('input', {
            type: 'number', step: '1', value: String(seasonal.pricePerBunch),
            oninput: (event: Event) => { seasonal.pricePerBunch = Number((event.target as HTMLInputElement).value) }
          })]),
          h('td', {}, [h('input', {
            type: 'range', min: '0.2', max: '1', step: '0.05', value: String(seasonal.arrivalRate),
            oninput: (event: Event) => {
              seasonal.arrivalRate = Number((event.target as HTMLInputElement).value)
              redraw()
            }
          })])
        ])))
      ])
    ]),
    h('p', { class: 'muted' }, ['替代品种从同类花材自动匹配，缺货时下单页会给出并排比价']),
    h('button', {
      class: 'primary',
      onclick: async () => {
        await store.saveMaterial(material)
        toast(`${material.name} 已保存`, 'success')
      }
    }, ['保存品种'])
  ]))
  return card
}
