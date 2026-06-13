import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, untracked, ChangeDetectionStrategy, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { BodySceneEngine, RaycastHit } from '../../services/body-scene.engine';
import { PainDataService } from '../../services/pain-data.service';
import { findZoneAtUv } from '../../services/geometry.utils';
import { bodyPartLabel, BODY_PART_LABELS, BODY_PART_CENTROIDS, BodyPartCandidate } from '../../models/body-parts';
import { PAIN_TYPES, getPainType } from '../../models/pain-types';
import { UvPoint } from '../../models/pain-zone.model';

function blendWithWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * ratio + 255 * (1 - ratio))},${Math.round(g * ratio + 255 * (1 - ratio))},${Math.round(b * ratio + 255 * (1 - ratio))})`;
}

@Component({
    selector: 'app-body-viewer',
    imports: [DecimalPipe],
    templateUrl: './body-viewer.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './body-viewer.component.scss'
})
export class BodyViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  readonly painData = inject(PainDataService);
  readonly painTypes = PAIN_TYPES;

  private engine: BodySceneEngine | null = null;

  private isDrawing = false;
  private currentZoneId: string | null = null;
  private currentMeshName: string | null = null;
  private currentPoints: UvPoint[] = [];

  readonly modelSource = signal<'gltf' | 'fallback' | null>(null);
  readonly isLoading = signal(true);
  readonly debugMode = signal(false);
  readonly debugInfo = signal<{ winner: string; nx: number; ny: number; nz: number; candidates: BodyPartCandidate[] } | null>(null);
  readonly centroidOverlay = signal<Array<{ key: string; x: number; y: number }>>([]);
  readonly selectedCentroidKey = signal<string | null>(null);
  readonly editedCentroids = signal([...BODY_PART_CENTROIDS] as Array<{ key: string; nx: number; ny: number; nz: number }>);

  readonly intensityDotColors = computed(() => {
    const type = getPainType(this.painData.draft().type);
    return Array.from({ length: 10 }, (_, i) => {
      const ratio = 0.18 + (i / 9) * 0.82;
      return blendWithWhite(type.color, ratio);
    });
  });

  constructor() {
    effect(() => {
      this.painData.redrawTick();
      const zones = untracked(() => this.painData.zones());
      this.engine?.redrawAll(zones);
    });

    effect(() => {
      const zone = this.painData.selectedZone();
      if (zone) {
        this.engine?.focusOnZone(zone.meshName, zone.points);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const container = this.containerRef.nativeElement;
    this.engine = new BodySceneEngine(container);
    this.engine.onFrame = () => {
      if (this.debugMode()) {
        this.centroidOverlay.set(this.engine!.getCentroidScreenPositions(this.editedCentroids()));
      }
    };
    try {
      this.modelSource.set(await this.engine.loadModel('assets/models/body.glb'));
      this.engine.redrawAll(this.painData.zones());
      this.painData.captureZone = (m, p) => this.engine!.captureZone(m, p);
    } catch (err) {
      console.error('[doloris] Erreur critique au chargement:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.painData.captureZone = null;
    this.engine?.dispose();
  }

  resetView(): void {
    this.engine?.resetView(true);
  }

  onBrushSizeChange(event: Event): void {
    this.painData.updateDraft({ brushRadius: Number((event.target as HTMLInputElement).value) });
  }

  clearAll(): void {
    if (this.painData.zoneCount() === 0) return;
    if (window.confirm('Effacer toutes les zones de douleur enregistrées ?')) {
      this.painData.clearAll();
    }
  }

  // -----------------------------------------------------------------------
  // Interaction pointeur
  // -----------------------------------------------------------------------

  selectCentroid(key: string, event: PointerEvent): void {
    event.stopPropagation();
    this.selectedCentroidKey.set(this.selectedCentroidKey() === key ? null : key);
  }

  copyEditedCentroids(): void {
    const lines = this.editedCentroids().map(c => {
      const ny = c.ny.toFixed(3);
      const nz = c.nz >= 0 ? `+${c.nz.toFixed(2)}` : c.nz.toFixed(2);
      return `  { key: '${c.key}',${' '.repeat(Math.max(1, 22 - c.key.length))}nx: ${c.nx >= 0 ? ' ' : ''}${c.nx.toFixed(3)}, ny: ${ny}, nz: ${nz} },`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
  }

  resetCentroids(): void {
    this.editedCentroids.set([...BODY_PART_CENTROIDS]);
    this.selectedCentroidKey.set(null);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.engine || event.button !== 0) return;

    if (this.debugMode() && this.selectedCentroidKey()) {
      const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);
      if (hit) {
        const { nx, ny, nz } = this.engine.normalizePoint(hit.uv.wx ?? 0, hit.uv.wy ?? 0, hit.uv.wz ?? 0);
        const key = this.selectedCentroidKey()!;
        this.editedCentroids.update(cs => cs.map(c => c.key === key ? { ...c, nx, ny, nz } : c));
      }
      this.selectedCentroidKey.set(null);
      return;
    }

    const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);
    if (!hit) return;

    if (this.painData.mode() === 'paint') {
      const inferredKey = BODY_PART_LABELS[hit.meshName] !== undefined
        ? hit.meshName
        : this.engine!.inferBodyPart(hit.uv.wx ?? 0, hit.uv.wy ?? 0, hit.uv.wz ?? 0);
      const label = bodyPartLabel(inferredKey);
      const zone = this.painData.startZone(hit.meshName, label, hit.uv);

      this.currentZoneId = zone.id;
      this.currentMeshName = hit.meshName;
      this.currentPoints = [hit.uv];
      this.isDrawing = true;

      this.engine.setControlsEnabled(false);
      this.paintPoint(hit);

      const target = event.target as HTMLElement;
      target.setPointerCapture?.(event.pointerId);
    } else {
      const zone = findZoneAtUv(this.painData.zones(), hit.meshName, hit.uv);
      this.painData.selectZone(zone?.id ?? null);
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.engine) return;
    const needsRaycast = this.debugMode() || (this.isDrawing && !!this.currentMeshName);
    if (!needsRaycast) return;

    const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);

    if (this.debugMode()) {
      this.debugInfo.set(hit
        ? this.engine.inferBodyPartDebug(hit.uv.wx ?? 0, hit.uv.wy ?? 0, hit.uv.wz ?? 0)
        : null);
    }

    if (this.isDrawing && this.currentMeshName && hit && hit.meshName === this.currentMeshName) {
      this.currentPoints.push(hit.uv);
      this.paintPoint(hit);
    }
  }

  onPointerUp(): void {
    this.finishStroke();
  }

  onPointerLeave(): void {
    this.finishStroke();
  }

  private paintPoint(hit: RaycastHit): void {
    if (!this.engine || !this.currentMeshName) return;
    const draft = this.painData.draft();
    const type = getPainType(draft.type);
    this.engine.paintAt(this.currentMeshName, hit.worldPoint, type.color, draft.intensity, draft.brushRadius);
  }

  private finishStroke(): void {
    if (!this.isDrawing) return;
    if (this.currentZoneId) {
      this.painData.finalizeZonePoints(this.currentZoneId, this.currentPoints);
    }
    this.isDrawing = false;
    this.currentZoneId = null;
    this.currentMeshName = null;
    this.currentPoints = [];
    this.engine?.setControlsEnabled(true);
  }
}
