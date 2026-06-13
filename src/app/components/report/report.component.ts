import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PainDataService } from '../../services/pain-data.service';
import { getPainType } from '../../models/pain-types';

@Component({
  selector: 'app-report',
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
