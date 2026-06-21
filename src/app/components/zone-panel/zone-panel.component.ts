import { Component, ElementRef, inject, computed, signal, viewChildren, effect, ChangeDetectionStrategy } from '@angular/core';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { PainDataService } from '../../services/pain-data.service';
import { PAIN_CHARACTERISTICS, PAIN_TYPES, getPainType, PainTypeId } from '../../models/pain-types';
import { PainZone } from '../../models/pain-zone.model';

@Component({
  selector: 'app-zone-panel',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './zone-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './zone-panel.component.scss',
})
export class ZonePanelComponent {
  readonly painData = inject(PainDataService);

  readonly zonesNewestFirst = computed(() => [...this.painData.zones()].reverse());

  private readonly zoneItems = viewChildren<ElementRef<HTMLElement>>('zoneItem');

  readonly painTypes = PAIN_TYPES;
  readonly characteristics = PAIN_CHARACTERISTICS;
  readonly getPainType = getPainType;
  readonly typeDropdownOpen = signal(false);

  readonly mergingFromZoneId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const selectedId = this.painData.selectedZoneId();
      if (!selectedId) return;
      setTimeout(() => {
        for (const item of this.zoneItems()) {
          if (item.nativeElement.classList.contains('zone-list__item--active')) {
            item.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            break;
          }
        }
      });
    });
  }

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
    this.painData.updateZone(zone.id, { type: typeId }, true);
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

  onLabelChange(event: Event, zone: PainZone): void {
    const value = (event.target as HTMLInputElement).value;
    this.painData.updateZone(zone.id, { bodyPartLabel: value });
  }

  toggleCharacteristic(zone: PainZone, characteristic: string): void {
    const has = zone.characteristics.includes(characteristic);
    const next = has ? zone.characteristics.filter((c) => c !== characteristic) : [...zone.characteristics, characteristic];
    this.painData.updateZone(zone.id, { characteristics: next });
  }

  startMerge(zone: PainZone): void {
    this.mergingFromZoneId.set(zone.id);
    this.painData.selectZone(null);
  }

  cancelMerge(): void {
    this.mergingFromZoneId.set(null);
  }

  confirmMerge(targetZone: PainZone): void {
    const sourceId = this.mergingFromZoneId();
    if (!sourceId) return;
    const sourceZone = this.painData.zones().find((z) => z.id === sourceId);
    const sourceLabel = sourceZone?.bodyPartLabel ?? 'cette zone';
    if (
      !window.confirm(
        `Fusionner « ${sourceLabel} » dans « ${targetZone.bodyPartLabel} » ?\nLes tracés des deux zones seront combinés.`,
      )
    )
      return;
    this.painData.mergeZones(sourceId, targetZone.id);
    this.mergingFromZoneId.set(null);
  }

  onDrop(event: CdkDragDrop<PainZone[]>): void {
    this.painData.reorderZones(event.previousIndex, event.currentIndex);
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
