import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  ElementRef,
  HostListener,
} from '@angular/core';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-project-switcher',
  templateUrl: './project-switcher.component.html',
  styleUrl: './project-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSwitcherComponent {
  readonly projectService = inject(ProjectService);
  private readonly el = inject(ElementRef);

  readonly isOpen = signal(false);
  readonly renamingId = signal<string | null>(null);
  readonly renameValue = signal('');
  readonly isCreating = signal(false);
  readonly newName = signal('');

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
    if (!this.isOpen()) this.resetEditing();
  }

  close(): void {
    this.isOpen.set(false);
    this.resetEditing();
  }

  switchTo(id: string): void {
    this.projectService.switchProject(id);
    this.close();
  }

  startRename(id: string, currentName: string, event: Event): void {
    event.stopPropagation();
    this.renamingId.set(id);
    this.renameValue.set(currentName);
  }

  confirmRename(): void {
    const id = this.renamingId();
    if (id) {
      this.projectService.renameProject(id, this.renameValue());
    }
    this.renamingId.set(null);
  }

  onRenameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.confirmRename();
    if (event.key === 'Escape') this.renamingId.set(null);
  }

  deleteProject(id: string, event: Event): void {
    event.stopPropagation();
    const project = this.projectService.projects().find((p) => p.id === id);
    if (!project) return;
    if (!window.confirm(`Supprimer le projet "${project.name}" ?`)) return;
    this.projectService.deleteProject(id);
  }

  startCreate(event: Event): void {
    event.stopPropagation();
    this.isCreating.set(true);
    this.newName.set('');
  }

  confirmCreate(): void {
    const name = this.newName().trim();
    if (name) this.projectService.createProject(name);
    this.isCreating.set(false);
    this.close();
  }

  onCreateKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.confirmCreate();
    if (event.key === 'Escape') this.isCreating.set(false);
  }

  private resetEditing(): void {
    this.renamingId.set(null);
    this.isCreating.set(false);
  }
}
