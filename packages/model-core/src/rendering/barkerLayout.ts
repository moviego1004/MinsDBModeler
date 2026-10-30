import type { Attribute, Entity, LogicalModel } from '../types.js';
import { buildSubtypeHierarchy, type SubtypeHierarchy } from './subtypeHierarchy.js';

/* ------------------------------------------------------------------------- *
 * Barker layout engine
 *
 * Turns a LogicalModel into a tree of positioned shapes that a renderer can
 * draw without making any decisions of its own:
 *
 *   EntityShape (box | pill)
 *     ├─ header + attribute rows
 *     └─ CategoryShape[]            (subtype set compartment, labelled by discriminator)
 *          └─ EntityShape[]         (subtypes — same type, so nesting is unbounded)
 *
 * The algorithm is a classic two-pass box layout:
 *   1. measure  (bottom-up)  — every shape's size is derived from its text and
 *                              the measured size of its children
 *   2. arrange  (top-down)   — children are placed with a wrapping flow inside
 *                              their category, categories stack inside the box
 * Roots are then placed with a layered (Sugiyama-style) pass over the
 * relationship graph, unless the caller supplies saved positions.
 *
 * There is no per-entity or per-depth special casing: a 1-level and a 5-level
 * hierarchy go through exactly the same code path.
 * ------------------------------------------------------------------------- */

export type AttributeMarker = '#' | '*' | 'o';

/**
 * Compartment caption: the discriminator, plus a note when the set departs from the
 * Barker default (exclusive + complete): "포괄" = an instance may be in several
 * subtypes, "부분" = some instances are in none.
 */
export function categoryCaption(cat: { label: string; disjoint: boolean; total: boolean }): string {
  const notes = [cat.disjoint ? '' : '포괄', cat.total ? '' : '부분'].filter(Boolean);
  return notes.length ? `${cat.label} (${notes.join('·')})` : cat.label;
}

export interface AttributeRow {
  name: string;
  marker: AttributeMarker;
  isPk: boolean;
  isFk: boolean;
  domain?: string;
  /** y offset relative to the owning shape's top */
  y: number;
}

export interface EntityShape {
  kind: 'box' | 'pill';
  entity: string;
  label: string;
  /** Absolute canvas coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Minimum size the content needs (resize can only grow beyond this). */
  minWidth: number;
  minHeight: number;
  headerHeight: number;
  rows: AttributeRow[];
  categories: CategoryShape[];
  depth: number;
  parent?: string;
  isSupertype: boolean;
  isSubtype: boolean;
  /** Independent entity: no FK participates in its identifier (DA# draws these tinted). */
  independent: boolean;
}

export interface CategoryShape {
  key: string;
  label: string;
  supertype: string;
  disjoint: boolean;
  total: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  labelHeight: number;
  children: EntityShape[];
}

export interface BarkerLayoutStyle {
  fontSize: number;
  headerFontSize: number;
  rowHeight: number;
  headerHeight: number;
  paddingX: number;
  bodyPaddingBottom: number;
  markerWidth: number;
  minEntityWidth: number;
  /** Minimum height of a root entity box (subtype boxes hug their content). */
  minRootHeight: number;
  pillHeight: number;
  pillPaddingX: number;
  /** Padding between a supertype's border and its categories. */
  innerPadding: number;
  categoryPadding: number;
  categoryLabelHeight: number;
  categoryGap: number;
  childGap: number;
  /** Gaps used by automatic root placement. */
  rankGapX: number;
  rankGapY: number;
}

export const DEFAULT_BARKER_STYLE: BarkerLayoutStyle = {
  fontSize: 11,
  headerFontSize: 12,
  rowHeight: 17,
  headerHeight: 24,
  paddingX: 8,
  bodyPaddingBottom: 8,
  markerWidth: 14,
  minEntityWidth: 110,
  minRootHeight: 64,
  pillHeight: 20,
  pillPaddingX: 9,
  innerPadding: 8,
  categoryPadding: 6,
  categoryLabelHeight: 16,
  categoryGap: 8,
  childGap: 8,
  rankGapX: 70,
  rankGapY: 80,
};

export type TextMeasurer = (text: string, fontSize: number, bold?: boolean) => number;

/** Font-independent approximation; the browser passes a canvas-based measurer instead. */
export const approximateTextWidth: TextMeasurer = (text, fontSize, bold) => {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) || 0;
    if (c >= 0x1100) w += 1.0; // Hangul / CJK full width
    else if (ch === ' ') w += 0.3;
    else if (/[A-Z0-9#*]/.test(ch)) w += 0.64;
    else w += 0.55;
  }
  return w * fontSize * (bold ? 1.06 : 1);
};

export interface SavedShapePosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface BarkerLayoutOptions {
  style?: Partial<BarkerLayoutStyle>;
  measureText?: TextMeasurer;
  /** Saved positions for root shapes, keyed by entity name. */
  positions?: Record<string, SavedShapePosition | undefined>;
  /** Display label (e.g. physical table name). Identity always stays entity.name. */
  labelOf?: (entity: Entity) => string;
  /** Display attributes (e.g. physical columns). */
  attributesOf?: (entity: Entity) => Attribute[];
  showDomains?: boolean;
  origin?: { x: number; y: number };
}

export interface BarkerDiagramLayout {
  roots: EntityShape[];
  /** Every shape, nested or not, by entity name. */
  shapes: Map<string, EntityShape>;
  categories: CategoryShape[];
  hierarchy: SubtypeHierarchy;
  bounds: { x: number; y: number; width: number; height: number };
  style: BarkerLayoutStyle;
}

interface Size {
  width: number;
  height: number;
}

/** Wrapping left-to-right flow. Returns child offsets and the occupied size. */
function flow(sizes: Size[], wrapWidth: number, gap: number) {
  const offsets: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let maxW = 0;
  sizes.forEach((s) => {
    if (x > 0 && x + s.width > wrapWidth) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    offsets.push({ x, y });
    x += s.width + gap;
    rowH = Math.max(rowH, s.height);
    maxW = Math.max(maxW, x - gap);
  });
  return { offsets, width: maxW, height: sizes.length ? y + rowH : 0 };
}

export function layoutBarkerDiagram(
  model: Pick<LogicalModel, 'entities' | 'relationships' | 'subtype_sets'>,
  options: BarkerLayoutOptions = {}
): BarkerDiagramLayout {
  const style: BarkerLayoutStyle = { ...DEFAULT_BARKER_STYLE, ...(options.style || {}) };
  const measure = options.measureText || approximateTextWidth;
  const labelOf = options.labelOf || ((e: Entity) => e.name);
  const attributesOf = options.attributesOf || ((e: Entity) => e.attributes || []);
  const positions = options.positions || {};
  const origin = options.origin || { x: 40, y: 40 };

  const hierarchy = buildSubtypeHierarchy(model);
  const entityByName = new Map<string, Entity>();
  model.entities.forEach((e) => entityByName.set(e.name, e));

  /* ---- semantic facts derived once from relationships (no name heuristics) ---- */
  const fkNamesOf = new Map<string, Set<string>>();
  const identifyingChild = new Set<string>();
  (model.relationships || []).forEach((rel) => {
    if (rel.identifying) identifyingChild.add(rel.child);
    if (rel.fk_attributes?.length) {
      const set = fkNamesOf.get(rel.child) || new Set<string>();
      rel.fk_attributes.forEach((a) => set.add(a));
      fkNamesOf.set(rel.child, set);
    }
  });

  const isPkAttr = (a: Attribute) => !!a.identifier || a.keyType === 'PK';
  const isFkAttr = (entity: string, a: Attribute) =>
    !!a.fk || a.keyType === 'FK' || !!fkNamesOf.get(entity)?.has(a.name);

  /* ---------------------------- pass 1: measure ---------------------------- */
  // Local layout tree (coordinates relative to the parent shape).
  interface LocalShape extends Omit<EntityShape, 'categories'> {
    categories: (Omit<CategoryShape, 'children'> & { children: LocalShape[] })[];
  }

  const visiting = new Set<string>();

  const measureEntity = (name: string, depth: number, parent?: string): LocalShape => {
    const ent = entityByName.get(name)!;
    visiting.add(name);

    // Barker: subtypes inherit and do not repeat their ancestors' attributes.
    const inherited = new Set<string>();
    hierarchy.ancestorsOf(name).forEach((anc) => {
      const a = entityByName.get(anc);
      if (a) attributesOf(a).forEach((attr) => inherited.add(attr.name));
    });
    const attrs = attributesOf(ent).filter((a) => !inherited.has(a.name));

    const label = labelOf(ent);
    const isSubtype = hierarchy.parentOf.has(name);
    const cats = hierarchy.categoriesOf.get(name) || [];
    const isSupertype = cats.length > 0;

    const independent =
      !identifyingChild.has(name) && !attrs.some((a) => isPkAttr(a) && isFkAttr(name, a)) && !isSubtype;

    const base = {
      entity: name,
      label,
      x: 0,
      y: 0,
      depth,
      parent,
      isSubtype,
      isSupertype,
      independent,
    };

    // Attribute-less leaf subtypes are drawn as pills (DA# / Barker convention).
    if (isSubtype && !isSupertype && attrs.length === 0) {
      const w = Math.ceil(measure(label, style.fontSize, true) + style.pillPaddingX * 2);
      visiting.delete(name);
      return {
        ...base,
        kind: 'pill',
        width: w,
        height: style.pillHeight,
        minWidth: w,
        minHeight: style.pillHeight,
        headerHeight: style.pillHeight,
        rows: [],
        categories: [],
      };
    }

    const rows: AttributeRow[] = attrs.map((a, i) => {
      const pk = isPkAttr(a);
      return {
        name: a.name,
        marker: pk ? '#' : a.required ? '*' : 'o',
        isPk: pk,
        isFk: isFkAttr(name, a),
        domain: a.domain,
        y: style.headerHeight + i * style.rowHeight,
      };
    });

    const rowWidth = (r: AttributeRow) =>
      style.paddingX * 2 +
      style.markerWidth +
      measure(r.name, style.fontSize) +
      (r.isFk ? measure(' (FK)', style.fontSize) : 0) +
      (options.showDomains && r.domain ? measure(`  ${r.domain}`, style.fontSize - 1) : 0);

    let contentWidth = Math.max(
      style.minEntityWidth,
      measure(label, style.headerFontSize, true) + style.paddingX * 2,
      ...rows.map(rowWidth)
    );
    const attrsHeight = style.headerHeight + rows.length * style.rowHeight + style.bodyPaddingBottom;

    // Measure categories (recursion happens here).
    const measuredCats = cats.map((cat) => {
      const children = cat.subtypes
        .filter((s) => !visiting.has(s) && entityByName.has(s))
        .map((s) => measureEntity(s, depth + 1, name));
      // Compact shapes (pills) first, then boxes: keeps tags together like DA#.
      children.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'pill' ? -1 : 1));
      return { cat, children };
    });

    let width = contentWidth;
    let height = Math.max(attrsHeight, isSubtype ? 0 : style.minRootHeight);

    const placedCats: LocalShape['categories'] = [];
    if (measuredCats.length) {
      // Wrap width: wide enough for the widest child, the parent's own text,
      // and roughly square overall so long sets do not become one huge row.
      const innerMin = contentWidth - style.innerPadding * 2 - style.categoryPadding * 2;
      const catLayouts = measuredCats.map(({ cat, children }) => {
        const sizes = children.map((c) => ({ width: c.width, height: c.height }));
        const widest = Math.max(0, ...sizes.map((s) => s.width));
        const area = sizes.reduce((s, c) => s + (c.width + style.childGap) * (c.height + style.childGap), 0);
        const wrap = Math.max(widest, innerMin, Math.sqrt(area) * 1.5);
        const f = flow(sizes, wrap, style.childGap);
        const labelW = measure(categoryCaption(cat), style.fontSize - 1, true);
        return {
          cat,
          children,
          f,
          width: Math.max(f.width, labelW) + style.categoryPadding * 2,
          height: style.categoryLabelHeight + f.height + style.categoryPadding * 2,
        };
      });

      const catsWidth = Math.max(...catLayouts.map((c) => c.width));
      width = Math.max(contentWidth, catsWidth + style.innerPadding * 2);
      const catWidth = width - style.innerPadding * 2; // categories stretch to the box

      let y = attrsHeight;
      catLayouts.forEach((cl) => {
        const cx = style.innerPadding;
        const cy = y;
        cl.children.forEach((child, i) => {
          child.x = cx + style.categoryPadding + cl.f.offsets[i].x;
          child.y = cy + style.categoryLabelHeight + style.categoryPadding + cl.f.offsets[i].y;
        });
        placedCats.push({
          key: cl.cat.key,
          label: categoryCaption(cl.cat),
          supertype: name,
          disjoint: cl.cat.disjoint,
          total: cl.cat.total,
          x: cx,
          y: cy,
          width: catWidth,
          height: cl.height,
          labelHeight: style.categoryLabelHeight,
          children: cl.children,
        });
        y += cl.height + style.categoryGap;
      });
      height = Math.max(height, y - style.categoryGap + style.innerPadding);
    }

    width = Math.ceil(width);
    height = Math.ceil(height);
    visiting.delete(name);
    return {
      ...base,
      kind: 'box',
      width,
      height,
      minWidth: width,
      minHeight: height,
      headerHeight: style.headerHeight,
      rows,
      categories: placedCats,
    };
  };

  const localRoots = hierarchy.roots.map((r) => measureEntity(r, 0));

  /* ----------------------- pass 2: place root shapes ----------------------- */
  const autoPos = placeRoots(localRoots, model.relationships || [], hierarchy, style, origin);

  /* ----------------- pass 3: resolve to absolute coordinates --------------- */
  const shapes = new Map<string, EntityShape>();
  const categories: CategoryShape[] = [];

  const toAbsolute = (s: LocalShape, ox: number, oy: number): EntityShape => {
    const ax = ox + s.x;
    const ay = oy + s.y;
    const cats: CategoryShape[] = s.categories.map((c) => {
      const cat: CategoryShape = {
        ...c,
        x: ax + c.x,
        y: ay + c.y,
        children: c.children.map((ch) => toAbsolute(ch, ax, ay)),
      };
      categories.push(cat);
      return cat;
    });
    const shape: EntityShape = { ...s, x: ax, y: ay, categories: cats };
    shapes.set(s.entity, shape);
    return shape;
  };

  const roots = localRoots.map((r) => {
    const saved = positions[r.entity];
    const pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : autoPos.get(r.entity)!;
    // A saved size may grow a shape, never shrink it below its content.
    const grown: LocalShape = {
      ...r,
      x: 0,
      y: 0,
      width: Math.max(r.minWidth, saved?.width || 0),
      height: Math.max(r.minHeight, saved?.height || 0),
    };
    if (grown.width !== r.width) {
      grown.categories = r.categories.map((c) => ({ ...c, width: grown.width - style.innerPadding * 2 }));
    }
    return toAbsolute(grown, pos.x, pos.y);
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  roots.forEach((r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });
  const bounds = roots.length
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 };

  return { roots, shapes, categories, hierarchy, bounds, style };
}

/**
 * Layered placement of root shapes: parents above children, ordering inside a
 * layer refined by barycentre sweeps to reduce crossings. Relationships that
 * touch nested subtypes are lifted to their outermost supertype.
 */
function placeRoots(
  roots: { entity: string; width: number; height: number }[],
  relationships: { parent: string; child: string }[],
  hierarchy: SubtypeHierarchy,
  style: BarkerLayoutStyle,
  origin: { x: number; y: number }
): Map<string, { x: number; y: number }> {
  const names = roots.map((r) => r.entity);
  const index = new Map(names.map((n, i) => [n, i]));
  const sizeOf = new Map(roots.map((r) => [r.entity, r]));

  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  names.forEach((n) => {
    out.set(n, []);
    inc.set(n, []);
  });
  const seen = new Set<string>();
  relationships.forEach((rel) => {
    const p = hierarchy.rootOf(rel.parent);
    const c = hierarchy.rootOf(rel.child);
    if (p === c || !index.has(p) || !index.has(c)) return;
    const key = `${p}->${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.get(p)!.push(c);
    inc.get(c)!.push(p);
  });

  // Break cycles with a DFS: back edges are ignored for ranking.
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(names.map((n) => [n, []]));
  const dfs = (n: string) => {
    state.set(n, 1);
    out.get(n)!.forEach((m) => {
      const s = state.get(m) || 0;
      if (s === 1) return; // back edge
      dag.get(n)!.push(m);
      if (s === 0) dfs(m);
    });
    state.set(n, 2);
  };
  names.forEach((n) => {
    if (!state.get(n)) dfs(n);
  });

  // Longest-path ranking over the DAG.
  const rank = new Map<string, number>();
  const computeRank = (n: string, guard = 0): number => {
    if (rank.has(n)) return rank.get(n)!;
    let r = 0;
    names.forEach((p) => {
      if (guard < names.length && dag.get(p)!.includes(n)) r = Math.max(r, computeRank(p, guard + 1) + 1);
    });
    rank.set(n, r);
    return r;
  };
  names.forEach((n) => computeRank(n));

  const layers: string[][] = [];
  names.forEach((n) => {
    const r = rank.get(n)!;
    (layers[r] ||= []).push(n);
  });

  // Barycentre ordering (down and up sweeps).
  const orderIndex = new Map<string, number>();
  const refresh = () => layers.forEach((l) => l.forEach((n, i) => orderIndex.set(n, i)));
  refresh();
  const bary = (n: string, neighbours: string[]) => {
    const vals = neighbours.map((m) => orderIndex.get(m)).filter((v): v is number => v !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : orderIndex.get(n)!;
  };
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    const seq = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    seq.forEach((layer) => {
      const keyed = layer.map((n) => ({ n, b: bary(n, down ? inc.get(n)! : out.get(n)!) }));
      keyed.sort((a, b) => a.b - b.b || index.get(a.n)! - index.get(b.n)!);
      layer.splice(0, layer.length, ...keyed.map((k) => k.n));
      refresh();
    });
  }

  // Lay layers out top to bottom, each centred on the widest layer.
  const widths = layers.map((l) =>
    l.reduce((s, n) => s + sizeOf.get(n)!.width, 0) + Math.max(0, l.length - 1) * style.rankGapX
  );
  const maxW = Math.max(0, ...widths);
  const pos = new Map<string, { x: number; y: number }>();
  let y = origin.y;
  layers.forEach((layer, li) => {
    let x = origin.x + (maxW - widths[li]) / 2;
    let h = 0;
    layer.forEach((n) => {
      const s = sizeOf.get(n)!;
      pos.set(n, { x: Math.round(x), y: Math.round(y) });
      x += s.width + style.rankGapX;
      h = Math.max(h, s.height);
    });
    y += h + style.rankGapY;
  });
  return pos;
}

/** Absolute bounding box of every entity shape, for edge routing. */
export function shapeBoxes(layout: BarkerDiagramLayout) {
  return Array.from(layout.shapes.values()).map((s) => ({
    id: s.entity,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
  }));
}
