import * as THREE from 'three'

// 花瓣参数曲面：沿长度方向卷曲、横向带杯状弧度
export function petalGeometry(width: number, length: number, cup: number, curl: number): THREE.BufferGeometry {
  const segU = 5
  const segV = 6
  const positions: number[] = []
  const indices: number[] = []

  for (let j = 0; j <= segV; j++) {
    const v = j / segV
    // 花瓣轮廓：根部窄、中部宽、顶端圆收
    const profile = Math.sin(Math.PI * v * 0.85) * (0.55 + 0.45 * v)
    const halfWidth = width * profile
    for (let i = 0; i <= segU; i++) {
      const u = i / segU - 0.5
      const x = u * 2 * halfWidth
      const y = v * length
      const z = cup * (u * u * 4) * Math.sin(Math.PI * v) + curl * v * v * length
      positions.push(x, y, z)
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      const b = a + 1
      const c = a + segU + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function faceUnit(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius || 1
  geometry.scale(1 / radius, 1 / radius, 1 / radius)
  return geometry
}

// 玫瑰：螺旋层叠花瓣，开放度决定包心到盛开
export function roseGeometry(openness: number): THREE.BufferGeometry {
  const group = new THREE.BufferGeometry()
  const geos: THREE.BufferGeometry[] = []
  const layerCounts = [5, 7, 9]
  const tiltBase = THREE.MathUtils.lerp(0.15, 1.05, openness)

  for (let layer = 0; layer < 3; layer++) {
    const length = 0.55 + layer * 0.28
    const width = 0.3 + layer * 0.14
    const petal = petalGeometry(width, length, 0.16, 0.25 - openness * 0.18)
    const count = layerCounts[layer]
    for (let i = 0; i < count; i++) {
      const copy = petal.clone()
      const angle = (i / count) * Math.PI * 2 + layer * 0.7
      const tilt = tiltBase + layer * 0.22
      copy.rotateZ(angle)
      copy.rotateX(tilt)
      copy.translate(0, 0, layer * 0.05)
      geos.push(copy)
    }
  }
  mergeInto(group, geos)
  return faceUnit(group)
}

// 菊类/康乃馨/向日葵：放射舌状花瓣 + 中央花盘
export function daisyGeometry(openness: number, petalCount = 14): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  const petal = petalGeometry(0.16, 0.85, 0.05, 0.12 - openness * 0.1)
  const lift = THREE.MathUtils.lerp(0.7, 0.12, openness)

  for (let i = 0; i < petalCount; i++) {
    const copy = petal.clone()
    copy.rotateZ((i / petalCount) * Math.PI * 2)
    copy.rotateX(lift)
    geos.push(copy)
  }
  const disc = new THREE.SphereGeometry(0.22, 8, 6)
  disc.scale(1, 1, 0.45)
  disc.translate(0, 0, 0.06)
  geos.push(disc)

  const group = new THREE.BufferGeometry()
  mergeInto(group, geos)
  return faceUnit(group)
}

export function mergeInto(target: THREE.BufferGeometry, geos: THREE.BufferGeometry[]): void {
  // 手动合并，避免引入 BufferGeometryUtils 额外模块路径问题
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  let offset = 0

  for (const geometry of geos) {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const nor = geometry.getAttribute('normal') as THREE.BufferAttribute
    const index = geometry.getIndex()
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      else normals.push(0, 0, 1)
    }
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset)
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + offset)
    }
    offset += pos.count
  }
  target.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  target.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  target.setIndex(indices)
}
