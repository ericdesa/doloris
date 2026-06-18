import { Injectable, computed, effect, signal } from '@angular/core';
import { Project } from '../models/project.model';

const PROJECTS_KEY = 'doloris-projects';
const ACTIVE_KEY = 'doloris-active-project';
const LEGACY_DATA_KEY = 'doloris-data';

function generateId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  readonly projects = signal<Project[]>([]);
  readonly currentProjectId = signal<string>('');

  readonly currentProject = computed(() => this.projects().find((p) => p.id === this.currentProjectId()) ?? null);

  constructor() {
    this.migrateIfNeeded();
    this.init();
    effect(() => this.persistProjects(this.projects()));
  }

  switchProject(id: string): void {
    if (!this.projects().some((p) => p.id === id)) return;
    this.currentProjectId.set(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  createProject(name: string): void {
    const trimmed = name.trim() || 'Nouveau projet';
    const ts = now();
    const project: Project = { id: generateId(), name: trimmed, createdAt: ts, updatedAt: ts };
    this.projects.update((list) => [...list, project]);
    this.switchProject(project.id);
  }

  renameProject(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.projects.update((list) => list.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: now() } : p)));
  }

  deleteProject(id: string): void {
    const list = this.projects();
    if (list.length <= 1) {
      // Créer un projet de remplacement avant de supprimer
      this.createProject('Nouveau projet');
    }
    if (this.currentProjectId() === id) {
      const remaining = this.projects().filter((p) => p.id !== id);
      this.switchProject(remaining[0].id);
    }
    this.projects.update((list) => list.filter((p) => p.id !== id));
    localStorage.removeItem(`${LEGACY_DATA_KEY}:${id}`);
    localStorage.removeItem(`pain-mapper:report-comment:${id}`);
  }

  // ---------------------------------------------------------------------------
  // Initialisation interne
  // ---------------------------------------------------------------------------

  private migrateIfNeeded(): void {
    const hasProjects = localStorage.getItem(PROJECTS_KEY) !== null;
    const legacyData = localStorage.getItem(LEGACY_DATA_KEY);
    if (hasProjects || !legacyData) return;

    const ts = now();
    const project: Project = {
      id: generateId(),
      name: 'Patient par défaut',
      createdAt: ts,
      updatedAt: ts,
    };
    localStorage.setItem(`${LEGACY_DATA_KEY}:${project.id}`, legacyData);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([project]));
    localStorage.setItem(ACTIVE_KEY, project.id);
    // On conserve la clé legacy pour permettre un retour arrière.
  }

  private init(): void {
    const raw = localStorage.getItem(PROJECTS_KEY);
    let list: Project[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw) as Project[];
      } catch {
        list = [];
      }
    }

    if (!list.length) {
      const ts = now();
      const project: Project = { id: generateId(), name: 'Nouveau projet', createdAt: ts, updatedAt: ts };
      list = [project];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      localStorage.setItem(ACTIVE_KEY, project.id);
    }

    this.projects.set(list);

    const savedId = localStorage.getItem(ACTIVE_KEY) ?? '';
    const validId = list.some((p) => p.id === savedId) ? savedId : list[0].id;
    this.currentProjectId.set(validId);
    if (validId !== savedId) {
      localStorage.setItem(ACTIVE_KEY, validId);
    }
  }

  private persistProjects(list: Project[]): void {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    } catch {
      // stockage indisponible ou plein
    }
  }
}
