import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';

import { PainDataService } from '../../services/pain-data.service';
import { ShareService } from '../../services/share.service';
import { ProjectService } from '../../services/project.service';
import { getPainType } from '../../models/pain-types';
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
  private readonly share = inject(ShareService);
  private readonly projectService = inject(ProjectService);

  private readonly commentKey = computed(() => `pain-mapper:report-comment:${this.projectService.currentProjectId()}`);

  readonly zones = this.painData.zones;
  readonly today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  readonly getPainType = getPainType;

  readonly comment = signal<string>('');

  readonly showViewer = signal(false);
  readonly overviewImages = this.painData.overviewImages;

  readonly copied = signal(false);
  readonly shareUrl = computed(() => (this.zones().length > 0 ? this.share.getShareUrl(this.zones()) : null));
  readonly isSharedReport = signal(false);

  constructor() {
    effect(() => {
      const key = this.commentKey();
      this.comment.set(localStorage.getItem(key) ?? '');
    });

    const shared = this.share.extractFromFragment();
    if (shared) {
      this.isSharedReport.set(true);
      this.painData.loadSharedZones(shared);
      this.share.clearFragment();
    }

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

  saveSharedToProject(): void {
    this.painData.save();
    this.isSharedReport.set(false);
  }

  dismissSharedBanner(): void {
    this.isSharedReport.set(false);
  }

  back(): void {
    this.router.navigate(['/']);
  }

  print(): void {
    window.print();
  }

  async copyShareLink(): Promise<void> {
    const url = this.share.getShareUrl(this.zones());
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
