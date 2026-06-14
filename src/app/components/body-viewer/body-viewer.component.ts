import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, untracked, ChangeDetectionStrategy, signal } from '@angular/core';

import { BodySceneEngine, RaycastHit } from '../../services/body-scene.engine';
import { PainDataService } from '../../services/pain-data.service';
import { ZoneMapService } from '../../services/zone-map.service';
import { findZoneAtUv } from '../../services/geometry.utils';
import { resolveZoneLabel } from '../../services/zone-lookup.utils';
import { PAIN_TYPES, getPainType } from '../../models/pain-types';
import { UvPoint } from '../../models/pain-zone.model';
import { ZoneDrag } from '../../models/zone-drag.model';

function blendWithWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * ratio + 255 * (1 - ratio))},${Math.round(g * ratio + 255 * (1 - ratio))},${Math.round(b * ratio + 255 * (1 - ratio))})`;
}

@Component({
    selector: 'app-body-viewer',
    imports: [],
    templateUrl: './body-viewer.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './body-viewer.component.scss'
})
export class BodyViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  readonly painData    = inject(PainDataService);
  readonly zoneMapService = inject(ZoneMapService);
  readonly painTypes   = PAIN_TYPES;

  private engine: BodySceneEngine | null = null;

  // Pain drawing state
  private isDrawing = false;
  private currentZoneId: string | null = null;
  private currentMeshName: string | null = null;
  private currentPoints: UvPoint[] = [];

  // Zone painting state
  private isDrawingZone = false;
  private currentZoneMesh: string | null = null;
  private currentZoneDrag: ZoneDrag | null = null;

  readonly debugMode      = signal(new URLSearchParams(window.location.search).has('debug'));
  readonly isLoading      = signal(true);
  readonly showZoneMap    = signal(false);
  private zoneMapRendered = signal(false);
  readonly zoneDrawMode   = signal(false);
  readonly activePaintZoneKey = signal<string | null>(null);
  readonly zoneBrushRadius    = signal(0.02);

  readonly zoneEntries = computed(() => Object.entries(this.zoneMapService.colors()));

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
      if (zone) this.engine?.focusOnZone(zone.meshName, zone.points);
    });

    // Visibilité de l'overlay de zone map
    effect(() => {
      this.engine?.setZoneMapVisible(this.showZoneMap());
    });

    // Entrer en mode dessin de zones active automatiquement l'overlay
    effect(() => {
      if (this.zoneDrawMode()) {
        untracked(() => {
          if (!this.showZoneMap()) this.showZoneMap.set(true);
        });
      }
    });

    // Lazy-render : déclenche le calcul vertex la première fois que l'overlay est activé
    effect(() => {
      if (this.showZoneMap() && !untracked(() => this.zoneMapRendered())) {
        untracked(() => {
          if (!this.engine) return;
          console.time("[doloris] replayZones (dev)");
          this.engine.replayZoneDragsBatch(this.zoneMapService.drags());
          console.timeEnd("[doloris] replayZones (dev)");
          this.zoneMapRendered.set(true);
        });
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    console.time("[doloris] init");
    const container = this.containerRef.nativeElement;
    this.engine = new BodySceneEngine(container);
    try {
      console.time("[doloris] loadModel");
      await this.engine.loadModel('assets/models/body.glb');
      console.timeEnd("[doloris] loadModel");

      this.engine.redrawAll(this.painData.zones());
      this.painData.captureZone = (m, p) => this.engine!.captureZone(m, p);
    } catch (err) {
      console.error('[doloris] Erreur critique au chargement:', err);
    } finally {
      this.isLoading.set(false);
      console.timeEnd("[doloris] init");
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

  clearZoneMap(): void {
    if (!window.confirm('Effacer toute la carte de zones peinte ?')) return;
    this.zoneMapService.clear();
    this.engine?.clearZoneMap();
    this.showZoneMap.set(false);
  }

  onZoneColorChange(key: string, event: Event): void {
    this.zoneMapService.setColor(key, (event.target as HTMLInputElement).value);
  }

  resetColors(): void {
    this.zoneMapService.resetColors();
  }

  onZoneBrushChange(event: Event): void {
    this.zoneBrushRadius.set(Number((event.target as HTMLInputElement).value));
  }

  // -----------------------------------------------------------------------
  // Interaction pointeur
  // -----------------------------------------------------------------------

  private finishZoneDraw(): void {
    if (!this.isDrawingZone) return;
    if (this.currentZoneDrag && this.currentZoneDrag.points.length > 0) {
      this.zoneMapService.addDrag(this.currentZoneDrag);
    }
    this.isDrawingZone = false;
    this.currentZoneMesh = null;
    this.currentZoneDrag = null;
    this.engine?.setControlsEnabled(true);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.engine || event.button !== 0) return;

    if (this.zoneDrawMode()) {
      const paintKey = this.activePaintZoneKey();
      if (!paintKey) return;
      const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);
      if (!hit) return;
      const color = this.zoneMapService.colors()[paintKey];
      const p = { wx: hit.worldPoint.x, wy: hit.worldPoint.y, wz: hit.worldPoint.z };
      this.currentZoneDrag = { meshName: hit.meshName, colorHex: color, brushRadius: this.zoneBrushRadius(), points: [p] };
      this.engine.paintZone(hit.meshName, hit.worldPoint, color, this.zoneBrushRadius());
      this.isDrawingZone = true;
      this.currentZoneMesh = hit.meshName;
      this.engine.setControlsEnabled(false);
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }

    const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);
    if (!hit) return;

    if (this.painData.mode() === 'paint') {
      const label = resolveZoneLabel(
        this.zoneMapService.drags(),
        this.engine.currentModelRadius,
        hit.meshName,
        hit.worldPoint.x, hit.worldPoint.y, hit.worldPoint.z
      );
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
    const needsRaycast = (this.isDrawing && !!this.currentMeshName)
      || (this.isDrawingZone && !!this.currentZoneMesh);
    if (!needsRaycast) return;

    const hit = this.engine.raycastFromScreen(event.clientX, event.clientY);

    if (this.isDrawingZone && this.currentZoneMesh && this.currentZoneDrag && hit?.meshName === this.currentZoneMesh) {
      const color = this.zoneMapService.colors()[this.activePaintZoneKey() ?? ''];
      if (color) {
        this.currentZoneDrag.points.push({ wx: hit.worldPoint.x, wy: hit.worldPoint.y, wz: hit.worldPoint.z });
        this.engine.paintZone(hit.meshName, hit.worldPoint, color, this.zoneBrushRadius());
      }
    }

    if (this.isDrawing && this.currentMeshName && hit && hit.meshName === this.currentMeshName) {
      this.currentPoints.push(hit.uv);
      this.paintPoint(hit);
    }
  }

  onPointerUp(): void {
    this.finishStroke();
    this.finishZoneDraw();
  }

  onPointerLeave(): void {
    this.finishStroke();
    this.finishZoneDraw();
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
