import * as THREE from 'three'
import { daisyGeometry, faceUnit, mergeInto, petalGeometry, roseGeometry } from './petals'

// 绣球：一簇四瓣小花聚成球状花头
export function hydrangeaGeometry(openness: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  const floretPetal = petalGeometry(0.12, 0.26, 0.08, 0.1 - openness * 0.05)
  const floretCount = 9
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let f = 0; f < floretCount; f++) {
    const y = 1 - (f / (floretCount - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * f
    const center = new THREE.Vector3(Math.cos(theta) * radius * 0.55, y * 0.55, Math.sin(theta) * radius * 0.55)
    for (let p = 0; p < 4; p++) {
      const copy = floretPetal.clone()
      copy.rotateZ((p / 4) * Math.PI * 2)
      copy.rotateX(0.3 + openness * 0.3)
      copy.translate(center.x, center.y, center.z)
      geos.push(copy)
    }
  }
  const group = new THREE.BufferGeometry()
  mergeInto(group, geos)
  return faceUnit(group)
}

// 蝴蝶兰：宽阔唇瓣 + 两枚侧瓣，开放度低时呈花苞态
export function phalaenopsisGeometry(openness: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  const spread = THREE.MathUtils.lerp(0.2, 0.05, openness)

  const lip = petalGeometry(0.2, 0.4, 0.2, 0.15)
  lip.rotateX(0.2 + openness * 0.5)
  geos.push(lip)

  const sideAngles = [0.85, -0.85, 2.35, -2.35]
  for (const angle of sideAngles) {
    const petal = petalGeometry(0.26, 0.55, 0.1, 0.08)
    petal.rotateZ(angle)
    petal.rotateX(spread + Math.abs(Math.sin(angle)) * 0.25)
    geos.push(petal)
  }
  const throat = new THREE.SphereGeometry(0.1, 8, 6)
  throat.translate(0, 0, 0.08)
  geos.push(throat)

  const group = new THREE.BufferGeometry()
  mergeInto(group, geos)
  return faceUnit(group)
}

// 尤加利：对生圆叶枝条
export function eucalyptusGeometry(openness: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = []
  const stem = new THREE.CylinderGeometry(0.015, 0.02, 1.1, 5)
  stem.rotateX(Math.PI / 2)
  geos.push(stem)

  const leafPairs = 4
  for (let pair = 0; pair < leafPairs; pair++) {
    const t = 0.25 + pair * 0.22
    for (const side of [-1, 1]) {
      const leaf = new THREE.SphereGeometry(0.2, 8, 6)
      leaf.scale(1, 0.12, 0.75)
      leaf.rotateZ(side * 0.9)
      leaf.translate(side * (0.16 + pair * 0.02), t * 0.7, -0.1 + openness * 0.05)
      geos.push(leaf)
    }
  }
  const group = new THREE.BufferGeometry()
  mergeInto(group, geos)
  return faceUnit(group)
}

// 通用叶材：单片尖叶，不同品种靠缩放与实例差异区分
export function leafGeometry(): THREE.BufferGeometry {
  const geometry = petalGeometry(0.22, 1, 0.04, 0.18)
  const vein = new THREE.CylinderGeometry(0.012, 0.012, 1, 4)
  vein.rotateX(Math.PI / 2)
  const group = new THREE.BufferGeometry()
  mergeInto(group, [geometry, vein])
  return faceUnit(group)
}

export type FlowerTemplate = 'rose' | 'daisy' | 'hydrangea' | 'phalaenopsis' | 'eucalyptus' | 'leaf'

// 按花材 id 前缀归类到五种程序化模板
export function templateOf(materialId: string): FlowerTemplate {
  if (materialId.startsWith('g_')) {
    if (materialId === 'g_eucalyptus' || materialId === 'g_eucalyptus_r') return 'eucalyptus'
    return 'leaf'
  }
  if (materialId === 'm_phalaenopsis' || materialId === 'm_cymbidium') return 'phalaenopsis'
  if (materialId.startsWith('f_hydrangea')) return 'hydrangea'
  if (materialId === 'm_lizhi' || materialId === 'm_peony' || materialId === 'm_tineke' || materialId === 'm_champagne' || materialId === 'm_carola') return 'rose'
  return 'daisy'
}

export function buildTemplateGeometry(template: string, openness: number): THREE.BufferGeometry {
  switch (template) {
    case 'rose':
      return roseGeometry(openness)
    case 'hydrangea':
      return hydrangeaGeometry(openness)
    case 'phalaenopsis':
      return phalaenopsisGeometry(openness)
    case 'eucalyptus':
      return eucalyptusGeometry(openness)
    case 'leaf':
      return leafGeometry()
    default:
      return daisyGeometry(openness)
  }
}
