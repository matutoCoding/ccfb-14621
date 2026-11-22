import type { DesignScheme, FlowerMaterial, Venue } from '@/types'
import { idb } from './idb'
import { seedMaterials, seedVenues } from './seed'

interface AppState {
  ready: boolean
  venues: Venue[]
  materials: FlowerMaterial[]
  schemes: DesignScheme[]
  currentSchemeId: string | null
}

type Listener = () => void

class Store {
  readonly state: AppState = {
    ready: false,
    venues: [],
    materials: [],
    schemes: [],
    currentSchemeId: null
  }

  private listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  async init(): Promise<void> {
    if (this.state.ready) return
    let materials = await idb.getAll<FlowerMaterial>('materials')
    let venues = await idb.getAll<Venue>('venues')
    if (materials.length === 0) {
      materials = seedMaterials()
      await idb.bulkPut('materials', materials)
    }
    if (venues.length === 0) {
      venues = seedVenues()
      await idb.bulkPut('venues', venues)
    }
    this.state.materials = materials
    this.state.venues = venues
    this.state.schemes = await idb.getAll<DesignScheme>('schemes')
    this.state.ready = true
    this.emit()
  }

  get materialMap(): Map<string, FlowerMaterial> {
    return new Map(this.state.materials.map((item) => [item.id, item]))
  }

  get currentScheme(): DesignScheme | null {
    return this.state.schemes.find((item) => item.id === this.state.currentSchemeId) ?? null
  }

  // 场地
  async saveVenue(venue: Venue): Promise<void> {
    await idb.put('venues', venue)
    const index = this.state.venues.findIndex((item) => item.id === venue.id)
    if (index >= 0) this.state.venues[index] = venue
    else this.state.venues.push(venue)
    this.emit()
  }

  async removeVenue(id: string): Promise<void> {
    await idb.remove('venues', id)
    this.state.venues = this.state.venues.filter((item) => item.id !== id)
    this.emit()
  }

  // 花材
  async saveMaterial(material: FlowerMaterial): Promise<void> {
    await idb.put('materials', material)
    const index = this.state.materials.findIndex((item) => item.id === material.id)
    if (index >= 0) this.state.materials[index] = material
    else this.state.materials.push(material)
    this.emit()
  }

  async removeMaterial(id: string): Promise<void> {
    await idb.remove('materials', id)
    this.state.materials = this.state.materials.filter((item) => item.id !== id)
    this.emit()
  }

  // 方案
  async saveScheme(scheme: DesignScheme): Promise<void> {
    scheme.updatedAt = Date.now()
    await idb.put('schemes', scheme)
    const index = this.state.schemes.findIndex((item) => item.id === scheme.id)
    if (index >= 0) this.state.schemes[index] = scheme
    else this.state.schemes.push(scheme)
    this.state.currentSchemeId = scheme.id
    this.emit()
  }

  async removeScheme(id: string): Promise<void> {
    await idb.remove('schemes', id)
    this.state.schemes = this.state.schemes.filter((item) => item.id !== id)
    if (this.state.currentSchemeId === id) this.state.currentSchemeId = null
    this.emit()
  }

  selectScheme(id: string | null): void {
    this.state.currentSchemeId = id
    this.emit()
  }
}

export const store = new Store()

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}
