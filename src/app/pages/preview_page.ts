import * as THREE from 'three'
import { h, mount, toast } from '@/core/dom'
import { LIGHTING_PRESETS } from '@/core/constants'
import { analyzeBlocking, type CameraSpot } from '@/core/sight'
import { store } from '@/core/store'
import { buildFrame } from '@/three/frames'
import { FlowerRenderer } from '@/three/flower_renderer'
import { createViewer, disposeViewer } from '../view_helper'
import type { Viewer } from '@/three/viewer'

const COUPLE_SPOT: [number, number, number] = [0, 0, 3.2]
const DEFAULT_CAMERAS: CameraSpot[] = [
  { id: 'cam_main', name: '主机位（厅后正中）', position: [0, 2.2, 11], target: [0, 1.6, 0] },
  { id: 'cam_left', name: '左前侧机位', position: [-7, 2, 7], target: [0, 1.5, 0] },
  { id: 'cam_close', name: '近景追机位', position: [2.5, 1.7, 5.5], target: [0, 1.5, 1.5] }
]

export function renderPreviewPage(container: HTMLElement): void {
  let viewer: Viewer | null = null
  let flowerRenderer: FlowerRenderer | null = null
  let cameras: CameraSpot[] = DEFAULT_CAMERAS.map((item) => ({ ...item, position: [...item.position] as [number, number, number], target: [...item.target] as [number, number, number] }))
  let activeCameraId = ''

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

    if (!scheme || !venue) {
      mount(viewerCard, h('div', { class: 'empty-state' }, [
        h('div', { class: 'empty-icon' }, ['景']),
        h('h3', {}, ['没有可预览的方案']),
        h('p', { class: 'muted' }, ['先在结构搭建页选择方案并完成插花'])
      ]))
      return
    }

    viewer = createViewer(viewerCard)
    viewer.addContent(viewer.buildVenue(venue))
    for (const node of scheme.structures) {
      const group = new THREE.Group()
      group.name = `structure-${node.id}`
      group.userData.label = node.label
      group.position.set(...node.position)
      group.rotation.y = node.rotationY
      group.add(buildFrame(node))
      viewer.addContent(group)
    }
    flowerRenderer = new FlowerRenderer()
    flowerRenderer.build(scheme, store.materialMap)
    viewer.addContent(flowerRenderer.group)
    addMarkers(viewer)
    viewer.setView([9, 7, 12], [0, 2, 0])

    mount(side, h('div', { class: 'col' }, [
      lightingCard(viewer),
      cameraCard(viewer, cameras, (id) => { activeCameraId = id }, () => activeCameraId, () => draw()),
      blockingCard(viewer),
      markerLegend()
    ]))
    toast('拖动画面自由观察，点机位卡片可切到该摄像机视角', 'info')
  }

  const addMarkers = (active: Viewer): void => {
    // 新人站位：两个简化人形
    const couple = new THREE.Group()
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8d4c4, roughness: 0.7 })
    const suit = new THREE.MeshStandardMaterial({ color: 0x2c3140, roughness: 0.8 })
    const dress = new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.6 })
    for (const [offset, material] of [[-0.35, suit], [0.35, dress]] as const) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.1, 10), material)
      body.position.set(offset, 0.95, 0)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin)
      head.position.set(offset, 1.65, 0)
      couple.add(body, head)
    }
    couple.position.set(COUPLE_SPOT[0], COUPLE_SPOT[1], COUPLE_SPOT[2])
    couple.name = 'couple-marker'
    active.addContent(couple)

    for (const spot of cameras) {
      const cameraGroup = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, 0.25),
        new THREE.MeshStandardMaterial({ color: 0xc98ba4, roughness: 0.5 })
      )
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.18, 10),
        new THREE.MeshStandardMaterial({ color: 0x1b1e26, metalness: 0.7, roughness: 0.3 })
      )
      lens.rotation.x = Math.PI / 2
      lens.position.z = 0.2
      cameraGroup.add(body, lens)
      cameraGroup.position.set(...spot.position)
      cameraGroup.lookAt(...spot.target)
      cameraGroup.name = `camera-${spot.id}`
      cameraGroup.userData.spotId = spot.id
      active.addContent(cameraGroup)
    }
  }

  const lightingCard = (active: Viewer) =>
    h('div', { class: 'card col' }, [
      h('h3', {}, ['宴会厅灯光']),
      h('div', { class: 'row-wrap' }, LIGHTING_PRESETS.map((preset, index) =>
        h('button', {
          class: active.lightingIndex === index ? 'primary' : '',
          onclick: () => {
            active.applyLighting(index)
            draw()
          }
        }, [preset.name])
      )),
      h('p', { class: 'muted' }, ['暖白适合暖调场布，冷白突出白绿系，追光模拟仪式暗场'])
    ])

  const cameraCard = (active: Viewer, spots: CameraSpot[], setActive: (id: string) => void, getActive: () => string, redraw: () => void) =>
    h('div', { class: 'card col' }, [
      h('h3', {}, ['摄像机位']),
      h('div', { class: 'list-stack' }, spots.map((spot) =>
        h('div', {
          class: `list-item ${getActive() === spot.id ? 'selected' : ''}`,
          onclick: () => {
            setActive(spot.id)
            active.setView(spot.position, spot.target)
            redraw()
          }
        }, [
          h('strong', {}, [spot.name]),
          h('p', { class: 'muted' }, [`机位 (${spot.position.map((value) => value.toFixed(1)).join(', ')}) → 看向 (${spot.target.map((value) => value.toFixed(1)).join(', ')})`])
        ])
      )),
      h('button', {
        onclick: () => {
          cameras = DEFAULT_CAMERAS.map((item) => ({ ...item, position: [...item.position] as [number, number, number], target: [...item.target] as [number, number, number] }))
          redraw()
          toast('机位已重置', 'info')
        }
      }, ['重置机位'])
    ])

  const blockingCard = (active: Viewer) => {
    const results = analyzeBlocking(active.camera, active.content, cameras)
    return h('div', { class: 'card col' }, [
      h('h3', {}, ['背景屏遮挡分析']),
      ...results.map((result) =>
        h('div', { class: `list-item ${result.blocked ? 'selected' : ''}` }, [
          h('div', { class: 'row spread' }, [
            h('strong', {}, [result.cameraName]),
            result.blocked
              ? h('span', { class: 'badge danger' }, ['遮挡风险'])
              : h('span', { class: 'badge success' }, ['画面干净'])
          ]),
          h('p', { class: result.blocked ? 'danger-text' : 'muted' }, [
            `背景屏被覆盖 ${Math.round(result.coverage * 100)}%`,
            result.details.length > 0 ? `：${result.details.map((detail) => `${detail.label} ${Math.round(detail.coverage * 100)}%`).join('，')}` : ''
          ])
        ])
      )
    ])
  }

  const markerLegend = () =>
    h('div', { class: 'card col' }, [
      h('h3', {}, ['现场标记']),
      h('p', { class: 'muted' }, ['粉黑色方块为摄像机位，T台尽头人形为新人站位；拱门正面默认朝向 T 台，花瀑头朝下垂坠'])
    ])

  draw()
}
