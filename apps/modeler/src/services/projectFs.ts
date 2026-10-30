/**
 * Project folder access.
 *
 * Desktop (Tauri): real folders through the Rust commands in src-tauri/src/project_fs.rs.
 * Browser (vite dev only): an in-browser stand-in so the UI can be developed and tested
 * without the desktop shell. It is clearly labelled and never used in the desktop app.
 */
import { invoke } from '@tauri-apps/api/core';

export type FolderState = 'missing' | 'empty' | 'project' | 'other';

export interface ProjectFs {
  readonly isDesktop: boolean;
  pickFolder(title: string): Promise<string | null>;
  inspect(path: string): Promise<FolderState>;
  read(root: string): Promise<Record<string, string>>;
  write(root: string, writes: Record<string, string>, deletes: string[]): Promise<void>;
  join(...parts: string[]): string;
}

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const joinPath = (sep: string) => (...parts: string[]) =>
  parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/[\\/]+$/, '') : p.replace(/^[\\/]+|[\\/]+$/g, '')))
    .join(sep);

const desktopFs: ProjectFs = {
  isDesktop: true,
  pickFolder: (title) => invoke<string | null>('pick_folder', { title }),
  inspect: (path) => invoke<FolderState>('inspect_folder', { path }),
  read: (root) => invoke<Record<string, string>>('read_project_files', { root }),
  write: (root, writes, deletes) => invoke<void>('write_project_files', { root, writes, deletes }),
  join: (...parts) => joinPath(parts[0]?.includes('\\') ? '\\' : '/')(...parts),
};

/* ---------------------- browser stand-in (dev only) ---------------------- */

const KEY = (root: string) => `minsfs:${root}`;
const load = (root: string): Record<string, string> | null => {
  try {
    const raw = localStorage.getItem(KEY(root));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const browserFs: ProjectFs = {
  isDesktop: false,
  async pickFolder(title) {
    return window.prompt(`[브라우저 개발 모드] ${title}\n가상 폴더 경로를 입력하세요`, '/projects') || null;
  },
  async inspect(path) {
    const files = load(path);
    if (files) return files['minsmodeler.yaml'] ? 'project' : Object.keys(files).length ? 'other' : 'empty';
    const childPrefix = KEY(path.replace(/\/+$/, '') + '/');
    const hasChildren = Object.keys(localStorage).some((k) => k.startsWith(childPrefix));
    return hasChildren ? 'other' : 'missing';
  },
  async read(root) {
    const files = load(root);
    if (!files) throw new Error(`폴더를 찾을 수 없습니다: ${root}`);
    return files;
  },
  async write(root, writes, deletes) {
    const files = { ...(load(root) || {}), ...writes };
    deletes.forEach((d) => delete files[d]);
    localStorage.setItem(KEY(root), JSON.stringify(files));
  },
  join: joinPath('/'),
};

export const projectFs: ProjectFs = isTauri() ? desktopFs : browserFs;

/* ----------------------------- recent projects ---------------------------- */

export interface RecentProject {
  name: string;
  root: string;
  openedAt: number;
}

const RECENT_KEY = 'mins_recent_projects';

export function getRecentProjects(): RecentProject[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberRecentProject(name: string, root: string) {
  try {
    const list = [{ name, root, openedAt: Date.now() }, ...getRecentProjects().filter((r) => r.root !== root)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* non-essential */
  }
}

export function forgetRecentProject(root: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentProjects().filter((r) => r.root !== root)));
  } catch {
    /* non-essential */
  }
}

/* ------------------- legacy (pre-folder) localStorage data ------------------ */

/** Projects saved by earlier versions in localStorage (key `mins_db_modeler_projects`). */
export function getLegacyProjects(): { id: string; name: string; files: { name: string; content: string; layout?: any }[] }[] {
  try {
    const list = JSON.parse(localStorage.getItem('mins_db_modeler_projects') || '[]');
    return Array.isArray(list) ? list.filter((p) => p && Array.isArray(p.files)) : [];
  } catch {
    return [];
  }
}
