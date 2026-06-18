import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { PainZone, PainZoneDraft, UvPoint, createDefaultDraft } from '../models/pain-zone.model';
import { ProjectService } from './project.service';

export type InteractionMode = 'paint' | 'select';

let zoneCounter = 0;
function nextId(): string {
  zoneCounter += 1;
  return `zone-${Date.now()}-${zoneCounter}`;
}

@Injectable({ providedIn: 'root' })
export class PainDataService {
  private readonly projectService = inject(ProjectService);
  private readonly storageKey = computed(() => `doloris-data:${this.projectService.currentProjectId()}`);
  /** Toutes les zones de douleur enregistrées. */
  readonly zones = signal<PainZone[]>([]);

  /** Injecté par BodyViewerComponent après init du moteur 3D. */
  readonly captureZone = signal<((meshName: string, points: UvPoint[]) => string) | null>(null);

  /** Injecté par BodyViewerComponent après init du moteur 3D. */
  readonly captureOverview = signal<((side: 'front' | 'back') => string) | null>(null);

  /** Images de vue d'ensemble face/dos pour la page rapport. */
  readonly overviewImages = signal<{ front: string; back: string } | null>(null);

  /** Mode d'interaction avec le modèle 3D : dessiner ou sélectionner/éditer. */
  readonly mode = signal<InteractionMode>('paint');

  /** Réglages appliqués à la prochaine zone dessinée. */
  readonly draft = signal<PainZoneDraft>(createDefaultDraft());

  /** Identifiant de la zone actuellement sélectionnée pour édition. */
  readonly selectedZoneId = signal<string | null>(null);

  /** Signal pulsé lors d'une sélection manuelle pour déclencher le zoom caméra. */
  readonly focusRequest = signal<string | null>(null);

  /**
   * Compteur incrémenté uniquement lors d'opérations qui nécessitent de
   * redessiner intégralement les calques de peinture (édition, suppression,
   * import...). Le tracé en cours d'une nouvelle zone ne l'incrémente pas :
   * il est dessiné de façon incrémentale directement par le moteur 3D.
   */
  readonly redrawTick = signal(0);

  readonly selectedZone = computed(() => {
    const id = this.selectedZoneId();
    if (!id) return null;
    return this.zones().find((z) => z.id === id) ?? null;
  });

  readonly zoneCount = computed(() => this.zones().length);

  private _skipStorageLoad = false;
  private _skipPersist = false;

  constructor() {
    // Charge les zones à chaque changement de projet
    effect(() => {
      const key = this.storageKey();
      untracked(() => {
        if (this._skipStorageLoad) {
          this._skipStorageLoad = false;
          return;
        }
        this.loadFromStorage(key);
        this.selectedZoneId.set(null);
        this.redrawTick.update((n) => n + 1);
        this.overviewImages.set(null);
        this.reportImages.set(new Map());
      });
    });
    // Persiste les zones à chaque modification
    effect(() => {
      const key = this.storageKey();
      const zones = this.zones();
      untracked(() => {
        if (this._skipPersist) {
          this._skipPersist = false;
          return;
        }
        this.persist(key, zones);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Persistance localStorage
  // ---------------------------------------------------------------------

  private loadFromStorage(key: string): void {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        this.zones.set([]);
        return;
      }
      const parsed = JSON.parse(raw) as { zones: PainZone[] };
      if (Array.isArray(parsed.zones)) {
        this.zones.set(parsed.zones);
      }
    } catch {
      // données corrompues — on ignore
    }
  }

  private persist(key: string, zones: PainZone[]): void {
    try {
      localStorage.setItem(key, JSON.stringify({ zones }));
    } catch {
      // stockage indisponible ou plein
    }
  }

  save(): void {
    this.persist(this.storageKey(), this.zones());
  }

  // ---------------------------------------------------------------------
  // Création / édition
  // ---------------------------------------------------------------------

  startZone(meshName: string, bodyPartLabel: string, firstPoint: UvPoint): PainZone {
    const draft = this.draft();
    const now = new Date().toISOString();
    const zone: PainZone = {
      id: nextId(),
      meshName,
      bodyPartLabel,
      type: draft.type,
      intensity: draft.intensity,
      characteristics: [...draft.characteristics],
      notes: draft.notes,
      brushRadius: draft.brushRadius,
      points: [firstPoint],
      createdAt: now,
      updatedAt: now,
    };
    this.zones.update((zones) => [...zones, zone]);
    return zone;
  }

  /**
   * Remplace la liste complète des points d'une zone (appelé une seule fois,
   * à la fin du tracé). N'entraîne volontairement pas de redessin global :
   * le tracé est déjà visible, dessiné au fil du geste.
   */
  finalizeZonePoints(zoneId: string, points: UvPoint[]): void {
    this.zones.update((zones) => zones.map((z) => (z.id === zoneId ? { ...z, points } : z)));
  }

  updateZone(zoneId: string, changes: Partial<Omit<PainZone, 'id' | 'points' | 'meshName'>>): void {
    this.zones.update((zones) => zones.map((z) => (z.id === zoneId ? { ...z, ...changes, updatedAt: new Date().toISOString() } : z)));
    this.redrawTick.update((n) => n + 1);
  }

  removeZone(zoneId: string): void {
    this.zones.update((zones) => zones.filter((z) => z.id !== zoneId));
    if (this.selectedZoneId() === zoneId) {
      this.selectedZoneId.set(null);
    }
    this.redrawTick.update((n) => n + 1);
  }

  mergeZones(sourceId: string, targetId: string): void {
    const source = this.zones().find((z) => z.id === sourceId);
    const target = this.zones().find((z) => z.id === targetId);
    if (!source || !target || sourceId === targetId) return;
    this.zones.update((zones) =>
      zones
        .filter((z) => z.id !== sourceId)
        .map((z) =>
          z.id === targetId
            ? { ...z, points: [...z.points, ...source.points], updatedAt: new Date().toISOString() }
            : z,
        ),
    );
    if (this.selectedZoneId() === sourceId) {
      this.selectZone(targetId);
    }
    this.redrawTick.update((n) => n + 1);
  }

  reorderZones(fromDisplayIdx: number, toDisplayIdx: number): void {
    if (fromDisplayIdx === toDisplayIdx) return;
    const display = [...this.zones()].reverse();
    const [item] = display.splice(fromDisplayIdx, 1);
    display.splice(toDisplayIdx, 0, item);
    this.zones.set(display.reverse());
  }

  removeLastZone(): void {
    const zones = this.zones();
    if (zones.length === 0) return;
    this.removeZone(zones[zones.length - 1].id);
  }

  clearAll(): void {
    this.zones.set([]);
    this.selectedZoneId.set(null);
    this.redrawTick.update((n) => n + 1);
  }

  selectZone(zoneId: string | null): void {
    this.selectedZoneId.set(zoneId);
  }

  setMode(mode: InteractionMode): void {
    this.mode.set(mode);
    if (mode === 'paint') {
      this.selectedZoneId.set(null);
    }
  }

  updateDraft(changes: Partial<PainZoneDraft>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  toggleDraftCharacteristic(characteristic: string): void {
    this.draft.update((d) => {
      const has = d.characteristics.includes(characteristic);
      return {
        ...d,
        characteristics: has ? d.characteristics.filter((c) => c !== characteristic) : [...d.characteristics, characteristic],
      };
    });
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  importJson(json: string): void {
    const parsed = JSON.parse(json) as { zones: PainZone[] };
    if (Array.isArray(parsed.zones)) {
      this.loadZones(parsed.zones);
    }
  }

  loadZones(zones: PainZone[]): void {
    this.zones.set(zones);
    this.selectedZoneId.set(null);
    this.redrawTick.update((n) => n + 1);
  }

  loadSharedZones(zones: PainZone[]): void {
    this._skipStorageLoad = true;
    this._skipPersist = true;
    this.zones.set(zones);
    this.selectedZoneId.set(null);
    this.redrawTick.update((n) => n + 1);
    this.reportImages.set(new Map());
    this.overviewImages.set(null);
  }

  /** Images capturées depuis le viewer 3D, transmises à la page rapport. */
  readonly reportImages = signal<Map<string, string>>(new Map());
}
