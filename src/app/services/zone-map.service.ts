import { Injectable, signal } from '@angular/core';
import { ZoneDrag } from '../models/zone-drag.model';
import { ZONE_COLOR_PALETTE } from '../models/body-parts';
import { defaultMaleZoneDrags } from './default-male-zone-drags';

@Injectable({ providedIn: 'root' })
export class ZoneMapService {
  private readonly STORAGE_KEY = 'doloris-zone-map';

  readonly drags = signal<ZoneDrag[]>([]);
  readonly colors = signal<Record<string, string>>({ ...ZONE_COLOR_PALETTE });

  constructor() {
    this.colors.set({ ...ZONE_COLOR_PALETTE });
    this.drags.set(defaultMaleZoneDrags());

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.drags)) this.drags.set(data.drags);
        if (data.colors && typeof data.colors === 'object') this.colors.set(data.colors);
      }
    } catch {
      /* localStorage indisponible ou données corrompues */
    }
  }

  addDrag(drag: ZoneDrag): void {
    this.drags.update((ds) => [...ds, drag]);
  }

  clear(): void {
    this.drags.set([]);
  }

  setColor(key: string, hex: string): void {
    this.colors.update((cols) => ({ ...cols, [key]: hex }));
  }

  resetColors(): void {
    this.colors.set({ ...ZONE_COLOR_PALETTE });
  }
}
