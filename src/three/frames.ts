import * as THREE from 'three'
import type { FoamZone, StructureNode } from '@/types'
import { getParams, sampleSurface } from './surface'

const IRON_COLOR = 0x3a3f4a
const FOAM_COLOR = 0x6b8f6a
const MESH_COLOR = 0x8a7a5c

function ironMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: IRON_COLOR, metalness: 0.75, roughness: 0.45 })
}

function tubeFromPoints(points: THREE.Vector3[], radius: number, closed = false): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0)
  const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 3), radius, 8, closed)
  return new THREE.Mesh(geometry, ironMaterial())
}

function archFrame(node: StructureNode): THREE.Group {
  const p = getParams(node)
  const r = p.widthM / 2
  const group = new THREE.Group()
  const points: THREE.Vector3[] = []
  points.push(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, p.heightM, 0))
  for (let i = 0; i <= 18; i++) {
    const angle = Math.PI - (i / 18) * Math.PI
    points.push(new THREE.Vector3(Math.cos(angle) * r, p.heightM + Math.sin(angle) * r, 0))
  }
  points.push(new THREE.Vector3(r, 0, 0))
  group.add(tubeFromPoints(points, p.tubeRadiusM))
  // 前后双面铁艺，增加厚度感
  const back = group.clone()
  back.position.z = -0.35
  group.add(back)
  for (const z of [0, -0.35]) {
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(p.tubeRadiusM * 0.7, p.tubeRadiusM * 0.7, 0.35, 6),
      ironMaterial()
    )
    brace.rotation.x = Math.PI / 2
    brace.position.set(-r, p.heightM * 0.5, z - 0.175)
    group.add(brace)
  }
  return group
}

function ringFrame(node: StructureNode): THREE.Group {
  const p = getParams(node)
  const points: THREE.Vector3[] = []
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * p.radiusM, Math.sin(angle) * p.radiusM, 0))
  }
  const group = new THREE.Group()
  group.add(tubeFromPoints(points, p.tubeRadiusM, true))
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(p.tubeRadiusM, p.tubeRadiusM, p.heightM, 8),
    ironMaterial()
  )
  stand.position.set(0, -p.radiusM - p.heightM / 2, 0)
  group.add(stand)
  return group
}

function pillarFrame(node: StructureNode): THREE.Group {
  const p = getParams(node)
  const group = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(p.tubeRadiusM, p.tubeRadiusM, p.heightM, 8),
    ironMaterial()
  )
  pole.position.y = p.heightM / 2
  group.add(pole)
  for (const y of [0.15, p.heightM - 0.15]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.radiusM, p.tubeRadiusM * 0.8, 8, 32), ironMaterial())
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    group.add(ring)
  }
  return group
}

function hangerFrame(node: StructureNode): THREE.Group {
  const p = getParams(node)
  const group = new THREE.Group()
  const w = p.widthM
  const d = p.heightM
  const ring = new THREE.Mesh(new THREE.TorusGeometry(w / 2, p.tubeRadiusM, 8, 48), ironMaterial())
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0
  group.add(ring)
  // 十字承重梁与吊索
  const beamX = new THREE.Mesh(new THREE.CylinderGeometry(p.tubeRadiusM, p.tubeRadiusM, w, 8), ironMaterial())
  beamX.rotation.z = Math.PI / 2
  group.add(beamX)
  const beamZ = beamX.clone()
  beamZ.rotation.x = Math.PI / 2
  group.add(beamZ)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, d, 4),
        new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.9, roughness: 0.35 })
      )
      cable.position.set((sx * w) / 2 / Math.SQRT2, d / 2, (sz * w) / 2 / Math.SQRT2)
      group.add(cable)
    }
  }
  return group
}

function tableDomeFrame(node: StructureNode): THREE.Group {
  const p = getParams(node)
  const group = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(p.radiusM, p.tubeRadiusM, 8, 40), ironMaterial())
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.05
  group.add(ring)
  for (let i = 0; i < 4; i++) {
    const meridian = new THREE.Mesh(
      new THREE.TorusGeometry(p.radiusM, p.tubeRadiusM * 0.7, 6, 24, Math.PI),
      ironMaterial()
    )
    meridian.rotation.y = (i / 4) * Math.PI
    group.add(meridian)
  }
  return group
}

export function buildFrame(node: StructureNode): THREE.Group {
  switch (node.type) {
    case 'arch':
      return archFrame(node)
    case 'ring':
      return ringFrame(node)
    case 'pillar':
      return pillarFrame(node)
    case 'hanger':
      return hangerFrame(node)
    case 'tableDome':
      return tableDomeFrame(node)
  }
}

// 花泥/网格区域半透明预览
export function buildZoneMesh(node: StructureNode, zone: FoamZone): THREE.Mesh {
  const p = getParams(node)
  const positions: number[] = []
  const indices: number[] = []
  const segU = 28
  const segV = 14
  const sample = { pos: new THREE.Vector3(), normal: new THREE.Vector3(), anchor: new THREE.Vector3() }

  for (let j = 0; j <= segV; j++) {
    const v = j / segV
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      sampleSurface(zone.kind, u, v, zone, p, sample)
      positions.push(sample.pos.x, sample.pos.y, sample.pos.z)
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      indices.push(a, a + 1, a + segU + 1, a + 1, a + segU + 2, a + segU + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    color: zone.cover === 'foam' ? FOAM_COLOR : MESH_COLOR,
    transparent: true,
    opacity: zone.cover === 'foam' ? 0.32 : 0.22,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0
  })
  return new THREE.Mesh(geometry, material)
}
