import './styles/global.css'
import { h } from '@/core/dom'
import { store } from '@/core/store'
import { Router } from '@/app/router'
import { renderVenuePage } from '@/app/pages/venue_page'
import { renderMaterialPage } from '@/app/pages/material_page'
import { renderStructurePage } from '@/app/pages/structure_page'
import { renderEditorPage } from '@/app/pages/editor_page'
import { renderPreviewPage } from '@/app/pages/preview_page'
import { renderOrderPage } from '@/app/pages/order_page'

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')
  if (!app) throw new Error('缺少 #app 挂载点')

  const loading = h('div', { class: 'empty-state' }, [
    h('div', { class: 'empty-icon' }, ['花']),
    h('h3', {}, ['花屿工坊启动中']),
    h('p', { class: 'muted' }, ['正在初始化本地花材库与场地档案…'])
  ])
  app.append(loading)

  await store.init()
  loading.remove()

  const router = new Router(app)
  router.register('venue', renderVenuePage)
  router.register('material', renderMaterialPage)
  router.register('structure', renderStructurePage)
  router.register('editor', renderEditorPage)
  router.register('preview', renderPreviewPage)
  router.register('order', renderOrderPage)
  router.start()
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  const app = document.querySelector<HTMLElement>('#app')
  app?.replaceChildren(
    h('div', { class: 'empty-state' }, [
      h('h3', { class: 'danger-text' }, ['启动失败']),
      h('p', { class: 'muted' }, [error instanceof Error ? error.message : '未知错误，请刷新重试'])
    ])
  )
})
