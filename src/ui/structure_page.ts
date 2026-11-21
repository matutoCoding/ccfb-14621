// 结构搭建页：参数化骨架生成、刷花泥、吊点承重校验
import * as THREE from 'three'
import { dbDel, dbPut } from '../lib/db'
import { el, field, fmt, numInput, select, textInput } from '../lib/dom'
import { STRUCTURE_NAMES, StructureItem, StructureKind, uid, ZONE_NAMES, ZoneKind } from '../lib/types'
import { normalizeFoam, riggingCheck, segCount, structureWeightKg } from '../core/geometry_structures'
import { Viewport } from '../three/viewport'
import { buildVenueGroup } from '../three/venue_scene'
import { StructureMesh } from '../three/structure_mesh'
import { getCurrentProjectId, loadCtx, setCurrentProjectId } from '../lib/state'

const KINDS = Object.entries(STRUCTURE_NAMES) as [StructureKind, string][]
const ZONES = Object.entries(ZONE_NAMES) as [ZoneKind, string][]

const DEFAULT_PARAMS: Record<StructureKind, Record<string, number>> = {
  arch: { width: 4, height: 3.2, tube: 0.025, foamRadius: 0.12 },
  ring: { radius: 1.2, tube: 0.02, foamRadius: 0.1 },
  column: { height: 1.8, tube: 0.02, foamRadius: 0.18 },
  waterfall: { width: 6, depth: 2, hang: 0.6, tube: 0.02, foamRadius: 0.1 },
}

const PARAM_LABELS: Record<string, string> = {
  width: '宽度 m', height: '高度 m', radius: '半径 m', depth: '进深 m',
  hang: '垂吊长度 m', tube: '管径 m', foamRadius: '花泥半径 m',
}

export async function renderStructurePage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  if (ctx.projects.length === 0) {
    root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '还没有方案' })]))
    return
  }
  let project = ctx.projects.find(p => p.id === getCurrentProjectId()) ?? ctx.projects[0]
  setCurrentProjectId(project.id)
  const venue = ctx.venues.find(v => v.id === project.venueId)
  if (!venue) { root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '方案未关联场地' })])); return }

  let structures = ctx.structures.filter(s => s.projectId === project.id)
  let selected: StructureItem | null = structures[0] ?? null

  // 3D 场景
  const viewportWrap = el('div', { class: 'viewport-wrap' })
  const hud = el('div', { class: 'viewport-hud' })
  const tip = el('div', { class: 'viewport-tip', text: '左键旋转 · 右键平移 · 滚轮缩放 · 点击骨架段刷/取消花泥' })
  viewportWrap.append(hud, tip)
  const vp = new Viewport(viewportWrap)
  vp.scene.add(buildVenueGroup(venue))
  vp.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(10, 20, 10)
  vp.scene.add(sun)

  const meshMap = new Map<string, StructureMesh>()
  const syncMeshes = () => {
    for (const m of meshMap.values()) { vp.scene.remove(m.group); m.dispose() }
    meshMap.clear()
    for (const s of structures) {
      const m = new StructureMesh(s)
      meshMap.set(s.id, m)
      vp.scene.add(m.group)
    }
  }
  syncMeshes()

  const fpsChip = el('span', { class: 'hud-chip', text: '-- FPS' })
  vp.onFps = f => { fpsChip.textContent = `${f} FPS` }
  const weightChip = el('span', { class: 'hud-chip' })
  const rigChip = el('span', { class: 'hud-chip' })
  hud.append(fpsChip, weightChip, rigChip)

  const updateHud = () => {
    if (!selected) { weightChip.textContent = ''; rigChip.textContent = ''; return }
    const w = structureWeightKg(selected)
    weightChip.textContent = `${selected.name} 自重 ${fmt(w, 1)}kg(不含花材)`
    const checks = riggingCheck(selected, venue.riggingPoints, 0)
    if (checks.length > 0) {
      const over = checks.some(c => c.overload)
      rigChip.textContent = over
        ? `吊点超载！单点负荷 ${fmt(checks[0].share, 1)}kg > ${checks[0].point.loadKg}kg`
        : `吊点负荷 ${fmt(checks[0].share, 1)}kg / ${checks[0].point.loadKg}kg`
      rigChip.className = `hud-chip ${over ? 'danger' : ''}`
    } else {
      rigChip.textContent = ''
    }
  }
  updateHud()

  // 点击刷花泥
  const ray = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt = 0
  vp.renderer.domElement.addEventListener('pointerdown', () => { downAt = Date.now() })
  vp.renderer.domElement.addEventListener('pointerup', async e => {
    if (Date.now() - downAt > 250) return
    const rect = vp.renderer.domElement.getBoundingClientRect()
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(pointer, vp.camera)
    const allSegs = [...meshMap.values()].flatMap(m => m.segments)
    const hit = ray.intersectObjects(allSegs, false)[0]
    if (!hit) return
    const mesh = meshMap.get(hit.object.userData.structureId)
    if (!mesh) return
    mesh.toggleFoam(hit.object.userData.segIdx)
    await dbPut('structures', mesh.item)
    updateHud()
  })

  // 左侧面板
  const panel = el('div', { class: 'panel' })
  const renderPanel = () => {
    panel.innerHTML = ''
    panel.append(
      el('div', { class: 'card' }, [
        field('当前方案', select(
          ctx.projects.map(p => [p.id, p.name] as [string, string]),
          project.id,
          async id => {
            setCurrentProjectId(id)
            root.innerHTML = ''
            vp.dispose()
            await renderStructurePage(root)
          })),
      ]),
      el('div', { class: 'card' }, [
        el('h2', { text: `结构件（${structures.length}）` }),
        ...structures.map(s => el('div', {
          class: `list-item ${selected?.id === s.id ? 'active' : ''}`,
          onclick: () => { selected = s; renderPanel(); updateHud() },
        }, [
          el('div', {}, [
            el('div', { class: 'name', text: s.name }),
            el('div', { class: 'meta', text: `${STRUCTURE_NAMES[s.kind]} · ${ZONE_NAMES[s.zone]} · 花泥${s.foam.filter(Boolean).length}/${s.foam.length}段` }),
          ]),
          el('button', {
            class: 'btn btn-sm btn-danger', text: '删',
            onclick: async (e) => {
              e.stopPropagation()
              if (!confirm(`删除「${s.name}」？`)) return
              await dbDel('structures', s.id)
              await dbDel('placements', s.id)
              structures = structures.filter(x => x.id !== s.id)
              if (selected?.id === s.id) selected = structures[0] ?? null
              syncMeshes(); renderPanel(); updateHud()
            },
          }),
        ])),
        el('button', { class: 'btn btn-primary', text: '新增结构件', onclick: () => addForm() }),
      ])
    )
    if (selected) panel.append(editForm(selected))
  }

  const addForm = () => {
    let kind: StructureKind = 'arch'
    const s: StructureItem = {
      id: uid(), projectId: project.id, kind, name: STRUCTURE_NAMES[kind],
      zone: 'arch', params: { ...DEFAULT_PARAMS[kind] },
      position: [0, 0, 0], rotationY: 0, foam: [],
      recipe: { main: '', fillers: [], leaves: [], density: 8, gradient: 0.4 },
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    normalizeFoam(s)
    structures.push(s)
    selected = s
    syncMeshes(); renderPanel(); updateHud()
  }

  const save = async (s: StructureItem) => {
    normalizeFoam(s)
    s.updatedAt = Date.now()
    await dbPut('structures', s)
    syncMeshes(); renderPanel(); updateHud()
  }

  const editForm = (s: StructureItem) => {
    const card = el('div', { class: 'card' }, [el('h2', { text: '参数' })])
    card.append(
      field('名称', textInput(s.name, v => { s.name = v })),
      field('类型', select(KINDS, s.kind, v => { s.kind = v; s.params = { ...DEFAULT_PARAMS[v] }; save(s) })),
      field('所属区域', select(ZONES, s.zone, v => { s.zone = v })),
    )
    const grid = el('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr' })
    for (const [k, label] of Object.entries(PARAM_LABELS)) {
      if (!(k in s.params)) continue
      grid.append(field(label, numInput(s.params[k], v => { s.params[k] = v }, 0.1)))
    }
    for (const [i, label] of ['位置X m', '位置Y m', '位置Z m'].entries()) {
      grid.append(field(label, numInput(s.position[i], v => { s.position[i] = v }, 0.5)))
    }
    grid.append(field('朝向(度)', numInput(Math.round(s.rotationY * 180 / Math.PI), v => { s.rotationY = v * Math.PI / 180 }, 15)))
    card.append(grid)
    card.append(el('div', { class: 'toolbar', style: 'margin-top:12px' }, [
      el('button', { class: 'btn btn-primary', text: '应用', onclick: () => save(s) }),
    ]))
    return card
  }

  renderPanel()
  root.append(el('div', { class: 'editor' }, [panel, viewportWrap]))
}
