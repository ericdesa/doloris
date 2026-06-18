import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { PainDataService } from '../../services/pain-data.service';
import { PAIN_CHARACTERISTICS, PAIN_TYPES, getPainType, PainTypeId } from '../../models/pain-types';
import { PainZone } from '../../models/pain-zone.model';

@Component({
  selector: 'app-zone-panel',
  imports: [],
  templateUrl: './zone-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './zone-panel.component.scss',
})
export class ZonePanelComponent {
  readonly painData = inject(PainDataService);

  readonly zonesNewestFirst = computed(() => [...this.painData.zones()].reverse());

  readonly painTypes = PAIN_TYPES;
  readonly characteristics = PAIN_CHARACTERISTICS;
  readonly getPainType = getPainType;
  readonly typeDropdownOpen = signal(false);

  selectZone(zone: PainZone): void {
    if (this.painData.selectedZoneId() === zone.id) {
      this.painData.selectZone(null);
    } else {
      this.painData.selectZone(zone.id);
      this.painData.focusRequest.set(zone.id);
    }
  }

  closeDetail(): void {
    this.painData.selectZone(null);
  }

  selectZoneType(zone: PainZone, typeId: PainTypeId): void {
    this.painData.updateZone(zone.id, { type: typeId });
    this.painData.updateDraft({ type: typeId });
    this.typeDropdownOpen.set(false);
  }

  onIntensityChange(event: Event, zone: PainZone): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.painData.updateZone(zone.id, { intensity: value });
    this.painData.updateDraft({ intensity: value });
  }

  onNotesChange(event: Event, zone: PainZone): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.painData.updateZone(zone.id, { notes: value });
  }

  toggleCharacteristic(zone: PainZone, characteristic: string): void {
    const has = zone.characteristics.includes(characteristic);
    const next = has ? zone.characteristics.filter((c) => c !== characteristic) : [...zone.characteristics, characteristic];
    this.painData.updateZone(zone.id, { characteristics: next });
  }

  deleteZone(zone: PainZone): void {
    const confirmed = window.confirm('Supprimer cette zone de douleur ?');
    if (confirmed) {
      this.painData.removeZone(zone.id);
    }
  }

  clearAll(): void {
    if (window.confirm('Effacer toutes les zones de douleur enregistrées ?')) {
      this.painData.clearAll();
    }
  }
}
