import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';

import { BodyViewerComponent } from '../body-viewer/body-viewer.component';
import { ZonePanelComponent } from '../zone-panel/zone-panel.component';
import { PainDataService } from '../../services/pain-data.service';

@Component({
  selector: 'app-mapper',
  imports: [BodyViewerComponent, ZonePanelComponent],
  templateUrl: './mapper.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mapper.component.scss',
})
export class MapperComponent {
  readonly painData = inject(PainDataService);
  private readonly router = inject(Router);

  openAbout(): void {
    this.router.navigate(['/about']);
  }

  openReport(): void {
    const zones = this.painData.zones();
    if (!zones.length) return;
    const images = new Map<string, string>();
    const capture = this.painData.captureZone();
    if (capture) {
      for (const zone of zones) {
        const img = capture(zone.meshName, zone.points);
        if (img) images.set(zone.id, img);
      }
    }
    this.painData.reportImages.set(images);
    this.router.navigate(['/report']);
  }
}
