// 渲染视口封装：renderer/scene/camera/控制器/FPS 统计
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class Viewport {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  onFps: (fps: number) => void = () => {}
  private frames = 0
  private lastT = performance.now()
  private disposed = false
  private resizeObs: ResizeObserver

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101512)
    this.camera = new THREE.PerspectiveCamera(
      50, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 500)
    this.camera.position.set(12, 6, 16)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI * 0.55

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    requestAnimationFrame(() => this.resize()) // 容器入 DOM 后校正一次尺寸
    this.loop()
  }

  private resize(): void {
    const w = this.container.clientWidth, h = Math.max(1, this.container.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private loop = (): void => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.frames++
    const now = performance.now()
    if (now - this.lastT >= 1000) {
      this.onFps(Math.round((this.frames * 1000) / (now - this.lastT)))
      this.frames = 0
      this.lastT = now
    }
  }

  dispose(): void {
    this.disposed = true
    this.resizeObs.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
