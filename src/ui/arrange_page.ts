// 插花编辑页：配方设置、自动布花、手动拔花/补花
import * as THREE from 'three'
import { dbAll, dbPut } from '../lib/db'
import { el, field, fmtInt, numInput, select } from '../lib/dom'
import { FlowerVariety, PlacementRecord, PlacedFlower, STRUCTURE_NAMES, StructureItem, ZONE_NAMES } from '../lib/types'
import { autoArrange, canPlaceAt } from '../core/arrange'
import { Viewport } from '../three/viewport'
import { buildVenueGroup } from '../three/venue_scene'
import { StructureMesh } from '../three/structure_mesh'
import { FlowerField } from '../three/flower_field'
import { getCurrentProjectId, loadCtx } from '../lib/state'
import { mulberry32 } from '../lib/rng'

export async function renderArrangePage(root: HTMLElement): Promise<void> {
  const ctx = await loadCtx()
  const project = ctx.projects.find(p => p.id === getCurrentProjectId()) ?? ctx.projects[0]
  if (!project) { root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '请先创建方案' })])); return }
  const venue = ctx.venues.find(v => v.id === project.venueId)
  const structures = ctx.structures.filter(s => s.projectId === project.id)
  if (!venue || structures.length === 0) {
    root.append(el('div', { class: 'empty' }, [el('div', { class: 't', text: '请先在「结构搭建」页添加结构件' })]))
    return
  }

  const placements = new Map<string, PlacementRecord>()
  for (const r of await dbAll<PlacementRecord>('placements')) placements.set(r.id, r)

  let selected = structures[0]
  let mode: 'pick' | 'remove' | 'add' = 'pick'
  let addVarietyId = ctx.flowers[0]?.id ?? ''

  // 3D
  const viewportWrap = el('div', { class: 'viewport-wrap' })
  const hud = el('div', { class: 'viewport-hud' })
  const tip = el('div', { class: 'viewport-tip' })
  viewportWrap.append(hud, tip)
  const vp = new Viewport(viewportWrap)
  vp.scene.add(buildVenueGroup(venue))
  vp.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(10, 20, 10)
  vp.scene.add(sun)

  const structMeshes = new Map<string, StructureMesh>()
  const fields = new Map<string, FlowerField>()
  for (const s of structures) {
    const sm = new StructureMesh(s)
    structMeshes.set(s.id, sm)
    vp.scene.add(sm.group)
    const ff = new FlowerField()
    ff.setData(placements.get(s.id)?.list ?? [], ctx.flowerMap)
    fields.set(s.id, ff)
    vp.scene.add(ff.group)
  }

  const fpsChip = el('span', { class: 'hud-chip', text: '-- FPS' })
  vp.onFps = f => { fpsChip.textContent = `${f} FPS` }
  const countChip = el('span', { class: 'hud-chip' })
  hud.append(fpsChip, countChip)

  const totalCount = () => [...fields.values()].reduce((n, f) => n + f.count(), 0)
  const updateCount = () => {
    countChip.textContent = `全场 ${fmtInt(totalCount())} 朵 · 当前结构 ${fmtInt(fields.get(selected.id)?.count() ?? 0)} 朵`
  }
  updateCount()

  const saveField = async (sid: string) => {
    const rec: PlacementRecord = { id: sid, list: fields.get(sid)?.flowers ?? [] }
    placements.set(sid, rec)
    await dbPut('placements', rec)
    updateCount()
  }

  const doArrange = async (s: StructureItem) => {
    const { flowers, warnings } = autoArrange(s, ctx.flowerMap)
    const ff = fields.get(s.id)
    if (ff) ff.setData(flowers, ctx.flowerMap)
    await saveField(s.id)
    return warnings
  }

  // 拾取交互
  const ray = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt = 0
  vp.renderer.domElement.addEventListener('pointerdown', () => { downAt = Date.now() })
  vp.renderer.domElement.addEventListener('pointerup', async e => {
    if (Date.now() - downAt > 250) return
    const rect = vp.renderer.domElement.getBoundingClientRect()
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(pointer, vp.camera)

    if (mode === 'remove') {
      const ff = fields.get(selected.id)
      if (!ff) return
      const idx = ff.pick(ray)
      if (idx === null) return
      ff.flowers.splice(idx, 1)
      ff.rebuild()
      await saveField(selected.id)
      renderStats()
      return
    }
    if (mode === 'add') {
      const v = ctx.flowerMap.get(addVarietyId)
      const sm = structMeshes.get(selected.id)
      if (!v || !sm) return
      const hit = ray.intersectObjects(sm.segments, false)[0]
      if (!hit) return
      const ff = fields.get(selected.id)
      if (!ff) return
      const n = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3(0, 0, 1)
      const check = canPlaceAt(ff.flowers, ctx.flowerMap, v, hit.point, selected)
      if (!check.ok) { warnDiv.textContent = check.reason; return }
      const rng = mulberry32(Date.now() % 1e9)
      ff.flowers.push({
        varietyId: v.id,
        p: [hit.point.x, hit.point.y, hit.point.z],
        n: [n.x, n.y, n.z],
        s: 0.9 + rng() * 0.25,
        c: Math.floor(rng() * v.colors.length),
        seed: Math.floor(rng() * 1e9),
      })
      ff.rebuild()
      await saveField(selected.id)
      warnDiv.textContent = ''
      renderStats()
    }
  })

  // 面板
  const panel = el('div', { class: 'panel' })
  const warnDiv = el('div', { style: 'color:var(--c-warn);font-size:14px' })
  const statsDiv = el('div', {})

  const renderStats = () => {
    const ff = fields.get(selected.id)
    const byVariety = new Map<string, number>()
    for (const f of ff?.flowers ?? []) byVariety.set(f.varietyId, (byVariety.get(f.varietyId) ?? 0) + 1)
    statsDiv.innerHTML = ''
    statsDiv.append(el('h2', { text: '当前结构用花' }))
    if (byVariety.size === 0) { statsDiv.append(el('div', { class: 'sub', text: '尚未布花' })); return }
    for (const [vid, n] of byVariety) {
      statsDiv.append(el('div', { class: 'list-item' }, [
        el('span', { text: ctx.flowerMap.get(vid)?.name ?? vid }),
        el('span', { class: 'badge', text: `${fmtInt(n)} 朵` }),
      ]))
    }
  }

  const varietySelect = (cat: FlowerVariety['category'], value: string, onChange: (id: string) => void) => {
    const opts = ctx.flowers.filter(f => f.category === cat).map(f => [f.id, f.name] as [string, string])
    return select([['', '— 未选 —'] as [string, string], ...opts], value, onChange)
  }

  const renderPanel = () => {
    panel.innerHTML = ''
    const s = selected
    const recipeCard = el('div', { class: 'card' }, [
      el('h2', { text: `${s.name} · 布花配方` }),
      field('主花', varietySelect('main', s.recipe.main, v => { s.recipe.main = v })),
      field('配花(按住Ctrl多选)', multiSelect('filler', s.recipe.fillers)),
      field('叶材(按住Ctrl多选)', multiSelect('leaf', s.recipe.leaves)),
      el('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr' }, [
        field('主花密度 朵/米', numInput(s.recipe.density, v => { s.recipe.density = Math.max(1, v) })),
        field('边缘稀疏 0-1', numInput(s.recipe.gradient, v => { s.recipe.gradient = Math.min(1, Math.max(0, v)) }, 0.1)),
      ]),
      el('div', { class: 'toolbar', style: 'margin-top:12px' }, [
        el('button', {
          class: 'btn btn-primary', text: '自动布花',
          onclick: async () => {
            await dbPut('structures', s)
            const warnings = await doArrange(s)
            warnDiv.innerHTML = warnings.join('<br>')
            renderStats()
          },
        }),
        el('button', {
          class: 'btn', text: '清空',
          onclick: async () => {
            fields.get(s.id)?.setData([], ctx.flowerMap)
            await saveField(s.id)
            renderStats()
          },
        }),
      ]),
      warnDiv,
    ])

    const modeCard = el('div', { class: 'card' }, [
      el('h2', { text: '手动调整' }),
      el('div', { class: 'toolbar' }, [
        modeBtn('查看', 'pick'), modeBtn('拔花', 'remove'), modeBtn('补花', 'add'),
      ]),
      mode === 'add' ? field('补花品种', select(
        ctx.flowers.map(f => [f.id, f.name] as [string, string]),
        addVarietyId, v => { addVarietyId = v })) : '',
      el('div', { class: 'sub', style: 'color:var(--c-text-3);margin-top:8px',
        text: mode === 'remove' ? '点击花头拔掉' : mode === 'add' ? '点击骨架花泥位置补一朵' : '切换到拔花/补花模式进行手动调整' }),
    ])

    panel.append(
      el('div', { class: 'card' }, [
        field('选择结构', select(
          structures.map(x => [x.id, `${x.name}(${STRUCTURE_NAMES[x.kind]}·${ZONE_NAMES[x.zone]})`] as [string, string]),
          s.id, v => {
            selected = structures.find(x => x.id === v) ?? structures[0]
            renderPanel(); updateCount()
          })),
      ]),
      recipeCard, modeCard,
      el('div', { class: 'card' }, [statsDiv]),
      el('button', {
        class: 'btn btn-primary', text: '全部结构自动布花',
        onclick: async () => {
          for (const x of structures) { await dbPut('structures', x); await doArrange(x) }
          renderStats(); updateCount()
        },
      }),
    )
    renderStats()
  }

  const modeBtn = (label: string, m: typeof mode) =>
    el('button', {
      class: `btn ${mode === m ? 'btn-primary' : ''}`, text: label,
      onclick: () => { mode = m; tip.textContent = m === 'remove' ? '点击花头拔掉' : m === 'add' ? '点击花泥位置补花' : ''; renderPanel() },
    })

  const multiSelect = (cat: FlowerVariety['category'], values: string[]) => {
    const sel = el('select', { multiple: '', size: '4', style: 'height:auto' },
      ctx.flowers.filter(f => f.category === cat).map(f => {
        const o = el('option', { value: f.id, text: f.name })
        if (values.includes(f.id)) o.selected = true
        return o
      }))
    sel.addEventListener('change', () => {
      const ids = [...sel.selectedOptions].map(o => o.value)
      if (cat === 'filler') selected.recipe.fillers = ids
      else selected.recipe.leaves = ids
    })
    return sel
  }

  renderPanel()
  renderStats()
  root.append(el('div', { class: 'editor' }, [panel, viewportWrap]))
}
