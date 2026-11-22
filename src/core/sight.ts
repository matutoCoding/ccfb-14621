import * as THREE from 'three'

export interface CameraSpot {
  id: string
  name: string
  position: [number, number, number]
  target: [number, number, number]
}

export interface BlockingDetail {
  label: string
  coverage: number
}

export interface BlockingResult {
  cameraId: string
  cameraName: string
  coverage: number
  blocked: boolean
  details: BlockingDetail[]
}

const BLOCK_THRESHOLD = 0.25

interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function projectRect(camera: THREE.PerspectiveCamera, points: THREE.Vector3[]): Rect {
  let minX = 1
  let maxX = -1
  let minY = 1
  let maxY = -1
  for (const point of points) {
    const projected = point.clone().project(camera)
    if (projected.z > 1) continue
    minX = Math.min(minX, projected.x)
    maxX = Math.max(maxX, projected.x)
    minY = Math.min(minY, projected.y)
    maxY = Math.max(maxY, projected.y)
  }
  return { minX, maxX, minY, maxY }
}

function overlapRatio(a: Rect, b: Rect): number {
  const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (width <= 0 || height <= 0) return 0
  const screenArea = (b.maxX - b.minX) * (b.maxY - b.minY)
  if (screenArea <= 0) return 0
  return (width * height) / screenArea
}

// 从机位看向背景屏，计算各结构在屏幕空间对背景屏的覆盖率
export function analyzeBlocking(
  camera: THREE.PerspectiveCamera,
  root: THREE.Object3D,
  spots: CameraSpot[]
): BlockingResult[] {
  const screen = root.getObjectByName('backdrop-screen')
  if (!screen) return []
  const screenPoints = (screen as THREE.Mesh).geometry.getAttribute('position')
  const screenWorld = Array.from({ length: screenPoints.count }, (_, i) =>
    new THREE.Vector3(screenPoints.getX(i), screenPoints.getY(i), screenPoints.getZ(i)).applyMatrix4(screen.matrixWorld)
  )

  const structureGroups = root.children.filter((child) => child.name.startsWith('structure-'))
  const results: BlockingResult[] = []

  for (const spot of spots) {
    camera.position.set(...spot.position)
    camera.lookAt(...spot.target)
    camera.updateMatrixWorld(true)

    const screenRect = projectRect(camera, screenWorld)
    const details: BlockingDetail[] = []
    let total = 0
    for (const group of structureGroups) {
      const box = new THREE.Box3().setFromObject(group)
      if (box.isEmpty()) continue
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
      ]
      const coverage = overlapRatio(projectRect(camera, corners), screenRect)
      if (coverage > 0.01) {
        details.push({ label: group.userData.label as string, coverage })
        total += coverage
      }
    }
    details.sort((a, b) => b.coverage - a.coverage)
    results.push({
      cameraId: spot.id,
      cameraName: spot.name,
      coverage: Math.min(1, total),
      blocked: Math.min(1, total) > BLOCK_THRESHOLD,
      details
    })
  }
  return results
}
