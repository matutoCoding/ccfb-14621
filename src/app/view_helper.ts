import { Viewer } from '@/three/viewer'
import { fpsReadout } from '@/app/router'

// 统一管理三维视图挂载与销毁，避免路由切换泄漏 WebGL 上下文
export function createViewer(host: HTMLElement): Viewer {
  host.replaceChildren()
  const canvasHost = document.createElement('div')
  canvasHost.className = 'viewer-canvas-host'
  host.append(canvasHost)
  return new Viewer(canvasHost, fpsReadout())
}

export function disposeViewer(viewer: Viewer | null): void {
  if (!viewer) return
  viewer.dispose()
}

export function numberInput(value: number, step: number, onInput: (value: number) => void): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'number'
  input.step = String(step)
  input.value = String(value)
  input.addEventListener('input', () => {
    const parsed = Number.parseFloat(input.value)
    if (Number.isFinite(parsed)) onInput(parsed)
  })
  return input
}
