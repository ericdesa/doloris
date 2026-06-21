import { Injectable, signal } from '@angular/core';
import { PainZone } from '../models/pain-zone.model';

@Injectable({ providedIn: 'root' })
export class ImportService {
  readonly pendingImport = signal<{ zones: PainZone[]; comment?: string } | null>(null);

  setPending(zones: PainZone[], comment?: string): void {
    this.pendingImport.set({ zones, comment });
  }

  clearPending(): void {
    this.pendingImport.set(null);
  }
}
