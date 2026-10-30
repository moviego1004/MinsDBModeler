import { test } from 'node:test';
import assert from 'node:assert';
import { layoutBarkerDiagram, buildSubtypeHierarchy } from '../src/index.js';
import type { LogicalModel, EntityShape } from '../src/index.js';

const attr = (name: string, extra: Record<string, unknown> = {}) => ({ name, required: true, ...extra });

// 회원 example from DA# (회원 ⊃ {개인, 단체}) + a 3-level hierarchy (행사 ⊃ 연중행사 ⊃ 회의들)
// expressed through all three supported subtype notations.
const model: LogicalModel = {
  subject_area: 'test',
  entities: [
    { name: '회사', type: 'entity', identifier: '회사코드', attributes: [attr('회사코드', { identifier: true }), attr('회사명')] },
    {
      name: '회원',
      type: 'supertype',
      identifier: '회원번호',
      attributes: [attr('회원번호', { identifier: true }), attr('회원명'), attr('회원권종류')],
      subtype_sets: [{ name: '회원권종류', disjoint: true, total: true, subtypes: ['개인', '단체'] }],
    },
    {
      name: '개인',
      type: 'subtype',
      supertype: '회원',
      identifier: [],
      attributes: [attr('회원번호', { identifier: true }), attr('직위', { required: false }), attr('소속회사코드', { required: false })],
    },
    { name: '단체', type: 'subtype', supertype: '회원', identifier: [], attributes: [] },
    { name: '행사', type: 'supertype', identifier: '행사ID', attributes: [attr('행사ID', { identifier: true }), attr('행사종류')] },
    { name: '연중행사', type: 'subtype', identifier: [], attributes: [attr('개최월')] },
    { name: '특별행사', type: 'subtype', supertype: '행사', identifier: [], attributes: [] },
    { name: '9월회의', type: 'subtype', supertype: '연중행사', identifier: [], attributes: [] },
    { name: '11월회의', type: 'subtype', supertype: '연중행사', identifier: [], attributes: [] },
    {
      name: '회비',
      type: 'entity',
      identifier: ['납부회원번호'],
      attributes: [attr('납부회원번호', { identifier: true }), attr('납부연도', { identifier: true })],
    },
  ],
  subtype_sets: [{ supertype: '행사', subtypes: ['연중행사'], total: true, disjoint: true, discriminator: '행사종류' }],
  relationships: [
    { id: 'r1', parent: '회사', child: '개인', cardinality: 'one_to_many', parent_participation: '0..M', child_participation: '0..1', identifying: false, fk_attributes: ['소속회사코드'] },
    { id: 'r2', parent: '회원', child: '회비', cardinality: 'one_to_many', parent_participation: '0..M', child_participation: '1..1', identifying: false, fk_attributes: ['납부회원번호'] },
  ],
};

const inside = (inner: { x: number; y: number; width: number; height: number }, outer: typeof inner) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: EntityShape, b: EntityShape) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('subtypeHierarchy: merges model, embedded and implicit subtype declarations', () => {
  const h = buildSubtypeHierarchy(model);
  assert.deepStrictEqual(h.categoriesOf.get('회원')![0].subtypes, ['개인', '단체']);
  assert.deepStrictEqual(h.categoriesOf.get('행사')![0].subtypes, ['연중행사', '특별행사']);
  assert.strictEqual(h.categoriesOf.get('행사')![0].label, '행사종류');
  assert.deepStrictEqual(h.categoriesOf.get('연중행사')![0].subtypes, ['9월회의', '11월회의']);
  assert.strictEqual(h.rootOf('11월회의'), '행사');
  assert.deepStrictEqual(h.roots.sort(), ['회비', '회사', '회원', '행사'].sort());
});

test('subtypeHierarchy: ignores cycles and unknown entities', () => {
  const h = buildSubtypeHierarchy({
    entities: [
      { name: 'A', type: 'entity', identifier: [], attributes: [], supertype: 'B' },
      { name: 'B', type: 'entity', identifier: [], attributes: [], supertype: 'A' },
      { name: 'C', type: 'entity', identifier: [], attributes: [], supertype: 'Nope' },
    ],
  });
  assert.strictEqual(h.parentOf.size, 1);
  assert.ok(h.roots.includes('C'));
});

test('barkerLayout: nests subtypes inside their supertype at every depth', () => {
  const layout = layoutBarkerDiagram(model);
  const s = (n: string) => layout.shapes.get(n)!;

  assert.deepStrictEqual(layout.roots.map((r) => r.entity).sort(), ['회비', '회사', '회원', '행사'].sort());
  for (const [child, parent] of [['개인', '회원'], ['단체', '회원'], ['연중행사', '행사'], ['특별행사', '행사'], ['9월회의', '연중행사'], ['11월회의', '연중행사']]) {
    assert.ok(inside(s(child), s(parent)), `${child} should be inside ${parent}`);
  }
  // compartment labelled with the discriminator, containing its subtypes
  const cat = s('회원').categories[0];
  assert.strictEqual(cat.label, '회원권종류');
  assert.ok(cat.children.every((c) => inside(c, cat)));
  // categories sit below the supertype's own attribute rows
  const lastRow = s('회원').rows[s('회원').rows.length - 1];
  assert.ok(cat.y >= s('회원').y + lastRow.y + layout.style.rowHeight);
});

test('barkerLayout: pills, inherited attributes, FK and independence come from model semantics', () => {
  const layout = layoutBarkerDiagram(model);
  const s = (n: string) => layout.shapes.get(n)!;

  assert.strictEqual(s('단체').kind, 'pill');
  assert.strictEqual(s('개인').kind, 'box');
  // 회원번호 is inherited from 회원, so the subtype does not repeat it
  assert.deepStrictEqual(s('개인').rows.map((r) => r.name), ['직위', '소속회사코드']);
  assert.strictEqual(s('개인').rows[1].isFk, true);
  assert.strictEqual(s('개인').rows[0].marker, 'o');
  assert.strictEqual(s('회원').rows[0].marker, '#');
  assert.strictEqual(s('회원').rows[1].marker, '*');
  // 회비's identifier contains an FK → dependent; 회사 is independent
  assert.strictEqual(s('회비').independent, false);
  assert.strictEqual(s('회사').independent, true);
});

test('barkerLayout: auto placement has no overlapping roots and puts parents above children', () => {
  const layout = layoutBarkerDiagram(model);
  const roots = layout.roots;
  for (let i = 0; i < roots.length; i++)
    for (let j = i + 1; j < roots.length; j++)
      assert.ok(!overlaps(roots[i], roots[j]), `${roots[i].entity} overlaps ${roots[j].entity}`);
  const s = (n: string) => layout.shapes.get(n)!;
  assert.ok(s('회사').y < s('회원').y, '회사 (parent of nested 개인) ranks above 회원');
  assert.ok(s('회원').y < s('회비').y);
});

test('barkerLayout: saved positions move the whole nested cluster and sizes never shrink below content', () => {
  const base = layoutBarkerDiagram(model);
  const moved = layoutBarkerDiagram(model, { positions: { 회원: { x: 1000, y: 500, width: 10, height: 10 } } });
  const b = base.shapes.get('회원')!;
  const m = moved.shapes.get('회원')!;
  assert.strictEqual(m.x, 1000);
  assert.strictEqual(m.width, b.width);
  assert.strictEqual(m.height, b.height);
  const dx = moved.shapes.get('개인')!.x - base.shapes.get('개인')!.x;
  assert.strictEqual(dx, 1000 - b.x);

  const grown = layoutBarkerDiagram(model, { positions: { 회원: { x: 0, y: 0, width: b.width + 100 } } });
  assert.strictEqual(grown.shapes.get('회원')!.width, b.width + 100);
  assert.strictEqual(grown.shapes.get('회원')!.categories[0].width, b.width + 100 - grown.style.innerPadding * 2);
});

test('barkerLayout: deeper nesting goes through the same code path', () => {
  // 6-level chain built programmatically — no special casing per depth
  const names = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const m = {
    entities: names.map((n, i) => ({
      name: n,
      type: 'entity' as const,
      identifier: [],
      supertype: i ? names[i - 1] : undefined,
      attributes: [attr(`${n}속성`)],
    })),
    relationships: [],
  };
  const layout = layoutBarkerDiagram(m);
  assert.strictEqual(layout.roots.length, 1);
  for (let i = 1; i < names.length; i++) {
    assert.ok(inside(layout.shapes.get(names[i])!, layout.shapes.get(names[i - 1])!));
    assert.strictEqual(layout.shapes.get(names[i])!.depth, i);
  }
});

test('barkerLayout: DA# 지역커뮤니티 fixture renders every subtype nested, no overlapping roots', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { parseModel } = await import('../src/index.js');
  const yaml = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/community-da.yaml'), 'utf-8');
  const m = parseModel(yaml);
  const layout = layoutBarkerDiagram(m);
  const s = (n: string) => layout.shapes.get(n)!;

  assert.strictEqual(layout.roots.length, 14);
  m.entities.filter((e) => e.supertype).forEach((e) => assert.ok(inside(s(e.name), s(e.supertype!)), e.name));
  assert.deepStrictEqual(['단체', '특별행사', '9월회의', '메인프레임', '회계'].map((n) => s(n).kind), Array(5).fill('pill'));
  assert.strictEqual(s('연중행사').kind, 'box'); // attribute-less but owns a subtype set
  for (let i = 0; i < layout.roots.length; i++)
    for (let j = i + 1; j < layout.roots.length; j++)
      assert.ok(!overlaps(layout.roots[i], layout.roots[j]), `${layout.roots[i].entity} / ${layout.roots[j].entity}`);
  assert.strictEqual(s('개인').rows.find((r) => r.name === '소속회사코드')!.isFk, true);
});

test('barkerRouting: lines to nested subtypes stay outside the supertype until the final drop', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { parseModel, routeBarkerRelationships } = await import('../src/index.js');
  const m = parseModel(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/community-da.yaml'), 'utf-8'));
  const layout = layoutBarkerDiagram(m);
  const routes = routeBarkerRelationships(layout, m.relationships);
  assert.strictEqual(Object.keys(routes).length, 16);

  const sup = layout.shapes.get('회원')!;
  const sub = layout.shapes.get('개인')!;
  const r = routes['R01']; // 회사 → 개인
  const pts = r.waypoints;
  const last = pts[pts.length - 1];
  // lands on 개인's border
  assert.ok(last.x >= sub.x && last.x <= sub.x + sub.width && (last.y === sub.y || last.y === sub.y + sub.height));
  // every point except the landing point lies outside (or on the border of) 회원
  const strictlyInside = (p: { x: number; y: number }) => p.x > sup.x && p.x < sup.x + sup.width && p.y > sup.y && p.y < sup.y + sup.height;
  pts.slice(0, -1).forEach((p) => assert.ok(!strictlyInside(p), `waypoint ${p.x},${p.y} inside 회원`));
  // routes stay orthogonal
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y);
  // recursive relationship gets a loop
  assert.ok(routes['R16'].waypoints.length >= 4);
});

test('barkerRouting: trunks are moved off boxes that sit between the two ends', async () => {
  const { routeBarkerRelationships } = await import('../src/index.js');
  const e = (name: string) => ({ name, type: 'entity' as const, identifier: [], attributes: [attr(`${name}ID`, { identifier: true })] });
  const m = {
    entities: [e('A'), e('B'), e('Blocker')],
    relationships: [{ id: 'r', parent: 'A', child: 'B', cardinality: 'one_to_many' as const, parent_participation: '0..M' as const, child_participation: '1..1' as const, identifying: false }],
  };
  // A on top, B far below, Blocker exactly where the midpoint trunk would run
  const layout = layoutBarkerDiagram(m, {
    positions: { A: { x: 0, y: 0 }, B: { x: 400, y: 400 }, Blocker: { x: 100, y: 170 } },
  });
  const blocker = layout.shapes.get('Blocker')!;
  const pts = routeBarkerRelationships(layout, m.relationships).r.waypoints;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const crosses = Math.max(a.x, b.x) > blocker.x && Math.min(a.x, b.x) < blocker.x + blocker.width &&
      Math.max(a.y, b.y) > blocker.y && Math.min(a.y, b.y) < blocker.y + blocker.height;
    assert.ok(!crosses, `segment ${i} crosses Blocker`);
  }
});
