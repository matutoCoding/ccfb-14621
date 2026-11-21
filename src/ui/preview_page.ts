// 现场预览页：宴会厅灯光、新人站位、机位视角与背景屏遮挡检测
import * as THREE from 'three'
import { dbAll } from '../lib/db'
import { el, field, select } from '../lib/dom'
import { PlacementRecord } from '../lib/types'
import { Viewport } from '../three/viewport'
import { buildVenueGroup, defaultCamPositions, LIGHT_NAMES, LightingRig, LightPreset, makeMarker, screenOcclusion } from '../three/venue_scene'
import { StructureMesh } from '../three/structure_mesh'
import { FlowerField } from '../three/flower_field'
import { getCurrentProjectId, loadCtx } from '../lib/state'

const PRESETS = Object.entries(LIGHT_NAMES) as [LightPreset, string][]

export async function renderPreviewPage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  const project = ctx.projects.find(p => p.id === getCurrentProjectId()) ?? ctx.projects[0]
  if (!project) { root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '请先创建方案' })])); return }
  const venue = ctx.venues.find(v => v.id === project.venueId)
  const structures = ctx.structures.filter(s => s.projectId === project.id)
  if (!venue) return

  const placements = new Map<string, PlacementRecord>()
  for (const r of await dbAll<PlacementRecord>('placements')) placements.set(r.id, r)

  const viewportWrap = el('div', { class: 'viewport-wrap' })
  const hud = el('div', { class: 'viewport-hud' })
  const tip = el('div', { class: 'viewport-tip', text: '「摆位」模式下点击地面放置新人站位' })
  viewportWrap.append(hud, tip)
  const vp = new Viewport(viewportWrap)

  vp.scene.add(buildVenueGroup(venue))
  const rig = new LightingRig(venue)
  vp.scene.add(rig.group)

  const occluders: THREE.Object3D[] = []
  for (const s of structures) {
    const sm = new StructureMesh(s)
    vp.scene.add(sm.group)
    occluders.push(sm.group)
    const ff = new FlowerField()
    ff.setData(placements.get(s.id)?.list ?? [], ctx.flowerMap)
    vp.scene.add(ff.group)
  }

  // 新人站位
  const couple = new THREE.Group()
  const m1 = makeMarker(0xd8c8e8); m1.position.set(-0.3, 0.85, 0)
  const m2 = makeMarker(0xc8d8e8); m2.position.set(0.3, 0.85, 0)
  couple.add(m1, m2)
  couple.position.set(0, 0, -venue.length / 2 + 5)
  vp.scene.add(couple)
  rig.followTarget.position.copy(couple.position)

  // 机位
  const camPositions = defaultCamPositions(venue)
  const camMarkers: THREE.Mesh[] = []
  const camGeo = new THREE.ConeGeometry(0.2, 0.5, 4)
  const camMat = new THREE.MeshLambertMaterial({ color: 0xd0a040 })
  for (const c of camPositions) {
    const m = new THREE.Mesh(camGeo, camMat)
    m.position.copy(c.pos)
    m.lookAt(0, 1.5, -venue.length / 2)
    vp.scene.add(m)
    camMarkers.push(m)
  }

  const fpsChip = el('span', { class: 'hud-chip', text: '-- FPS' })
  vp.onFps = f => { fpsChip.textContent = `${f} FPS` }
  const occlChip = el('span', { class: 'hud-chip' })
  hud.append(fpsChip, occlChip)

  let placeMode = false
  let camView: number | null = null

  const updateOcclusion = () => {
    const from = camView === null ? vp.camera.position : camPositions[camView].pos
    const ratio = screenOcclusion(from, venue, occluders)
    const pct = Math.round(ratio * 100)
    occlChip.textContent = `背景屏遮挡 ${pct}%${pct > 30 ? ' · 建议调整拱门位置' : ''}`
    occlChip.className = `hud-chip ${pct > 30 ? 'danger' : pct > 10 ? 'warn' : ''}`
  }
  updateOcclusion()
  vp.controls.addEventListener('change', () => { if (camView === null) updateOcclusion() })

  // 摆位交互
  const ray = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  let downAt = 0
  vp.renderer.domElement.addEventListener('pointerdown', () => { downAt = Date.now() })
  vp.renderer.domElement.addEventListener('pointerup', e => {
    if (!placeMode || Date.now() - downAt > 250) return
    const rect = vp.renderer.domElement.getBoundingClientRect()
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(pointer, vp.camera)
    const hit = new THREE.Vector3()
    if (ray.ray.intersectPlane(floorPlane, hit)) {
      couple.position.set(hit.x, 0, hit.z)
      rig.followTarget.position.copy(couple.position)
    }
  })

  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'card' }, [
      el('h2', { text: '宴会厅灯光' }),
      field('灯光预设', select(PRESETS, 'warm' as LightPreset, v => rig.apply(v))),
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: '新人站位' }),
      el('button', {
        class: `btn ${placeMode ? 'btn-primary' : ''}`,
        text: placeMode ? '摆位中…点击地面放置' : '进入摆位模式',
        onclick: (e) => {
          placeMode = !placeMode
          ;(e.currentTarget as HTMLButtonElement).textContent = placeMode ? '摆位中…点击地面放置' : '进入摆位模式'
          ;(e.currentTarget as HTMLButtonElement).className = `btn ${placeMode ? 'btn-primary' : ''}`
        },
      }),
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: '摄像机位' }),
      field('选择机位', select(
        [['-1', '自由视角'] as [string, string], ...camPositions.map((c, i) => [String(i), c.name] as [string, string])],
        '-1',
        v => {
          camView = v === '-1' ? null : Number(v)
          if (camView !== null) {
            vp.camera.position.copy(camPositions[camView].pos)
            vp.controls.target.set(0, 1.5, -venue.length / 2)
          }
          updateOcclusion()
        })),
      el('div', { class: 'sub', style: 'color:var(--c-text-3);margin-top:8px',
        text: '从机位向背景屏采样射线，检测拱门/花瀑是否遮挡屏幕，超过30%建议调整。' }),
    ]),
  ])

  root.append(el('div', { class: 'editor' }, [panel, viewportWrap]))
}
