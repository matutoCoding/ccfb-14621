import { h, mount } from '@/core/dom'
import { store } from '@/core/store'
import '@/styles/app.css'

export type PageId = 'venue' | 'material' | 'structure' | 'editor' | 'preview' | 'order'

const NAV_ITEMS: { id: PageId; label: string; hint: string }[] = [
  { id: 'venue', label: '场地档案', hint: '层高 / 吊点 / 桌位' },
  { id: 'material', label: '花材库', hint: '品种 / 季节价 / 替代' },
  { id: 'structure', label: '结构搭建', hint: '铁艺骨架 / 花泥区' },
  { id: 'editor', label: '插花编辑', hint: '自动布花 / 手工调整' },
  { id: 'preview', label: '现场预览', hint: '灯光 / 机位 / 遮挡' },
  { id: 'order', label: '花材下单', hint: '核算 / 换花 / 搭建排期' }
]

export class Router {
  private host: HTMLElement
  private renderers = new Map<PageId, (container: HTMLElement) => void>()
  private current: PageId = 'venue'

  constructor(host: HTMLElement) {
    this.host = host
    window.addEventListener('hashchange', () => this.route())
    store.subscribe(() => this.renderChrome())
  }

  register(page: PageId, renderer: (container: HTMLElement) => void): void {
    this.renderers.set(page, renderer)
  }

  start(): void {
    if (!window.location.hash) window.location.hash = '#/venue'
    this.route()
  }

  private parseHash(): PageId {
    const id = window.location.hash.replace('#/', '') as PageId
    return this.renderers.has(id) ? id : 'venue'
  }

  private route(): void {
    this.current = this.parseHash()
    this.renderChrome()
    const content = document.querySelector<HTMLElement>('#page-content')
    if (!content) return
    const renderer = this.renderers.get(this.current)
    if (renderer) renderer(content)
    else mount(content, h('div', { class: 'empty-state' }, ['页面不存在']))
  }

  private renderChrome(): void {
    const scheme = store.currentScheme
    const side = h(
      'aside',
      { class: 'app-side' },
      [
        h('div', { class: 'brand' }, [
          h('div', { class: 'brand-mark' }, ['花']),
          h('div', { class: 'col' }, [
            h('strong', {}, ['花屿工坊']),
            h('span', { class: 'faint' }, ['花艺布置设计与核算'])
          ])
        ]),
        h(
          'nav',
          { class: 'nav-list' },
          NAV_ITEMS.map((item) =>
            h(
              'a',
              {
                class: `nav-item ${this.current === item.id ? 'active' : ''}`,
                href: `#/${item.id}`,
                dataset: { page: item.id }
              },
              [h('span', { class: 'nav-label' }, [item.label]), h('span', { class: 'nav-hint faint' }, [item.hint])]
            )
          )
        ),
        h('div', { class: 'scheme-box card' }, [
          h('label', {}, ['当前方案']),
          h(
            'select',
            {
              onchange: (event: Event) => {
                const value = (event.target as HTMLSelectElement).value
                store.selectScheme(value || null)
              }
            },
            [
              h('option', { value: '' }, [scheme ? '— 未选择 —' : '暂无方案，去结构搭建新建']),
              ...store.state.schemes.map((item) => {
                const option = h('option', { value: item.id }, [item.name])
                if (scheme?.id === item.id) option.selected = true
                return option
              })
            ]
          ),
          scheme
            ? h('p', { class: 'faint scheme-meta' }, [`${scheme.structures.length} 组结构 · ${scheme.season} · 预算 ¥${scheme.budget.toLocaleString('zh-CN')}`])
            : h('p', { class: 'faint scheme-meta' }, ['选择方案后才能插花与核算'])
        ])
      ]
    )

    const header = h('header', { class: 'app-header' }, [
      h('h2', {}, [NAV_ITEMS.find((item) => item.id === this.current)?.label ?? '']),
      h('div', { id: 'fps-readout', class: 'badge' }, ['等待三维视图…'])
    ])

    const shell = h('div', { class: 'app-shell' }, [
      side,
      h('div', { class: 'app-main' }, [header, h('main', { id: 'page-content', class: 'page-content' })])
    ])
    mount(this.host, shell)
  }
}

export function fpsReadout(): HTMLElement {
  return document.querySelector<HTMLElement>('#fps-readout') ?? document.body
}
