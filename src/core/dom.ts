// 极简 DOM 构造工具，避免引入框架
type ElProps<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'dataset'>> & {
  class?: string
  style?: string | Partial<CSSStyleDeclaration>
  dataset?: Record<string, string>
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps<K> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset') {
      Object.assign(el.dataset, value)
    } else if (key === 'style' && typeof value === 'string') {
      el.setAttribute('style', value)
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    } else if (key === 'class') {
      el.className = value as string
    } else {
      ;(el as Record<string, unknown>)[key] = value
    }
  }
  for (const child of children) {
    el.append(child instanceof Node ? child : document.createTextNode(child))
  }
  return el
}

export function clear(el: HTMLElement): void {
  el.replaceChildren()
}

export function mount(host: HTMLElement, node: Node): void {
  clear(host)
  host.append(node)
}

export function fmtNum(value: number, digits = 0): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function fmtMoney(value: number): string {
  return `¥${fmtNum(value, 2)}`
}

let toastHost: HTMLElement | null = null

export function toast(message: string, tone: 'info' | 'danger' | 'warning' | 'success' = 'info'): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host' })
    document.body.append(toastHost)
  }
  const node = h('div', { class: `toast ${tone === 'info' ? '' : tone}` }, [message])
  toastHost.append(node)
  window.setTimeout(() => node.remove(), 3600)
}

export function confirmDialog(message: string): boolean {
  return window.confirm(message)
}
