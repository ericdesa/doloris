import { Injectable } from '@angular/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import { PainZone } from '../models/pain-zone.model';

const SHARE_PREFIX = '#share=';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private encode(zones: PainZone[]): string {
    const slim = zones.map((z) => ({
      ...z,
      points: z.points.map(({ u, v }) => ({ u, v })),
    }));
    return compressToEncodedURIComponent(JSON.stringify({ zones: slim }));
  }

  private decode(compressed: string): PainZone[] | null {
    try {
      const json = decompressFromEncodedURIComponent(compressed);
      if (!json) return null;
      const parsed = JSON.parse(json) as { zones: PainZone[] };
      return Array.isArray(parsed.zones) ? parsed.zones : null;
    } catch {
      return null;
    }
  }

  getShareUrl(zones: PainZone[]): string {
    const encoded = this.encode(zones);
    const url = new URL(window.location.href);
    url.hash = 'share=' + encoded;
    return url.toString();
  }

  extractFromFragment(): PainZone[] | null {
    const hash = window.location.hash;
    if (!hash.startsWith(SHARE_PREFIX)) return null;
    return this.decode(hash.slice(SHARE_PREFIX.length));
  }

  clearFragment(): void {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
