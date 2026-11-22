import * as THREE from 'three'
import type { FoamZone, StructureNode, StructureType, ZoneKind } from '@/types'

export interface SurfaceSample {
  pos: THREE.Vector3
  normal: THREE.Vector3
  anchor: THREE.Vector3
}

export interface StructureParams {
  widthM: number
  heightM: number
  radiusM: number
  tubeRadiusM: number
}

export function getParams(node: StructureNode): StructureParams {
  const p = node.params
  return {
    widthM: p.widthM ?? 3,
    heightM: p.heightM ?? 2.4,
    radiusM: p.radiusM ?? 1,
    tubeRadiusM: p.tubeRadiusM ?? 0.08
  }
}

// 拱门主路径长度：两根立柱 + 半圆
function archPathLength(p: StructureParams): number {
  const r = p.widthM / 2
  return p.heightM * 2 + Math.PI * r
}

// 拱门 u(0~1) -> 路径中心点与朝外法线
function archPath(u: number, p: StructureParams, target: THREE.Vector3, normal: THREE.Vector3): void {
  const r = p.widthM / 2
  const total = archPathLength(p)
  const s = THREE.MathUtils.clamp(u, 0, 1) * total
  if (s <= p.heightM) {
    target.set(-r, s, 0)
    normal.set(-1, 0, 0)
    return
  }
  if (s >= p.heightM + Math.PI * r) {
    const down = s - p.heightM - Math.PI * r
    target.set(r, p.heightM - down, 0)
    normal.set(1, 0, 0)
    return
  }
  const angle = Math.PI - (s - p.heightM) / r
  target.set(Math.cos(angle) * r, p.heightM + Math.sin(angle) * r, 0)
  normal.set(Math.cos(angle), Math.sin(angle), 0)
}

const tmpPos = new THREE.Vector3()
const tmpNormal = new THREE.Vector3()
const tmpAnchor = new THREE.Vector3()
const FORWARD = new THREE.Vector3(0, 0, 1)
const DOWN = new THREE.Vector3(0, -1, 0)

// 花泥区域 uv -> 局部坐标、朝向法线、锚固点（判断枝长用）
export function sampleSurface(
  kind: ZoneKind,
  u: number,
  v: number,
  zone: FoamZone,
  p: StructureParams,
  out: SurfaceSample
): void {
  const uu = THREE.MathUtils.clamp(u, 0, 1)
  const vv = THREE.MathUtils.clamp(v, 0, 1)
  const pos = out.pos
  const normal = out.normal
  const anchor = out.anchor

  switch (kind) {
    case 'archBand': {
      archPath(uu, p, tmpPos, tmpNormal)
      tmpAnchor.copy(tmpPos)
      const lift = p.tubeRadiusM + (vv - 0.5) * zone.heightM
      pos.copy(tmpPos).addScaledVector(tmpNormal, lift)
      pos.z = (vv - 0.5) * zone.thicknessM
      normal.copy(tmpNormal).addScaledVector(FORWARD, 0.9).normalize()
      anchor.copy(tmpAnchor)
      break
    }
    case 'ringSector': {
      const span = (zone.u1 - zone.u0) * Math.PI * 2
      const angle = (zone.u0 + uu * (zone.u1 - zone.u0)) * Math.PI * 2 - Math.PI / 2
      const radial = tmpNormal.set(Math.cos(angle), Math.sin(angle), 0)
      const centerR = zone.radiusM
      tmpAnchor.set(Math.cos(angle) * centerR, Math.sin(angle) * centerR, 0)
      const offset = (vv - 0.5) * zone.heightM
      pos.copy(tmpAnchor).addScaledVector(radial, offset)
      pos.z = (vv - 0.5) * zone.thicknessM
      normal.copy(radial).addScaledVector(FORWARD, 0.9).normalize()
      anchor.copy(tmpAnchor)
      void span
      break
    }
    case 'pillarSleeve': {
      const angle = uu * Math.PI * 2
      const radial = tmpNormal.set(Math.cos(angle), 0, Math.sin(angle))
      pos.set(radial.x * (p.radiusM + zone.thicknessM / 2), vv * zone.heightM, radial.z * (p.radiusM + zone.thicknessM / 2))
      normal.copy(radial)
      anchor.set(0, pos.y, 0)
      break
    }
    case 'hangerPanel': {
      pos.set((uu - 0.5) * zone.widthM, 0, (vv - 0.5) * zone.heightM)
      normal.copy(DOWN)
      anchor.set(pos.x, zone.thicknessM, pos.z)
      break
    }
    case 'domeShell': {
      const theta0 = THREE.MathUtils.lerp(0.12 * Math.PI, 0.5 * Math.PI, zone.v0)
      const theta1 = THREE.MathUtils.lerp(0.12 * Math.PI, 0.5 * Math.PI, zone.v1)
      const theta = THREE.MathUtils.lerp(theta0, theta1, vv)
      const phi = (zone.u0 + uu * (zone.u1 - zone.u0)) * Math.PI * 2
      const r = zone.radiusM
      tmpNormal.set(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      )
      pos.copy(tmpNormal).multiplyScalar(r + zone.thicknessM / 2)
      normal.copy(tmpNormal)
      anchor.set(0, 0, 0)
      break
    }
  }
}

export function surfaceArea(zone: FoamZone, p: StructureParams): number {
  switch (zone.kind) {
    case 'archBand':
      return archPathLength(p) * zone.heightM
    case 'ringSector': {
      const span = (zone.u1 - zone.u0) * Math.PI * 2
      return span * zone.radiusM * zone.heightM
    }
    case 'pillarSleeve':
      return Math.PI * 2 * p.radiusM * zone.heightM
    case 'hangerPanel':
      return zone.widthM * zone.heightM
    case 'domeShell': {
      const theta0 = THREE.MathUtils.lerp(0.12 * Math.PI, 0.5 * Math.PI, zone.v0)
      const theta1 = THREE.MathUtils.lerp(0.12 * Math.PI, 0.5 * Math.PI, zone.v1)
      const r = zone.radiusM
      return (zone.u1 - zone.u0) * Math.PI * 2 * r * r * (Math.cos(theta0) - Math.cos(theta1))
    }
  }
}

export function defaultZones(type: StructureType): FoamZone[] {
  const base = {
    u0: 0,
    u1: 1,
    v0: 0,
    v1: 1,
    mainMix: 0.35,
    fillerMix: 0.35,
    density: 110,
    maxReachCm: 60
  }
  switch (type) {
    case 'arch':
      return [{ ...base, id: 'z_arch', label: '拱门全包花泥带', kind: 'archBand', cover: 'foam', widthM: 0, heightM: 0.55, radiusM: 0, thicknessM: 0.1 }]
    case 'ring':
      return [{ ...base, id: 'z_ring', label: '圆环花泥环带', kind: 'ringSector', cover: 'foam', widthM: 0, heightM: 0.5, radiusM: 1.4, thicknessM: 0.1 }]
    case 'pillar':
      return [{ ...base, id: 'z_pillar', label: '柱身花泥套筒', kind: 'pillarSleeve', cover: 'mesh', widthM: 0, heightM: 2, radiusM: 0, thicknessM: 0.08, density: 90 }]
    case 'hanger':
      return [{ ...base, id: 'z_hanger', label: '吊架花瀑面板', kind: 'hangerPanel', cover: 'mesh', widthM: 3, heightM: 3, radiusM: 0, thicknessM: 0.06, density: 130 }]
    case 'tableDome':
      return [{ ...base, id: 'z_dome', label: '主桌半球花泥', kind: 'domeShell', cover: 'foam', widthM: 0, heightM: 0, radiusM: 0.6, thicknessM: 0.08, density: 150 }]
  }
}
