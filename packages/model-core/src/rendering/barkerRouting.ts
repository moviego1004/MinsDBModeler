import type { Point, Relationship } from '../types.js';
import type { RouteResult, PortDirection } from '../routing/types.js';
import { calculateDiagramRoutes } from '../routing/orthogonalRouter.js';
import type { BarkerDiagramLayout, EntityShape } from './barkerLayout.js';

export interface BarkerRoutingOptions {
  padding?: number;
  laneSpacing?: number;
  /** Size of the loop drawn for self-referencing relationships. */
  loopSize?: number;
}

const box = (s: EntityShape) => ({ id: s.entity, x: s.x, y: s.y, width: s.width, height: s.height });

/**
 * Routes relationship lines over a nested Barker layout.
 *
 * Lines are routed between the *outermost* shapes (diagram roots) so trunks and lanes
 * never run inside a supertype. When an end belongs to a nested subtype, the line then
 * drops straight through the supertype border onto the subtype, entering from the same
 * side — so a relationship to `개인` lands on 개인 itself, not on the 회원 container.
 *
 * Relationships whose two ends share the same root (e.g. between sibling subtypes) are
 * routed directly between the two shapes; self references get a corner loop.
 */
export function routeBarkerRelationships(
  layout: BarkerDiagramLayout,
  relationships: Pick<Relationship, 'id' | 'parent' | 'child'>[],
  options: BarkerRoutingOptions = {}
): Record<string, RouteResult> {
  const { padding = 24, laneSpacing = 18, loopSize = 24 } = options;
  const { shapes, hierarchy } = layout;
  const result: Record<string, RouteResult> = {};

  const outer: { id: string; source: string; target: string }[] = [];
  const inner: { id: string; source: string; target: string }[] = [];

  relationships.forEach((rel) => {
    if (!shapes.has(rel.parent) || !shapes.has(rel.child)) return;
    if (rel.parent === rel.child) {
      result[rel.id] = selfLoop(shapes.get(rel.parent)!, loopSize);
      return;
    }
    const pr = hierarchy.rootOf(rel.parent);
    const cr = hierarchy.rootOf(rel.child);
    if (pr === cr) inner.push({ id: rel.id, source: rel.parent, target: rel.child });
    else outer.push({ id: rel.id, source: pr, target: cr });
  });

  // 1. Root-to-root routing (port slotting + lane separation from the shared router)
  const rootRoutes = calculateDiagramRoutes(layout.roots.map(box), outer, { padding, laneSpacing });

  const relById = new Map(relationships.map((r) => [r.id, r]));
  const rootBoxes = layout.roots.map(box);
  const lanes: Lane[] = [];
  outer.forEach((e) => {
    const raw = rootRoutes[e.id];
    if (!raw) return;
    const obstacles = rootBoxes.filter((b) => b.id !== e.source && b.id !== e.target);
    const route = clearTrunk(raw, obstacles, lanes, laneSpacing);
    const rel = relById.get(e.id)!;
    let r = route;
    if (rel.parent !== e.source) r = dropInto(r, 'source', shapes.get(rel.parent)!);
    if (rel.child !== e.target) r = dropInto(r, 'target', shapes.get(rel.child)!);
    result[e.id] = r;
  });

  // 2. Same-cluster routing (shapes inside one root)
  if (inner.length) {
    const ids = new Set(inner.flatMap((e) => [e.source, e.target]));
    const boxes = Array.from(ids).map((id) => box(shapes.get(id)!));
    Object.assign(result, calculateDiagramRoutes(boxes, inner, { padding: padding / 2, laneSpacing }));
  }

  return result;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Lane {
  horizontal: boolean;
  at: number;
  from: number;
  to: number;
}

const MARGIN = 6;

/** Does the axis-aligned segment a→b pass through the (slightly inflated) box interior? */
function hits(a: Point, b: Point, o: Box): boolean {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return x2 > o.x - MARGIN && x1 < o.x + o.width + MARGIN && y2 > o.y - MARGIN && y1 < o.y + o.height + MARGIN;
}

const pathClear = (pts: Point[], obstacles: Box[]) =>
  pts.every((p, i) => i === 0 || !obstacles.some((o) => hits(pts[i - 1], p, o)));

/**
 * For a Z-shaped route (port → leg → trunk → leg → port) choose the trunk coordinate
 * closest to the router's choice that (1) keeps every segment out of other shapes and
 * (2) does not run on top of an already placed parallel trunk.
 * Routes of any other shape are returned unchanged.
 */
function clearTrunk(route: RouteResult, obstacles: Box[], lanes: Lane[], laneSpacing: number): RouteResult {
  const pts = route.waypoints;
  if (pts.length !== 4) return route;
  const [p0, a, b, p3] = pts;
  const horizontal = Math.abs(a.y - b.y) < 0.5 && Math.abs(p0.x - a.x) < 0.5 && Math.abs(b.x - p3.x) < 0.5;
  const vertical = Math.abs(a.x - b.x) < 0.5 && Math.abs(p0.y - a.y) < 0.5 && Math.abs(b.y - p3.y) < 0.5;
  if (!horizontal && !vertical) return route;

  const coord = (p: Point) => (horizontal ? p.y : p.x);
  const span = (p: Point) => (horizontal ? p.x : p.y);
  const lo = Math.min(coord(p0), coord(p3)) + 12;
  const hi = Math.max(coord(p0), coord(p3)) - 12;
  if (lo > hi) return route;

  const build = (t: number): Point[] =>
    horizontal
      ? [p0, { x: p0.x, y: t }, { x: p3.x, y: t }, p3]
      : [p0, { x: t, y: p0.y }, { x: t, y: p3.y }, p3];

  const from = Math.min(span(p0), span(p3));
  const to = Math.max(span(p0), span(p3));
  const crowding = (t: number) =>
    lanes.filter((l) => l.horizontal === horizontal && Math.abs(l.at - t) < laneSpacing && l.from < to && from < l.to).length;

  // Candidates: the original trunk, just outside every obstacle edge, and lane steps around each.
  const base = [coord(a)];
  obstacles.forEach((o) => {
    base.push(horizontal ? o.y - MARGIN * 2 : o.x - MARGIN * 2);
    base.push(horizontal ? o.y + o.height + MARGIN * 2 : o.x + o.width + MARGIN * 2);
  });
  const candidates = new Set<number>();
  base.forEach((t) => {
    for (let k = -3; k <= 3; k++) {
      const v = Math.round(t + k * laneSpacing);
      if (v >= lo && v <= hi) candidates.add(v);
    }
  });

  let best: number | undefined;
  let bestScore = Infinity;
  candidates.forEach((t) => {
    if (!pathClear(build(t), obstacles)) return;
    const score = Math.abs(t - coord(a)) + crowding(t) * 1000;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  });
  const t = best ?? coord(a);
  lanes.push({ horizontal, at: t, from, to });
  return best === undefined ? route : { ...route, waypoints: build(t) };
}

/**
 * Re-anchors one end of a root-level route onto a nested shape: the port slides along
 * the root's side to line up with the nested shape, and the end segment is extended
 * straight to the nested shape's border.
 */
function dropInto(route: RouteResult, end: 'source' | 'target', nested: EntityShape): RouteResult {
  const pts = route.waypoints.map((p) => ({ ...p }));
  if (pts.length < 2) return route;
  const isSource = end === 'source';
  const side: PortDirection = isSource ? route.sourceDirection : route.targetDirection;
  const iPort = isSource ? 0 : pts.length - 1;
  const iNext = isSource ? 1 : pts.length - 2;
  const vertical = side === 'top' || side === 'bottom';

  // Keep the original slot if it already falls on the nested shape, else use its centre.
  const lo = vertical ? nested.x + 6 : nested.y + 6;
  const hi = vertical ? nested.x + nested.width - 6 : nested.y + nested.height - 6;
  const cur = vertical ? pts[iPort].x : pts[iPort].y;
  const along = cur >= lo && cur <= hi ? cur : (vertical ? nested.x + nested.width / 2 : nested.y + nested.height / 2);

  const borderCoord =
    side === 'top' ? nested.y : side === 'bottom' ? nested.y + nested.height : side === 'left' ? nested.x : nested.x + nested.width;

  const port: Point = vertical ? { x: along, y: borderCoord } : { x: borderCoord, y: along };

  // The first leg leaves the port perpendicular to the side; shift it to the new slot.
  if (vertical) {
    if (Math.abs(pts[iNext].x - pts[iPort].x) < 0.5) pts[iNext].x = along;
    else pts.splice(isSource ? 1 : pts.length - 1, 0, { x: along, y: pts[iPort].y });
  } else {
    if (Math.abs(pts[iNext].y - pts[iPort].y) < 0.5) pts[iNext].y = along;
    else pts.splice(isSource ? 1 : pts.length - 1, 0, { x: pts[iPort].x, y: along });
  }
  pts[isSource ? 0 : pts.length - 1] = port;

  return {
    ...route,
    waypoints: simplify(pts),
    sourcePort: isSource ? port : route.sourcePort,
    targetPort: isSource ? route.targetPort : port,
  };
}

/** Drop duplicate and collinear interior points. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  points.forEach((p) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) return;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const collinear = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5);
      if (collinear) out.pop();
    }
    out.push(p);
  });
  return out;
}

function selfLoop(shape: EntityShape, size: number): RouteResult {
  const right = shape.x + shape.width;
  const top = shape.y;
  const waypoints = [
    { x: right - size, y: top },
    { x: right - size, y: top - size },
    { x: right + size, y: top - size },
    { x: right + size, y: top + size },
    { x: right, y: top + size },
  ];
  return {
    waypoints,
    sourcePort: waypoints[0],
    targetPort: waypoints[waypoints.length - 1],
    sourceDirection: 'top',
    targetDirection: 'right',
  };
}
