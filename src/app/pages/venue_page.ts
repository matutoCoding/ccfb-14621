import { h, mount, toast } from '@/core/dom'
import { store, uid } from '@/core/store'
import type { Venue } from '@/types'
import { createViewer, disposeViewer } from '../view_helper'
import type { Viewer } from '@/three/viewer'

export function renderVenuePage(container: HTMLElement): void {
  let selectedId = store.state.venues[0]?.id ?? ''
  let viewer: Viewer | null = null

  const draw = (): void => {
    if (viewer) {
      disposeViewer(viewer)
      viewer = null
    }
    const venues = store.state.venues
    const venue = venues.find((item) => item.id === selectedId) ?? venues[0]
    selectedId = venue?.id ?? ''

    const viewerCard = h('div', { class: 'viewer-card' })
    const listColumn = h('div', { class: 'col' })
    const formColumn = h('div', { class: 'side-panel' })

    mount(
      listColumn,
      h('div', { class: 'col' }, [
        h('div', { class: 'toolbar' }, [
          h('button', {
            class: 'primary',
            onclick: async () => {
              const created: Venue = {
                id: uid('v'),
                name: '新宴会厅',
                ceilingHeightM: 6,
                hallWidthM: 16,
                hallLengthM: 20,
                stageWidthM: 8,
                stageLengthM: 10,
                hangPoints: [],
                tables: [],
                note: ''
              }
              await store.saveVenue(created)
              selectedId = created.id
              draw()
            }
          }, ['新建场地']),
          venue
            ? h('button', {
                class: 'danger',
                onclick: async () => {
                  if (window.confirm(`确认删除 ${venue.name}？`)) {
                    await store.removeVenue(venue.id)
                    draw()
                  }
                }
              }, ['删除'])
            : h('span')
        ]),
        h('div', { class: 'list-stack' }, venues.map((item) =>
          h('div', {
            class: `list-item ${item.id === selectedId ? 'selected' : ''}`,
            onclick: () => {
              selectedId = item.id
              draw()
            }
          }, [
            h('div', { class: 'row spread' }, [h('strong', {}, [item.name]), h('span', { class: 'badge' }, [`${item.hangPoints.length} 吊点`])]),
            h('p', { class: 'muted' }, [`层高 ${item.ceilingHeightM}m · T台 ${item.stageLengthM}m · ${item.tables.length} 桌`])
          ])
        ))
      ])
    )

    if (venue) {
      mount(formColumn, venueForm(venue, draw))
      mount(container, h('div', { class: 'page-grid' }, [viewerCard, listColumn, formColumn]))
      viewer = createViewer(viewerCard)
      viewer.addContent(viewer.buildVenue(venue))
      viewer.setView([venue.hallWidthM * 0.55, venue.ceilingHeightM * 0.9, venue.hallLengthM * 0.5], [0, 2, -2])
    } else {
      mount(container, h('div', { class: 'page-grid' }, [viewerCard, listColumn, formColumn]))
      mount(viewerCard, h('div', { class: 'empty-state' }, [h('h3', {}, ['还没有场地']), h('p', { class: 'muted' }, ['新建一个宴会厅档案开始'])]))
    }
  }

  draw()
}

function venueForm(venue: Venue, redraw: () => void): HTMLElement {
  const field = (label: string, input: HTMLElement) => h('div', { class: 'field' }, [h('label', {}, [label]), input])
  const card = h('div', { class: 'card col' })

  const nameInput = h('input', { value: venue.name })
  nameInput.addEventListener('input', () => {
    venue.name = nameInput.value
  })
  const noteInput = h('textarea', { rows: 2 }, [venue.note])
  noteInput.addEventListener('input', () => {
    venue.note = noteInput.value
  })

  const numericField = (label: string, key: keyof Venue, step: number) =>
    field(label, h('input', {
      type: 'number',
      step: String(step),
      value: String(venue[key] as number),
      oninput: (event: Event) => {
        const value = Number.parseFloat((event.target as HTMLInputElement).value)
        if (Number.isFinite(value)) {
          ;(venue[key] as number) = value
          redraw()
        }
      }
    }))

  const pointEditor = (point: Venue['hangPoints'][number]) =>
    h('div', { class: 'form-grid' }, [
      h('div', { class: 'field' }, [h('label', {}, ['X(m)']), h('input', {
        type: 'number', step: '0.5', value: String(point.x),
        oninput: (event: Event) => { point.x = Number((event.target as HTMLInputElement).value); redraw() }
      })]),
      h('div', { class: 'field' }, [h('label', {}, ['Z(m)']), h('input', {
        type: 'number', step: '0.5', value: String(point.z),
        oninput: (event: Event) => { point.z = Number((event.target as HTMLInputElement).value); redraw() }
      })]),
      h('div', { class: 'field' }, [h('label', {}, ['承重(kg)']), h('input', {
        type: 'number', step: '5', value: String(point.maxLoadKg),
        oninput: (event: Event) => { point.maxLoadKg = Number((event.target as HTMLInputElement).value) }
      })])
    ])

  mount(card, h('div', { class: 'col' }, [
    h('h3', {}, ['宴会厅参数']),
    field('场地名称', nameInput),
    h('div', { class: 'form-grid' }, [
      numericField('层高(m)', 'ceilingHeightM', 0.1),
      numericField('厅宽(m)', 'hallWidthM', 0.5),
      numericField('厅长(m)', 'hallLengthM', 0.5),
      numericField('T台宽(m)', 'stageWidthM', 0.5),
      numericField('T台长(m)', 'stageLengthM', 0.5)
    ]),
    field('备注', noteInput),
    h('div', { class: 'toolbar' }, [
      h('button', {
        onclick: () => {
          venue.hangPoints.push({ id: uid('hp'), x: 0, z: 0, y: venue.ceilingHeightM, maxLoadKg: 50 })
          redraw()
        }
      }, ['加吊点']),
      h('button', {
        onclick: () => {
          const index = venue.tables.length + 1
          venue.tables.push({ id: uid('tb'), label: `${index}号桌`, x: 0, z: -index, radiusM: 1.8, seats: 10 })
          redraw()
        }
      }, ['加桌位'])
    ]),
    h('div', { class: 'list-stack' }, [
      ...venue.hangPoints.map((point) =>
        h('div', { class: 'card' }, [
          h('div', { class: 'row spread' }, [h('strong', {}, [`吊点 ${point.id}`]), h('button', {
            class: 'danger ghost',
            onclick: () => {
              venue.hangPoints = venue.hangPoints.filter((item) => item.id !== point.id)
              redraw()
            }
          }, ['删除'])]),
          pointEditor(point)
        ])
      ),
      ...venue.tables.map((table) =>
        h('div', { class: 'card' }, [
          h('div', { class: 'row spread' }, [h('strong', {}, [table.label]), h('button', {
            class: 'danger ghost',
            onclick: () => {
              venue.tables = venue.tables.filter((item) => item.id !== table.id)
              redraw()
            }
          }, ['删除'])]),
          h('div', { class: 'form-grid' }, [
            h('div', { class: 'field' }, [h('label', {}, ['X / Z(m)']), h('input', {
              value: `${table.x}, ${table.z}`,
              onchange: (event: Event) => {
                const [x, z] = (event.target as HTMLInputElement).value.split(',').map((part) => Number(part.trim()))
                if (Number.isFinite(x)) table.x = x
                if (Number.isFinite(z)) table.z = z
                redraw()
              }
            })]),
            h('div', { class: 'field' }, [h('label', {}, ['半径 / 人数']), h('input', {
              value: `${table.radiusM}, ${table.seats}`,
              onchange: (event: Event) => {
                const [radius, seats] = (event.target as HTMLInputElement).value.split(',').map((part) => Number(part.trim()))
                if (Number.isFinite(radius)) table.radiusM = radius
                if (Number.isFinite(seats)) table.seats = seats
                redraw()
              }
            })])
          ])
        ])
      )
    ]),
    h('button', {
      class: 'primary',
      onclick: async () => {
        await store.saveVenue(venue)
        toast('场地档案已保存', 'success')
      }
    }, ['保存档案'])
  ]))
  return card
}
