import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { ImportService } from './services/import.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    @if (isDragging()) {
      <div class="drop-overlay">
        <div class="drop-overlay__content">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Déposez votre fichier .doloris pour l'importer</p>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .drop-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.2);
      }

      .drop-overlay__content {
        font-weight: 600;
        text-align: center;
        color: #2e3d45;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid var(--color-border);
        border-radius: 15px;
        padding: 30px;
        box-shadow: var(--shadow-sm);
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
      }

      .drop-overlay__content p {
        margin: 16px 0 0;
        font-size: 1.1rem;
      }
      .drop-overlay__content svg {
        color: ##2e3d45;
      }
    `,
  ],
  host: {
    '(document:dragenter)': 'onDragEnter($event)',
    '(document:dragover)': 'onDragOver($event)',
    '(document:dragleave)': 'onDragLeave($event)',
    '(document:drop)': 'onDrop($event)',
  },
})
export class AppComponent {
  private readonly importService = inject(ImportService);
  private readonly router = inject(Router);

  readonly isDragging = signal(false);
  private dragCounter = 0;

  onDragEnter(event: DragEvent): void {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    this.dragCounter++;
    if (this.dragCounter === 1) {
      this.isDragging.set(true);
    }
  }

  onDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
    }
  }

  onDragLeave(event: DragEvent): void {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.isDragging.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    const file = event.dataTransfer?.files?.[0];
    if (!file || (!file.name.endsWith('.doloris') && !file.name.endsWith('.json'))) return;
    event.preventDefault();

    this.dragCounter = 0;
    this.isDragging.set(false);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (Array.isArray(json.zones)) {
          this.importService.setPending(json.zones, json.comment);
          this.router.navigate(['/report']);
        }
      } catch {
        /* fichier invalide, ignoré */
      }
    };
    reader.readAsText(file);
  }
}
