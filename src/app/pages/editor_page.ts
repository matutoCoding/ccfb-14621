import * as THREE from 'three'
import { h, mount, toast } from '@/core/dom'
import { hashSeed } from '@/core/rng'
import { store } from '@/core/store'
import type { DesignScheme, FlowerMaterial, StructureNode } from '@/types'
import { addOneFlower, activeFlowerCount, distributeFlowers, removeFlowerAt } from '@/three/dist'
import { buildFrame, buildZoneMesh } from '@/three/frames'
import { FlowerRenderer } from '@/three/flower_renderer'
import { createViewer, disposeViewer } from '../view_helper'
import type { Viewer } from '@/three/viewer'

export function renderEditorPage(container: HTMLElement): void {
  let viewer: Viewer | null = null
  let flowerRenderer: FlowerRenderer | null = null
  let selectedNodeId = ''
  let addMaterialId = store.state.materials.find((item) => item.category === 'main')?.id ?? ''

  const draw = (): void => {
    if (viewer) {
      disposeViewer(viewer)
      viewer = null
      flowerRenderer = null
    }
    const scheme = store.currentScheme
    const venue = store.state.venues.find((item) => item.id === scheme?.venueId)
    const viewerCard = h('div', { class: 'viewer-card' })
    const side = h('div', { class: 'side-panel' })
    mount(container, h('div', { class: 'page-grid' }, [viewerCard, side]))

    if (!scheme) {
      mount(viewerCard, h('div', { class: 'empty-state' }, [
        h('div', { class: 'empty-icon' }, ['花']),
        h('h3', {}, ['先选择一个方案']),
        h('p', { class: 'muted' }, ['去结构搭建页新建或选择方案后再插花'])
      ]))
      return
    }

    const node = scheme.structures.find((item) => item.id === selectedNodeId) ?? scheme.structures[0]
    selectedNodeId = node?.id ?? ''

    mount(side, editorPanel(scheme, node, refreshFlowers, redraw3d, () => addMaterialId, (id) => { addMaterialId = id }))
    viewer = createViewer(viewerCard)
    if (venue) viewer.addContent(viewer.buildVenue(venue))
    for (const item of scheme.structures) {
      const group = new THREE.Group()
      group.name = `structure-${item.id}`
      group.position.set(...item.position)
      group.rotation.y = item.rotationY
      group.add(buildFrame(item))
      for (const zone of item.zones) group.add(buildZoneMesh(item, zone))
      viewer.addContent(group)
    }
    flowerRenderer = new FlowerRenderer()
    flowerRenderer.build(scheme, store.materialMap)
    viewer.addContent(flowerRenderer.group)
    viewer.setView([5, 4.5, 8], [0, 2, 0])
    bindPicking()
  }

  const refreshFlowers = (): void => {
    const scheme = store.currentScheme
    if (!viewer || !flowerRenderer || !scheme) return
    flowerRenderer.build(scheme, store.materialMap)
    redrawPanel()
  }

  const redraw3d = (): void => draw()

  const redrawPanel = (): void => {
    const scheme = store.currentScheme
    const node = scheme?.structures.find((item) => item.id === selectedNodeId)
    const statsHost = document.querySelector<HTMLElement>('#editor-stats')
    if (statsHost && scheme && node) mount(statsHost, statsTiles(node))
    const unreachableHost = document.querySelector<HTMLElement>('#editor-unreachable')
    if (unreachableHost && node) mount(unreachableHost, unreachableBanner(node))
  }

  const bindPicking = (): void => {
    if (!viewer || !flowerRenderer) return
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0

    viewer.renderer.domElement.addEventListener('pointerdown', (event) => {
      downX = event.clientX
      downY = event.clientY
    })
    viewer.renderer.domElement.addEventListener('pointerup', (event) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return
      const scheme = store.currentScheme
      const node = scheme?.structures.find((item) => item.id === selectedNodeId)
      if (!scheme || !node || !flowerRenderer || !viewer) return
      const rect = viewer.renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, viewer.camera)
      const hit = flowerRenderer.pick(raycaster)
      if (!hit || hit.nodeId !== node.id) return
      const zone = node.zones.find((item) => item.id === hit.zoneId)
      if (!zone?.flowerData) return

      if (event.button === 2 || event.shiftKey) {
        const material = store.materialMap.get(zone.flowerData.materialIds[zone.flowerData.data[hit.flowerIndex * 12 + 9]])
        if (material) {
          const ok = addOneFlower(node, zone, material, hashSeed(`${node.id}${Date.now()}`))
          toast(ok ? `补了一朵 ${material.name}` : '附近太密，找不到空位', ok ? 'success' : 'warning')
        }
      } else {
        removeFlowerAt(zone, hit.flowerIndex)
        toast('已拔除一朵，清单数量同步更新', 'info')
      }
      void store.saveScheme(scheme)
      refreshFlowers()
    })
    viewer.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  const statsTiles = (node: StructureNode) => {
    const total = node.zones.reduce((sum, zone) => sum + activeFlowerCount(zone.flowerData), 0)
    const unreachable = node.zones.reduce((sum, zone) => sum + (zone.flowerData?.unreachable ?? 0), 0)
    return h('div', { class: 'stat-grid' }, [
      h('div', { class: 'stat-tile' }, [h('div', { class: 'stat-value primary-text' }, [String(total)]), h('div', { class: 'stat-label' }, ['当前花朵（=清单口径）'])]),
      h('div', { class: 'stat-tile' }, [h('div', { class: `stat-value ${unreachable > 0 ? 'danger-text' : ''}` }, [String(unreachable)]), h('div', { class: 'stat-label' }, ['枝长不足'])]),
      h('div', { class: 'stat-tile' }, [h('div', { class: 'stat-value' }, [String(node.zones.length)]), h('div', { class: 'stat-label' }, ['花泥区域'])]),
      h('div', { class: 'stat-tile' }, [h('div', { class: 'stat-value' }, [String(flowerRenderer?.getStats().drawCalls ?? 0)]), h('div', { class: 'stat-label' }, ['实例化 draw call'])])
    ])
  }

  const unreachableBanner = (node: StructureNode) => {
    const total = node.zones.reduce((sum, zone) => sum + (zone.flowerData?.unreachable ?? 0), 0)
    if (total === 0) return h('div', { class: 'warning-banner' }, [h('strong', {}, ['枝长校验']), h('span', {}, ['所有花都在枝长可达范围内'])])
    return h('div', { class: 'warning-banner danger-banner' }, [
      h('strong', {}, ['枝长不足提示']),
      h('span', {}, [`${total} 朵超出枝长/花泥可达上限，场景中以红色标记，建议换长枝品种或调整花泥位置`])
    ])
  }

  const fillRateHint = (placed: number, buffer: NonNullable<StructureNode['zones'][number]['flowerData']>) => {
    const rate = buffer.targetCount > 0 ? placed / buffer.targetCount : 1
    const percent = Math.round(rate * 100)
    if (rate >= 0.85) {
      return h('p', { class: 'muted' }, [`填充率 ${percent}%，密度设置合理，实际 ${placed} 朵全部计入清单`])
    }
    return h('div', { class: 'warning-banner' }, [
      h('strong', {}, ['密度偏高']),
      h('span', {}, [`目标 ${buffer.targetCount} 朵受花头尺寸与防穿插限制只能放下 ${placed} 朵（${percent}%）。清单按实际朵数核算，不会虚增；如需更多花请降低主花占比或加大花泥区`])
    ])
  }

  const editorPanel = (
    scheme: DesignScheme,
    node: StructureNode | undefined,
    onRefresh: () => void,
    onRedraw: () => void,
    getAddMaterial: () => string,
    setAddMaterial: (id: string) => void
  ) =>
    h('div', { class: 'col' }, [
      h('div', { class: 'card col' }, [
        h('h3', {}, ['插花结构']),
        h('select', {
          onchange: (event: Event) => {
            selectedNodeId = (event.target as HTMLSelectElement).value
            onRedraw()
          }
        }, scheme.structures.map((item) => {
          const option = h('option', { value: item.id }, [item.label])
          option.selected = item.id === node?.id
          return option
        }))
      ]),
      h('div', { id: 'editor-stats', class: 'card' }, [node ? statsTiles(node) : h('span')]),
      h('div', { id: 'editor-unreachable' }, [node ? unreachableBanner(node) : h('span')]),
      node
        ? h('div', { class: 'card col' }, [
            h('h3', {}, ['自动布花']),
            h('p', { class: 'muted' }, ['抖动网格分层布点，主花先落位、配花填缝、叶材补空，花头不穿插；同参数重复生成结果一致']),
            h('button', {
              class: 'primary',
              onclick: async () => {
                for (const zone of node.zones) {
                  const result = distributeFlowers(node, zone, store.state.materials, hashSeed(`${scheme.id}:${node.id}:${zone.id}`))
                  zone.flowerData = result.buffer
                  const fill = Math.round((result.buffer.count / result.targetCount) * 100)
                  toast(`${zone.label} 布入 ${result.buffer.count}/${result.targetCount} 朵（${fill}%）`, fill < 80 ? 'warning' : 'success')
                }
                await store.saveScheme(scheme)
                onRefresh()
              }
            }, ['一键布花（全部区域）']),
            ...node.zones.map((zone) => {
              const current = activeFlowerCount(zone.flowerData)
              return h('div', { class: 'col' }, [
                h('button', {
                  onclick: async () => {
                    const result = distributeFlowers(node, zone, store.state.materials, hashSeed(`${scheme.id}:${node.id}:${zone.id}:${Date.now()}`))
                    zone.flowerData = result.buffer
                    await store.saveScheme(scheme)
                    onRefresh()
                  }
                }, [`重布：${zone.label}（当前 ${current} 朵）`]),
                zone.flowerData
                  ? fillRateHint(zone.flowerData.count, zone.flowerData)
                  : h('span')
              ])
            })
          ])
        : h('span'),
      node
        ? h('div', { class: 'card col' }, [
            h('h3', {}, ['手动微调']),
            h('p', { class: 'muted' }, ['左键点击花朵拔除；Shift+点击（或右键）在附近补一朵同品种']),
            h('div', { class: 'field' }, [
              h('label', {}, ['补花品种']),
              h('select', {
                onchange: (event: Event) => setAddMaterial((event.target as HTMLSelectElement).value)
              }, store.state.materials.map((material: FlowerMaterial) => {
                const option = h('option', { value: material.id }, [material.name])
                option.selected = material.id === getAddMaterial()
                return option
              }))
            ]),
            h('button', {
              onclick: async () => {
                const material = store.materialMap.get(getAddMaterial())
                const zone = node.zones[0]
                if (!material || !zone) return
                const ok = addOneFlower(node, zone, material, hashSeed(`${node.id}${Date.now()}`))
                await store.saveScheme(scheme)
                toast(ok ? `补入 ${material.name}` : '附近没有空位', ok ? 'success' : 'warning')
                onRefresh()
              }
            }, ['在首个花泥区补一朵'])
          ])
        : h('span'),
      h('div', { class: 'card' }, [
        h('h3', {}, ['渲染统计']),
        h('p', { class: 'muted' }, [
          flowerRenderer
            ? `${flowerRenderer.getStats().instances.toLocaleString('zh-CN')} 个实例 / ${flowerRenderer.getStats().drawCalls} 个 draw call`
            : '等待渲染'
        ])
      ])
    ])

  draw()
}
