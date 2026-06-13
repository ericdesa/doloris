import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { PainDataService } from '../../services/pain-data.service';
import { PAIN_CHARACTERISTICS, PAIN_TYPES } from '../../models/pain-types';

@Component({
    selector: 'app-tool-panel',
    imports: [],
    templateUrl: './tool-panel.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './tool-panel.component.scss'
})
export class ToolPanelComponent {
  readonly painData = inject(PainDataService);

  readonly painTypes = PAIN_TYPES;
  readonly characteristics = PAIN_CHARACTERISTICS;

  onIntensityChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.painData.updateDraft({ intensity: value });
  }

  onBrushSizeChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.painData.updateDraft({ brushRadius: value });
  }

  onNotesChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.painData.updateDraft({ notes: value });
  }

  clearAll(): void {
    if (this.painData.zoneCount() === 0) return;
    const confirmed = window.confirm('Effacer toutes les zones de douleur enregistrées ?');
    if (confirmed) {
      this.painData.clearAll();
    }
  }
}
