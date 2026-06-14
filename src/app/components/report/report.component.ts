import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';

import { PainDataService } from '../../services/pain-data.service';
import { getPainType } from '../../models/pain-types';
import { BodyViewerComponent } from '../body-viewer/body-viewer.component';

const COMMENT_KEY = 'pain-mapper:report-comment';

@Component({
  selector: 'app-report',
  imports: [BodyViewerComponent],
  templateUrl: './report.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './report.component.scss',
})
export class ReportComponent {
  readonly painData = inject(PainDataService);
  private readonly router = inject(Router);

  readonly zones = this.painData.zones;
  readonly today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  readonly getPainType = getPainType;

  readonly comment = signal<string>(localStorage.getItem(COMMENT_KEY) ?? '');

  readonly showViewer = signal(false);

  constructor() {
    if (this.painData.reportImages().size === 0 && this.painData.zones().length > 0) {
      this.showViewer.set(true);
    }

    effect(() => {
      const capture = this.painData.captureZone();
      if (!capture || !this.showViewer()) return;
      const images = new Map<string, string>();
      for (const zone of this.painData.zones()) {
        const img = capture(zone.meshName, zone.points);
        if (img) images.set(zone.id, img);
      }
      this.painData.reportImages.set(images);
      this.showViewer.set(false);
    });
  }

  onCommentChange(value: string): void {
    this.comment.set(value);
    localStorage.setItem(COMMENT_KEY, value);
  }

  getImage(zoneId: string): string | undefined {
    return this.painData.reportImages().get(zoneId);
  }

  back(): void {
    this.router.navigate(['/']);
  }

  print(): void {
    window.print();
  }
}
