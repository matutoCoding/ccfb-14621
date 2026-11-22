import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LIGHTING_PRESETS, MAX_PIXEL_RATIO } from '@/core/constants'
import type { Venue } from '@/types'

// 所有三维页面共享的场景容器
export class Viewer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly content = new THREE.Group()
  private ambient = new THREE.AmbientLight(0xffffff, 0.8)
  private keyLight = new THREE.DirectionalLight(0xffffff, 2)
  private fillLight = new THREE.DirectionalLight(0xccd6ff, 0.6)
  private frameId = 0
  private fpsElement: HTMLElement
  private frameTimes: number[] = []
  private presetIndex = 0
  private resizeObserver: ResizeObserver

  constructor(container: HTMLElement, fpsElement: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = false
    container.append(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200)
    this.camera.position.set(9, 7, 12)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.target.set(0, 2, 0)

    this.scene.add(this.ambient, this.keyLight, this.fillLight)
    this.keyLight.position.set(6, 12, 6)
    this.fillLight.position.set(-8, 6, -4)
    this.scene.add(this.content)

    this.fpsElement = fpsElement
    this.applyLighting(0)
    this.animate()

    this.resizeObserver = new ResizeObserver(() => this.resize(container))
    this.resizeObserver.observe(container)
  }

  private resize(container: HTMLElement): void {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate)
    const start = performance.now()
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    const cost = performance.now() - start
    this.frameTimes.push(cost)
    if (this.frameTimes.length > 60) this.frameTimes.shift()
    const avg = this.frameTimes.reduce((sum, item) => sum + item, 0) / this.frameTimes.length
    const fps = Math.round(1000 / Math.max(1, avg))
    this.fpsElement.textContent = `${fps} FPS · 像素比 ${this.renderer.getPixelRatio().toFixed(2)}`
  }

  applyLighting(index: number): void {
    this.presetIndex = index
    const preset = LIGHTING_PRESETS[index]
    this.ambient.color.set(preset.ambient)
    this.ambient.intensity = preset.intensity
    this.keyLight.color.set(preset.key)
    this.keyLight.intensity = preset.keyIntensity
    this.scene.background = new THREE.Color(preset.fog)
    this.scene.fog = new THREE.Fog(preset.fog, 25, 70)
  }

  get lightingIndex(): number {
    return this.presetIndex
  }

  clearContent(): void {
    this.content.clear()
  }

  addContent(object: THREE.Object3D): void {
    this.content.add(object)
  }

  setView(position: [number, number, number], target: [number, number, number]): void {
    this.camera.position.set(...position)
    this.controls.target.set(...target)
    this.controls.update()
  }

  // 场地白模：地面、T台、桌位、吊点
  buildVenue(venue: Venue): THREE.Group {
    const group = new THREE.Group()
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(venue.hallWidthM, venue.hallLengthM),
      new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.95 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, (venue.hallLengthM / 2 - venue.stageLengthM) - venue.hallLengthM / 2)
    group.add(floor)

    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(venue.stageWidthM, 0.4, venue.stageLengthM),
      new THREE.MeshStandardMaterial({ color: 0x2e333d, roughness: 0.8 })
    )
    stage.position.set(0, 0.2, -venue.hallLengthM / 2 + venue.stageLengthM / 2)
    group.add(stage)

    // 背景屏，供机位遮挡判断
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(venue.stageWidthM * 0.9, venue.ceilingHeightM * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x10131a, emissive: 0x1b2230, emissiveIntensity: 0.6 })
    )
    screen.name = 'backdrop-screen'
    screen.position.set(0, venue.ceilingHeightM * 0.4, -venue.hallLengthM / 2 + 0.15)
    group.add(screen)

    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4350, roughness: 0.85 })
    for (const table of venue.tables) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(table.radiusM, table.radiusM, 0.75, 24), tableMaterial)
      top.position.set(table.x, 0.375, table.z)
      group.add(top)
    }

    const pointMaterial = new THREE.MeshStandardMaterial({ color: 0xd49a5c, emissive: 0x6b4520, emissiveIntensity: 0.5 })
    for (const point of venue.hangPoints) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pointMaterial)
      marker.position.set(point.x, point.y, point.z)
      marker.name = `hangpoint-${point.id}`
      group.add(marker)
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x555c68 })
      )
      cable.position.set(point.x, point.y - 0.25, point.z)
      group.add(cable)
    }
    return group
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
