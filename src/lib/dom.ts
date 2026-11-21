// DOM 小工具
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, unknown> = {}, children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue
    if (k === 'class') e.className = String(v)
    else if (k === 'text') e.textContent = String(v)
    else if (k === 'html') e.innerHTML = String(v)
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v as EventListener)
    else e.setAttribute(k, String(v))
  }
  for (const c of children) e.append(c)
  return e
}

export const fmt = (n: number, d = 2) => n.toFixed(d)
export const fmtInt = (n: number) => n.toLocaleString('zh-CN')
export const fmtMoney = (n: number) => '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })

export function field(label: string, input: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, [el('label', { text: label }), input])
}

export function numInput(value: number, onChange: (v: number) => void, step = 1): HTMLInputElement {
  const i = el('input', { type: 'number', value: String(value), step: String(step) })
  i.addEventListener('change', () => { const v = parseFloat(i.value); if (!Number.isNaN(v)) onChange(v) })
  return i
}

export function textInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const i = el('input', { type: 'text', value })
  i.addEventListener('change', () => onChange(i.value))
  return i
}

export function select<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLSelectElement {
  const s = el('select', {}, options.map(([v, t]) => {
    const o = el('option', { value: v, text: t })
    if (v === value) o.selected = true
    return o
  }))
  s.addEventListener('change', () => onChange(s.value as T))
  return s
}
