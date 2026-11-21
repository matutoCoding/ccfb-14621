// 应用入口：路由 + 导航 + 首次种子数据
import './style.css'
import { ensureSeeded } from './data/seed'
import { el } from './lib/dom'
import { renderVenuesPage } from './ui/venues_page'
import { renderFlowersPage } from './ui/flowers_page'
import { renderStructurePage } from './ui/structure_page'
import { renderArrangePage } from './ui/arrange_page'
import { renderPreviewPage } from './ui/preview_page'
import { renderOrderPage } from './ui/order_page'

const ICONS: Record<string, string> = {
  venues: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
  flowers: 'M12 22v-8m0 0c-4 0-7-3-7-7 4 0 7 3 7 7zm0 0c4 0 7-3 7-7-4 0-7 3-7 7z',
  structure: 'M4 21V10a8 8 0 0 1 16 0v11M4 21h16M9 21v-8m6 8v-8',
  arrange: 'M12 2v6m0 0c-3 3-6 4-6 8a6 6 0 0 0 12 0c0-4-3-5-6-8z',
  preview: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  order: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 6h6m-6 4h6m-6 4h4',
}

const ROUTES: [string, string, (root: HTMLElement) => Promise<void>][] = [
  ['venues', '场地档案', renderVenuesPage],
  ['flowers', '花材库', renderFlowersPage],
  ['structure', '结构搭建', renderStructurePage],
  ['arrange', '插花编辑', renderArrangePage],
  ['preview', '现场预览', renderPreviewPage],
  ['order', '花材下单', renderOrderPage],
]

function navIcon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.6')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', path)
  svg.append(p)
  return svg
}

async function main(): Promise<void> {
  await ensureSeeded()
  const app = document.getElementById('app')!

  const side = el('nav', { class: 'side' }, [
    el('div', { class: 'logo', html: '花艺<span>工坊</span>' }),
  ])
  const content = el('div', { class: 'main' })
  app.append(el('div', { class: 'app' }, [side, content]))

  for (const [key, label] of ROUTES.map(r => [r[0], r[1]] as const)) {
    const a = el('a', { class: 'nav-item', href: `#/${key}`, 'data-route': key }, [navIcon(ICONS[key]), label])
    side.append(a)
  }

  const render = async () => {
    const key = location.hash.replace('#/', '') || 'venues'
    const route = ROUTES.find(r => r[0] === key) ?? ROUTES[0]
    side.querySelectorAll('.nav-item').forEach(n =>
      n.classList.toggle('active', (n as HTMLElement).dataset.route === route[0]))
    content.innerHTML = ''
    content.className = route[0] === 'venues' || route[0] === 'flowers' || route[0] === 'order' ? 'main' : 'main-full'
    await route[2](content)
  }
  window.addEventListener('hashchange', render)
  await render()
}

main()
