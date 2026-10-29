import { test } from 'node:test';
import assert from 'node:assert';
import { calculateOrthogonalRoute, calculateBarkerEndpointSymbols, calculateLayeredAutoLayout } from '../src/routing/index.js';

test('orthogonalRouter: routes horizontal disjoint boxes cleanly', () => {
  const source = { x: 50, y: 50, width: 200, height: 100 };
  const target = { x: 400, y: 80, width: 200, height: 100 };

  const route = calculateOrthogonalRoute(source, target);
  assert.strictEqual(route.sourceDirection, 'right');
  assert.strictEqual(route.targetDirection, 'left');
  assert.ok(route.waypoints.length >= 4);

  // Check right angles (every adjacent pair must share either x or y)
  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const p1 = route.waypoints[i];
    const p2 = route.waypoints[i + 1];
    const isOrthogonal = Math.abs(p1.x - p2.x) < 0.01 || Math.abs(p1.y - p2.y) < 0.01;
    assert.ok(isOrthogonal, `Segment ${i} must be orthogonal: (${p1.x},${p1.y}) -> (${p2.x},${p2.y})`);
  }
});

test('orthogonalRouter: routes vertical disjoint boxes cleanly', () => {
  const source = { x: 100, y: 50, width: 200, height: 100 };
  const target = { x: 120, y: 300, width: 200, height: 100 };

  const route = calculateOrthogonalRoute(source, target);
  assert.strictEqual(route.sourceDirection, 'bottom');
  assert.strictEqual(route.targetDirection, 'top');

  for (let i = 0; i < route.waypoints.length - 1; i++) {
    const p1 = route.waypoints[i];
    const p2 = route.waypoints[i + 1];
    const isOrthogonal = Math.abs(p1.x - p2.x) < 0.01 || Math.abs(p1.y - p2.y) < 0.01;
    assert.ok(isOrthogonal, `Segment ${i} must be orthogonal`);
  }
});

test('barkerSymbols: calculates crow foot prongs and optional circle', () => {
  const endpoint = { x: 100, y: 100 };
  const prevPoint = { x: 50, y: 100 }; // Incoming horizontally from left

  const symbols = calculateBarkerEndpointSymbols(endpoint, prevPoint, {
    isMany: true,
    isOptional: true,
  });

  assert.ok(symbols.crowFootLines);
  assert.strictEqual(symbols.crowFootLines.length, 3);
  assert.ok(symbols.circle);
  assert.ok(symbols.circle.cx < endpoint.x, 'Circle should be placed back along the line');
});

test('autoLayout: ranks parent above child in layered tree', () => {
  const entities = [
    { name: '부서', type: 'entity' as const, identifier: '부서코드', attributes: [{ name: '부서코드', required: true }] },
    { name: '사원', type: 'entity' as const, identifier: '사원번호', attributes: [{ name: '사원번호', required: true }] },
  ];
  const relationships = [
    {
      id: 'rel_dept_emp',
      parent: '부서',
      child: '사원',
      cardinality: 'one_to_many' as const,
      parent_participation: '0..M' as const,
      child_participation: '1..1' as const,
      identifying: false,
    },
  ];

  const layout = calculateLayeredAutoLayout(entities, relationships);
  assert.ok(layout['부서']);
  assert.ok(layout['사원']);
  // Parent ('부서') must be on layer 0 (smaller y), child ('사원') on layer 1 (larger y)
  assert.ok(layout['부서'].y < layout['사원'].y, 'Parent entity must have lower Y (higher vertical rank) than child');
});

