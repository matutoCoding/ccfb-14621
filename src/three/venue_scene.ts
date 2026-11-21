// 场地场景：厅体、T台、桌位、背景屏、吊点、灯光预设、机位遮挡检测
import * as THREE from 'three'
import { Venue } from '../lib/types'

export function buildVenueGroup(v: Venue): THREE.Group {
  const g = new THREE.Group()

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(v.width, v.length),
    new THREE.MeshLambertMaterial({ color: 0x2a2f2b }))
  floor.rotation.x = -Math.PI / 2
  g.add(floor)

  const grid = new THREE.GridHelper(Math.max(v.width, v.length), Math.round(Math.max(v.width, v.length)), 0x3a443d, 0x2c352f)
  grid.position.y = 0.01
  g.add(grid)

  // T台：从厅门延伸到舞台
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(v.runway.width, 0.15, v.runway.length),
    new THREE.MeshLambertMaterial({ color: 0x8a7f70 }))
  runway.position.set(0, 0.075, v.length / 2 - v.runway.length / 2 - 2)
  g.add(runway)

  // 桌位
  const tableGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.75, 16)
  const mainMat = new THREE.MeshLambertMaterial({ color: 0xb8a888 })
  const guestMat = new THREE.MeshLambertMaterial({ color: 0x6b716c })
  for (const t of v.tables) {
    const m = new THREE.Mesh(tableGeo, t.kind === 'main' ? mainMat : guestMat)
    m.position.set(t.x, 0.375, t.z)
    g.add(m)
  }

  // 背景屏(舞台里端)
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(v.screen.width, v.screen.height),
    new THREE.MeshBasicMaterial({ color: 0x1c2a38 }))
  screen.name = 'bgScreen'
  screen.position.set(0, v.screen.height / 2 + 0.5, -v.length / 2 + 0.2)
  g.add(screen)

  // 吊点
  const rigGeo = new THREE.OctahedronGeometry(0.12)
  const rigMat = new THREE.MeshBasicMaterial({ color: 0xd0a040 })
  for (const p of v.riggingPoints) {
    const m = new THREE.Mesh(rigGeo, rigMat)
    m.position.set(p.x, p.y, p.z)
    g.add(m)
  }

  // 厅体轮廓线
  const hw = v.width / 2, hl = v.length / 2, h = v.height
  const corners = [
    new THREE.Vector3(-hw, 0, -hl), new THREE.Vector3(hw, 0, -hl),
    new THREE.Vector3(hw, 0, hl), new THREE.Vector3(-hw, 0, hl),
  ]
  const linePts: THREE.Vector3[] = []
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4]
    linePts.push(a, b)
    linePts.push(a.clone().setY(h), b.clone().setY(h))
    linePts.push(a, a.clone().setY(h))
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: 0x44504a }))
  g.add(lines)

  return g
}

export type LightPreset = 'warm' | 'cool' | 'spot'

export const LIGHT_NAMES: Record<LightPreset, string> = { warm: '暖白', cool: '冷白', spot: '追光' }

export class LightingRig {
  group = new THREE.Group()
  private ambient = new THREE.AmbientLight(0xffffff, 0.5)
  private spots: THREE.SpotLight[] = []
  private follow = new THREE.SpotLight(0xfff2dd, 0, 30, Math.PI / 8, 0.4)
  followTarget = new THREE.Object3D()

  constructor(venue: Venue) {
    this.group.add(this.ambient)
    const positions: [number, number][] = [
      [-venue.width / 4, -venue.length / 4], [venue.width / 4, -venue.length / 4],
      [-venue.width / 4, venue.length / 4], [venue.width / 4, venue.length / 4],
    ]
    for (const [x, z] of positions) {
      const s = new THREE.SpotLight(0xffffff, 300, 0, Math.PI / 3.5, 0.5)
      s.position.set(x, venue.height - 0.3, z)
      s.target.position.set(x * 0.5, 0, z * 0.5)
      this.group.add(s, s.target)
      this.spots.push(s)
    }
    this.follow.position.set(0, venue.height - 0.2, venue.length / 4)
    this.follow.target = this.followTarget
    this.group.add(this.follow, this.followTarget)
    this.apply('warm')
  }

  apply(preset: LightPreset): void {
    if (preset === 'warm') {
      this.ambient.intensity = 0.45
      for (const s of this.spots) { s.color.set(0xffd9a8); s.intensity = 350 }
      this.follow.intensity = 0
    } else if (preset === 'cool') {
      this.ambient.intensity = 0.5
      for (const s of this.spots) { s.color.set(0xdfe9ff); s.intensity = 380 }
      this.follow.intensity = 0
    } else {
      this.ambient.intensity = 0.12
      for (const s of this.spots) { s.intensity = 40 }
      this.follow.intensity = 600
    }
  }
}

// 新人站位与机位标记
export function makeMarker(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 1.0, 3, 8),
    new THREE.MeshLambertMaterial({ color }))
}

export interface CamPos { name: string; pos: THREE.Vector3 }

export function defaultCamPositions(v: Venue): CamPos[] {
  return [
    { name: '入口机位', pos: new THREE.Vector3(v.width / 4, 1.7, v.length / 2 - 1) },
    { name: 'T台侧机位', pos: new THREE.Vector3(v.runway.width / 2 + 2, 1.6, 2) },
    { name: '舞台正机位', pos: new THREE.Vector3(0, 1.5, v.length / 2 - 6) },
  ]
}

// 从机位看背景屏被骨架遮挡的比例
export function screenOcclusion(camPos: THREE.Vector3, venue: Venue, occluders: THREE.Object3D[]): number {
  const screenZ = -venue.length / 2 + 0.2
  const ray = new THREE.Raycaster()
  let blocked = 0, total = 0
  const COLS = 7, ROWS = 4
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      total++
      const target = new THREE.Vector3(
        -venue.screen.width / 2 + (venue.screen.width * i) / (COLS - 1),
        0.5 + (venue.screen.height * j) / (ROWS - 1),
        screenZ)
      const dir = target.clone().sub(camPos)
      const dist = dir.length()
      ray.set(camPos, dir.normalize())
      ray.far = dist - 0.1
      if (ray.intersectObjects(occluders, true).length > 0) blocked++
    }
  }
  return total === 0 ? 0 : blocked / total
}
