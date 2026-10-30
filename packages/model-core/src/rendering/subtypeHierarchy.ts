import type { Entity, LogicalModel } from '../types.js';

/**
 * One subtype set (category) owned by a supertype.
 * In Barker notation the set is drawn as a compartment inside the supertype box,
 * labelled with its discriminator, and holds the subtype boxes.
 */
export interface SubtypeCategory {
  /** Stable key: `${supertype}::${label}` */
  key: string;
  supertype: string;
  /** Display label (discriminator attribute name, or set name). */
  label: string;
  discriminator?: string;
  disjoint: boolean;
  total: boolean;
  /** Ordered subtype entity names. */
  subtypes: string[];
}

export interface SubtypeHierarchy {
  /** supertype name -> its subtype categories (in declaration order) */
  categoriesOf: Map<string, SubtypeCategory[]>;
  /** subtype name -> owning supertype name */
  parentOf: Map<string, string>;
  /** Entities that are not nested inside any supertype (diagram roots). */
  roots: string[];
  /** Walk up to the outermost supertype containing `name` (itself if root). */
  rootOf(name: string): string;
  /** Ancestor chain, nearest first (excludes the entity itself). */
  ancestorsOf(name: string): string[];
}

const subtypeName = (s: unknown): string =>
  typeof s === 'string' ? s : (s as { name?: string } | null)?.name || '';

/**
 * Normalises the three ways a model can express subtyping into one tree:
 *   1. model.subtype_sets[]            (supertype + subtypes)
 *   2. entity.subtype_sets[]           (embedded on the supertype)
 *   3. entity.supertype                (declared on the subtype)
 *
 * Sources are merged, de-duplicated, and cycles/unknown entities are dropped,
 * so the renderer never has to special-case where the information came from.
 */
export function buildSubtypeHierarchy(model: Pick<LogicalModel, 'entities' | 'subtype_sets'>): SubtypeHierarchy {
  const entityByName = new Map<string, Entity>();
  model.entities.forEach((e) => entityByName.set(e.name, e));

  const categoriesOf = new Map<string, SubtypeCategory[]>();
  const parentOf = new Map<string, string>();

  const ensureCategory = (
    supertype: string,
    label: string,
    meta: { discriminator?: string; disjoint?: boolean; total?: boolean }
  ): SubtypeCategory => {
    const list = categoriesOf.get(supertype) || [];
    let cat = list.find((c) => c.label === label);
    if (!cat) {
      cat = {
        key: `${supertype}::${label}`,
        supertype,
        label,
        discriminator: meta.discriminator,
        disjoint: meta.disjoint ?? true,
        total: meta.total ?? true,
        subtypes: [],
      };
      list.push(cat);
      categoriesOf.set(supertype, list);
    }
    return cat;
  };

  // Would linking child under parent create a cycle?
  const createsCycle = (parent: string, child: string): boolean => {
    let cur: string | undefined = parent;
    let guard = 0;
    while (cur && guard++ < 1000) {
      if (cur === child) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };

  const link = (cat: SubtypeCategory, child: string) => {
    if (!child || child === cat.supertype || !entityByName.has(child)) return;
    if (parentOf.has(child)) return; // first declaration wins
    if (createsCycle(cat.supertype, child)) return;
    parentOf.set(child, cat.supertype);
    cat.subtypes.push(child);
  };

  const labelFor = (supertype: string, set: { name?: string; discriminator?: string }) =>
    set.discriminator || set.name || entityByName.get(supertype)?.discriminator || '구분';

  // 1 + 2: explicit sets (model level first, then entity embedded)
  (model.subtype_sets || []).forEach((set) => {
    if (!entityByName.has(set.supertype)) return;
    const cat = ensureCategory(set.supertype, labelFor(set.supertype, set), set);
    (set.subtypes || []).forEach((s) => link(cat, subtypeName(s)));
  });
  model.entities.forEach((ent) => {
    (ent.subtype_sets || []).forEach((set) => {
      const cat = ensureCategory(ent.name, labelFor(ent.name, set), set);
      (set.subtypes || []).forEach((s) => link(cat, subtypeName(s)));
    });
  });

  // 3: implicit (entity.supertype) — goes into the supertype's first category,
  // or a new one named after its discriminator.
  model.entities.forEach((ent) => {
    if (!ent.supertype || parentOf.has(ent.name) || !entityByName.has(ent.supertype)) return;
    const existing = categoriesOf.get(ent.supertype)?.[0];
    const cat = existing || ensureCategory(ent.supertype, labelFor(ent.supertype, {}), {});
    link(cat, ent.name);
  });

  // Drop empty categories
  categoriesOf.forEach((list, key) => {
    const kept = list.filter((c) => c.subtypes.length > 0);
    if (kept.length) categoriesOf.set(key, kept);
    else categoriesOf.delete(key);
  });

  const roots = model.entities.map((e) => e.name).filter((n) => !parentOf.has(n));

  const ancestorsOf = (name: string): string[] => {
    const out: string[] = [];
    let cur = parentOf.get(name);
    while (cur && out.length < 1000) {
      out.push(cur);
      cur = parentOf.get(cur);
    }
    return out;
  };

  const rootOf = (name: string): string => {
    const anc = ancestorsOf(name);
    return anc.length ? anc[anc.length - 1] : name;
  };

  return { categoriesOf, parentOf, roots, rootOf, ancestorsOf };
}
