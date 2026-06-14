import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PainDataService } from '../../services/pain-data.service';
import { getPainType } from '../../models/pain-types';

const COMMENT_KEY = 'pain-mapper:report-comment';

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

  readonly comment = signal<string>(localStorage.getItem(COMMENT_KEY) ?? '');

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
