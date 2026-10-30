import { create } from 'zustand';
import {
  ALL_CONCEPTUAL_DIAGRAM_ID,
  ALL_LOGICAL_DIAGRAM_ID,
  type ModelLevel,
  type ModelProject,
} from '@barker-modeler/model-core';

/** Tabs across the canvas. Physical and DDL are derived from the logical model. */
export type WorkLevel = 'conceptual' | 'logical' | 'physical' | 'ddl';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;

interface WorkspaceState {
  root: string | null;
  project: ModelProject | null;
  /** Folder contents as last written/read — the baseline for incremental saves. */
  savedFiles: Record<string, string>;
  saveState: 'saved' | 'pending' | 'saving' | 'error';
  saveError?: string;

  past: ModelProject[];
  future: ModelProject[];
  lastCommit?: { key: string; at: number };

  level: WorkLevel;
  activeDiagram: Record<ModelLevel, string>;
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;

  open: (root: string, project: ModelProject, savedFiles: Record<string, string>) => void;
  close: () => void;
  /** Replace the project. `coalesce` merges rapid edits of the same field into one undo step. */
  commit: (next: ModelProject | ((p: ModelProject) => ModelProject), opts?: { history?: boolean; coalesce?: string }) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => void;
  markSaved: (files: Record<string, string>) => void;
  markSaveError: (message: string) => void;

  setLevel: (level: WorkLevel) => void;
  setActiveDiagram: (id: string) => void;
  selectEntity: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;
}

const initialView = {
  level: 'logical' as WorkLevel,
  activeDiagram: { conceptual: ALL_CONCEPTUAL_DIAGRAM_ID, logical: ALL_LOGICAL_DIAGRAM_ID } as Record<ModelLevel, string>,
  selectedEntityId: null,
  selectedRelationshipId: null,
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  root: null,
  project: null,
  savedFiles: {},
  saveState: 'saved',
  past: [],
  future: [],
  ...initialView,

  open: (root, project, savedFiles) =>
    set({ root, project, savedFiles, saveState: 'saved', saveError: undefined, past: [], future: [], lastCommit: undefined, ...initialView }),

  close: () => set({ root: null, project: null, savedFiles: {}, past: [], future: [], ...initialView }),

  commit: (next, opts = {}) => {
    const { project, past, lastCommit } = get();
    if (!project) return;
    const value = typeof next === 'function' ? next(project) : next;
    if (value === project) return;
    const now = Date.now();
    const merge = opts.coalesce && lastCommit?.key === opts.coalesce && now - lastCommit.at < COALESCE_MS;
    const history = opts.history === false || merge ? past : [...past, project].slice(-HISTORY_LIMIT);
    set({
      project: value,
      past: history,
      future: opts.history === false ? get().future : [],
      saveState: 'pending',
      lastCommit: opts.coalesce ? { key: opts.coalesce, at: now } : undefined,
    });
  },

  undo: () => {
    const { project, past, future } = get();
    if (!project || !past.length) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], saveState: 'pending', lastCommit: undefined });
  },

  redo: () => {
    const { project, past, future } = get();
    if (!project || !future.length) return;
    set({ project: future[0], past: [...past, project], future: future.slice(1), saveState: 'pending', lastCommit: undefined });
  },

  markSaving: () => set({ saveState: 'saving' }),
  markSaved: (files) => set((s) => ({ savedFiles: files, saveState: s.saveState === 'saving' ? 'saved' : s.saveState, saveError: undefined })),
  markSaveError: (message) => set({ saveState: 'error', saveError: message }),

  setLevel: (level) => set({ level, selectedRelationshipId: null }),
  setActiveDiagram: (id) => {
    const d = get().project?.diagrams.find((x) => x.id === id);
    if (!d) return;
    const level = get().level;
    const nextLevel: WorkLevel = d.level === 'conceptual' ? 'conceptual' : level === 'physical' ? 'physical' : 'logical';
    set({ activeDiagram: { ...get().activeDiagram, [d.level]: id }, level: nextLevel, selectedRelationshipId: null });
  },
  selectEntity: (id) => set({ selectedEntityId: id, selectedRelationshipId: null }),
  selectRelationship: (id) => set({ selectedRelationshipId: id, selectedEntityId: null }),
}));
