// 页面共享数据加载
import { dbAll } from './db'
import { FlowerVariety, Project, StructureItem, Venue } from './types'

export interface Ctx {
  venues: Venue[]
  flowers: FlowerVariety[]
  flowerMap: Map<string, FlowerVariety>
  projects: Project[]
  structures: StructureItem[]
}

export async function loadCtx(): Promise<Ctx> {
  const [venues, flowers, projects, structures] = await Promise.all([
    dbAll<Venue>('venues'), dbAll<FlowerVariety>('flowers'),
    dbAll<Project>('projects'), dbAll<StructureItem>('structures'),
  ])
  return {
    venues, flowers,
    flowerMap: new Map(flowers.map(f => [f.id, f])),
    projects, structures,
  }
}

export const getCurrentProjectId = () => localStorage.getItem('flora_project') ?? ''
export const setCurrentProjectId = (id: string) => localStorage.setItem('flora_project', id)
