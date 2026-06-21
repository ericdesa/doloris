import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';

import { PainDataService } from '../../services/pain-data.service';
import { ProjectService } from '../../services/project.service';
import { ImportService } from '../../services/import.service';
import { getPainType, PAIN_TYPES } from '../../models/pain-types';
import { BodyViewerComponent } from '../body-viewer/body-viewer.component';

@Component({
  selector: 'app-report',
  imports: [BodyViewerComponent],
  templateUrl: './report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './report.component.scss',
})
export class ReportComponent {
  readonly painData = inject(PainDataService);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly importService = inject(ImportService);

  private readonly commentKey = computed(() => `pain-mapper:report-comment:${this.projectService.currentProjectId()}`);

  readonly zones = this.painData.zones;
  readonly today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  readonly getPainType = getPainType;

  readonly usedPainTypes = computed(() => {
    const used = new Set(this.zones().map((z) => z.type));
    return PAIN_TYPES.filter((t) => used.has(t.id));
  });

  readonly comment = signal<string>('');

  readonly showViewer = signal(false);
  readonly overviewImages = this.painData.overviewImages;

  readonly isImportedReport = signal(false);
  private importedComment: string | null = null;

  constructor() {
    effect(() => {
      const key = this.commentKey();
      this.comment.set(localStorage.getItem(key) ?? '');
    });

    effect(() => {
      const pending = this.importService.pendingImport();
      if (pending) {
        this.importService.clearPending();
        this.importedComment = pending.comment ?? null;
        this.painData.loadImportedZones(pending.zones);
        this.showViewer.set(true);
        this.isImportedReport.set(true);
      }
    });

    const needsZones = this.painData.reportImages().size === 0 && this.painData.zones().length > 0;
    const needsOverview = !this.painData.overviewImages();
    if (needsZones || needsOverview) {
      this.showViewer.set(true);
    }

    effect(() => {
      const captureZone = this.painData.captureZone();
      const captureOverview = this.painData.captureOverview();
      if ((!captureZone && !captureOverview) || !this.showViewer()) return;

      if (captureZone && this.painData.zones().length > 0) {
        const images = new Map<string, string>();
        for (const zone of this.painData.zones()) {
          const img = captureZone(zone.meshName, zone.points);
          if (img) images.set(zone.id, img);
        }
        this.painData.reportImages.set(images);
      }

      if (captureOverview) {
        this.painData.overviewImages.set({
          front: captureOverview('front'),
          back: captureOverview('back'),
        });
      }

      this.showViewer.set(false);
    });
  }

  onCommentChange(value: string): void {
    this.comment.set(value);
    localStorage.setItem(this.commentKey(), value);
  }

  getImage(zoneId: string): string | undefined {
    return this.painData.reportImages().get(zoneId);
  }

  saveImportedToProject(): void {
    const name = window.prompt('Nom du nouveau projet :', 'Rapport importé');
    if (!name) return;
    this.projectService.createProject(name.trim() || 'Rapport importé');
    if (this.importedComment) {
      this.onCommentChange(this.importedComment);
    }
    this.painData.save();
    this.isImportedReport.set(false);
    this.importedComment = null;
  }

  dismissImportBanner(): void {
    this.isImportedReport.set(false);
    this.importedComment = null;
  }

  back(): void {
    this.router.navigate(['/']);
  }

  print(): void {
    window.print();
  }

  exportToFile(): void {
    const data = JSON.stringify({
      zones: this.zones(),
      comment: this.comment(),
      exportedAt: new Date().toISOString(),
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doloris-${Date.now()}.doloris`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (Array.isArray(json.zones)) {
          this.importedComment = json.comment ?? null;
          this.painData.loadImportedZones(json.zones);
          if (typeof json.comment === 'string') {
            this.onCommentChange(json.comment);
          }
          this.showViewer.set(true);
          this.isImportedReport.set(true);
        }
      } catch {
        /* fichier invalide, ignoré */
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
}
