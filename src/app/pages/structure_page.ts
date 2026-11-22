import * as THREE from 'three'
import { h, mount, toast } from '@/core/dom'
import { SEASONS } from '@/core/constants'
import { checkHangLoads, structureLoadKg } from '@/core/calc'
import { createDemoStructures, createScheme, createStructure, STRUCTURE_META } from '@/core/factory'
import { store } from '@/core/store'
import type { DesignScheme, StructureNode, StructureType } from '@/types'
import { buildFrame, buildZoneMesh } from '@/three/frames'
import { createViewer, disposeViewer } from '../view_helper'
import type { Viewer } from '@/three/viewer'

export function renderStructurePage(container: HTMLElement): void {
  let viewer: Viewer | null = null
  let selectedNodeId = ''

  const draw = (): void => {
    if (viewer) {
      disposeViewer(viewer)
      viewer = null
    }
    const scheme = store.currentScheme
    const venue = store.state.venues.find((item) => item.id === scheme?.venueId)
    const viewerCard = h('div', { class: 'viewer-card' })
    const side = h('div', { class: 'side-panel' })

    mount(container, h('div', { class: 'page-grid' }, [viewerCard, side]))

    if (!scheme) {
      mount(side, schemeCreator())
      mount(viewerCard, h('div', { class: 'empty-state' }, [
        h('div', { class: 'empty-icon' }, ['架']),
        h('h3', {}, ['还没有设计方案']),
        h('p', { class: 'muted' }, ['先选场地新建方案，再拼铁艺骨架'])
      ]))
      return
    }

    const selected = scheme.structures.find((node) => node.id === selectedNodeId) ?? scheme.structures[0]
    selectedNodeId = selected?.id ?? ''
    const warnings = checkHangLoads(scheme, venue, store.materialMap)

    mount(side, h('div', { class: 'col' }, [
      schemeHeader(scheme),
      structureList(scheme, selectedNodeId, (id) => {
        selectedNodeId = id
        draw()
      }),
      addStructureBar(scheme, draw),
      ...warnings.map((warning) => h('div', { class: 'warning-banner danger-banner' }, [
        h('strong', {}, ['承重超限']),
        h('span', {}, [warning.message])
      ])),
      selected ? nodeEditor(selected, scheme, draw) : h('span'),
      h('button', {
        class: 'primary',
        onclick: async () => {
          await store.saveScheme(scheme)
          toast('结构方案已保存', 'success')
        }
      }, ['保存方案'])
    ]))

    viewer = createViewer(viewerCard)
    if (venue) viewer.addContent(viewer.buildVenue(venue))
    for (const node of scheme.structures) {
      const group = new THREE.Group()
      group.name = `structure-${node.id}`
      group.userData.label = node.label
      group.position.set(...node.position)
      group.rotation.y = node.rotationY
      group.add(buildFrame(node))
      for (const zone of node.zones) group.add(buildZoneMesh(node, zone))
      viewer.addContent(group)
      if (node.type === 'hanger' && node.hangPointId && venue) {
        const point = venue.hangPoints.find((item) => item.id === node.hangPointId)
        if (point) {
          const cable = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, Math.max(0.2, point.y - node.position[1]), 5),
            new THREE.MeshStandardMaterial({ color: 0xd49a5c })
          )
          cable.position.set(point.x - node.position[0], (point.y - node.position[1]) / 2, point.z - node.position[2])
          group.add(cable)
        }
      }
    }
    viewer.setView([7, 6, 10], [0, 2, 0])
  }

  draw()
}

function schemeCreator(): HTMLElement {
  const venueId = store.state.venues[0]?.id ?? ''
  return h('div', { class: 'card col' }, [
    h('h3', {}, ['新建设计方案']),
    h('div', { class: 'field' }, [
      h('label', {}, ['选择场地']),
      h('select', { id: 'new-scheme-venue' }, store.state.venues.map((venue) => h('option', { value: venue.id }, [venue.name])))
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, ['婚礼季节']),
      h('select', { id: 'new-scheme-season' }, SEASONS.map((season) => h('option', {}, [season])))
    ]),
    h('button', {
      class: 'primary',
      onclick: async () => {
        const select = document.querySelector<HTMLSelectElement>('#new-scheme-venue')
        const seasonSelect = document.querySelector<HTMLSelectElement>('#new-scheme-season')
        if (!select?.value) {
          toast('请先在场地档案里建场地', 'warning')
          return
        }
        const scheme = createScheme(select.value, seasonSelect?.value ?? SEASONS[0])
        scheme.structures = createDemoStructures()
        await store.saveScheme(scheme)
        toast('已生成演示方案，可直接去插花编辑', 'success')
      }
    }, ['新建并生成演示结构'])
  ])
}

function schemeHeader(scheme: DesignScheme): HTMLElement {
  return h('div', { class: 'card col' }, [
    h('div', { class: 'field' }, [
      h('label', {}, ['方案名称']),
      h('input', { value: scheme.name, oninput: (event: Event) => { scheme.name = (event.target as HTMLInputElement).value } })
    ]),
    h('div', { class: 'form-grid' }, [
      h('div', { class: 'field' }, [
        h('label', {}, ['季节']),
        h('select', {
          onchange: (event: Event) => { scheme.season = (event.target as HTMLSelectElement).value }
        }, SEASONS.map((season) => {
          const option = h('option', {}, [season])
          option.selected = scheme.season === season
          return option
        }))
      ]),
      h('div', { class: 'field' }, [
        h('label', {}, ['预算(元)']),
        h('input', { type: 'number', step: '1000', value: String(scheme.budget), oninput: (event: Event) => { scheme.budget = Number((event.target as HTMLInputElement).value) } })
      ])
    ])
  ])
}

function structureList(scheme: DesignScheme, selectedId: string, onSelect: (id: string) => void): HTMLElement {
  return h('div', { class: 'list-stack' }, scheme.structures.map((node) => {
    const load = node.type === 'hanger' ? structureLoadKg(node, store.materialMap) : null
    return h('div', {
      class: `list-item ${node.id === selectedId ? 'selected' : ''}`,
      onclick: () => onSelect(node.id)
    }, [
      h('div', { class: 'row spread' }, [h('strong', {}, [node.label]), h('span', { class: 'badge primary' }, [node.role])]),
      h('p', { class: 'muted' }, [
        `${node.zones.length} 个花泥区`,
        load !== null ? ` · 估算 ${load}kg` : ''
      ])
    ])
  }))
}

function addStructureBar(scheme: DesignScheme, redraw: () => void): HTMLElement {
  return h('div', { class: 'card col' }, [
    h('h3', {}, ['添加铁艺件']),
    h('div', { class: 'row-wrap' }, (Object.keys(STRUCTURE_META) as StructureType[]).map((type) =>
      h('button', {
        onclick: async () => {
          const index = scheme.structures.filter((node) => node.type === type).length + 1
          const node = createStructure(type, index, [0, type === 'hanger' ? 5 : 0, 0])
          scheme.structures.push(node)
          await store.saveScheme(scheme)
          redraw()
        }
      }, [STRUCTURE_META[type].label])
    ))
  ])
}

function nodeEditor(node: StructureNode, scheme: DesignScheme, redraw: () => void): HTMLElement {
  const venue = store.state.venues.find((item) => item.id === scheme.venueId)
  const paramInputs = Object.keys(node.params).map((key) =>
    h('div', { class: 'field' }, [
      h('label', {}, [key]),
      h('input', {
        type: 'number', step: '0.05', value: String(node.params[key]),
        oninput: (event: Event) => {
          node.params[key] = Number((event.target as HTMLInputElement).value)
          redraw()
        }
      })
    ])
  )

  const positionInputs = (['x', 'y', 'z'] as const).map((axis, index) =>
    h('div', { class: 'field' }, [
      h('label', {}, [`位置 ${axis.toUpperCase()}(m)`]),
      h('input', {
        type: 'number', step: '0.1', value: String(node.position[index]),
        oninput: (event: Event) => {
          node.position[index] = Number((event.target as HTMLInputElement).value)
          redraw()
        }
      })
    ])
  )

  return h('div', { class: 'card col' }, [
    h('div', { class: 'row spread' }, [
      h('h3', {}, ['骨架参数']),
      h('button', {
        class: 'danger ghost',
        onclick: async () => {
          scheme.structures = scheme.structures.filter((item) => item.id !== node.id)
          await store.saveScheme(scheme)
          redraw()
        }
      }, ['删除结构'])
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, ['名称']),
      h('input', { value: node.label, oninput: (event: Event) => { node.label = (event.target as HTMLInputElement).value; redraw() } })
    ]),
    h('div', { class: 'field' }, [
      h('label', {}, ['用途角色（下单分组依据）']),
      h('select', {
        onchange: (event: Event) => { node.role = (event.target as HTMLSelectElement).value }
      }, ['主桌', '路引', '拱门', '吊顶'].map((role) => {
        const option = h('option', {}, [role])
        option.selected = node.role === role
        return option
      }))
    ]),
    h('div', { class: 'form-grid' }, paramInputs),
    h('div', { class: 'form-grid' }, positionInputs),
    h('div', { class: 'field' }, [
      h('label', {}, ['朝向旋转(度)']),
      h('input', {
        type: 'range', min: '-180', max: '180', step: '5', value: String(THREE.MathUtils.radToDeg(node.rotationY)),
        oninput: (event: Event) => {
          node.rotationY = THREE.MathUtils.degToRad(Number((event.target as HTMLInputElement).value))
          redraw()
        }
      })
    ]),
    node.type === 'hanger'
      ? h('div', { class: 'field' }, [
          h('label', {}, ['绑定吊点']),
          h('select', {
            onchange: (event: Event) => { node.hangPointId = (event.target as HTMLSelectElement).value || null }
          }, [
            h('option', { value: '' }, ['未绑定']),
            ...(venue?.hangPoints ?? []).map((point) => {
              const option = h('option', { value: point.id }, [`${point.id} · 限重 ${point.maxLoadKg}kg`])
              option.selected = node.hangPointId === point.id
              return option
            })
          ])
        ])
      : h('span'),
    zoneEditor(node, redraw)
  ])
}

function zoneEditor(node: StructureNode, redraw: () => void): HTMLElement {
  return h('div', { class: 'col' }, [
    h('h3', {}, ['花泥 / 网格区域']),
    ...node.zones.map((zone) =>
      h('div', { class: 'card col' }, [
        h('div', { class: 'row spread' }, [h('strong', {}, [zone.label]), h('span', { class: 'badge' }, [zone.cover === 'foam' ? '花泥' : '网格'])]),
        h('div', { class: 'form-grid' }, [
          h('div', { class: 'field' }, [
            h('label', {}, ['基准密度(朵/㎡)']),
            h('input', { type: 'number', step: '10', value: String(zone.density), oninput: (event: Event) => { zone.density = Number((event.target as HTMLInputElement).value); redraw() } })
          ]),
          h('div', { class: 'field' }, [
            h('label', {}, ['枝长上限(cm)']),
            h('input', { type: 'number', step: '5', value: String(zone.maxReachCm), oninput: (event: Event) => { zone.maxReachCm = Number((event.target as HTMLInputElement).value) } })
          ]),
          h('div', { class: 'field' }, [
            h('label', {}, ['主花占比']),
            h('input', { type: 'range', min: '0.1', max: '0.8', step: '0.05', value: String(zone.mainMix), oninput: (event: Event) => { zone.mainMix = Number((event.target as HTMLInputElement).value); redraw() } })
          ]),
          h('div', { class: 'field' }, [
            h('label', {}, ['配花占比']),
            h('input', { type: 'range', min: '0.1', max: '0.8', step: '0.05', value: String(zone.fillerMix), oninput: (event: Event) => { zone.fillerMix = Number((event.target as HTMLInputElement).value); redraw() } })
          ])
        ]),
        h('div', { class: 'field' }, [
          h('label', {}, ['覆盖材料']),
          h('select', {
            onchange: (event: Event) => { zone.cover = (event.target as HTMLSelectElement).value as 'foam' | 'mesh'; redraw() }
          }, [h('option', { value: 'foam' }, ['花泥']), h('option', { value: 'mesh' }, ['绑网格'])].map((option) => {
            option.selected = option.value === zone.cover
            return option
          }))
        ])
      ])
    )
  ])
}
