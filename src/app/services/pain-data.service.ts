import { Injectable, computed, effect, signal } from '@angular/core';
import { PainZone, PainZoneDraft, UvPoint, createDefaultDraft } from '../models/pain-zone.model';

export type InteractionMode = 'paint' | 'select';

let zoneCounter = 0;
function nextId(): string {
  zoneCounter += 1;
  return `zone-${Date.now()}-${zoneCounter}`;
}

const STORAGE_KEY = 'doloris-data';

@Injectable({ providedIn: 'root' })
export class PainDataService {
  /** Toutes les zones de douleur enregistrées. */
  readonly zones = signal<PainZone[]>([]);

  /** Injecté par BodyViewerComponent après init du moteur 3D. */
  captureZone: ((meshName: string, points: UvPoint[]) => string) | null = null;

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

  constructor() {
    this.loadFromStorage();
    effect(() => this.persist(this.zones()));
  }

  // ---------------------------------------------------------------------
  // Persistance localStorage
  // ---------------------------------------------------------------------

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { zones: PainZone[] };
      if (Array.isArray(parsed.zones)) {
        this.zones.set(parsed.zones);
      }
    } catch {
      // données corrompues — on ignore
    }
  }

  private persist(zones: PainZone[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones }));
    } catch {
      // stockage indisponible ou plein
    }
  }

  save(): void {
    this.persist(this.zones());
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
    this.zones.update((zones) =>
      zones.map((z) => (z.id === zoneId ? { ...z, ...changes, updatedAt: new Date().toISOString() } : z))
    );
    this.redrawTick.update((n) => n + 1);
  }

  removeZone(zoneId: string): void {
    this.zones.update((zones) => zones.filter((z) => z.id !== zoneId));
    if (this.selectedZoneId() === zoneId) {
      this.selectedZoneId.set(null);
    }
    this.redrawTick.update((n) => n + 1);
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
        characteristics: has
          ? d.characteristics.filter((c) => c !== characteristic)
          : [...d.characteristics, characteristic],
      };
    });
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  importJson(json: string): void {
    const parsed = JSON.parse(json) as { zones: PainZone[] };
    if (Array.isArray(parsed.zones)) {
      this.zones.set(parsed.zones);
      this.selectedZoneId.set(null);
      this.redrawTick.update((n) => n + 1);
    }
  }

  /** Images capturées depuis le viewer 3D, transmises à la page rapport. */
  readonly reportImages = signal<Map<string, string>>(new Map());
}
