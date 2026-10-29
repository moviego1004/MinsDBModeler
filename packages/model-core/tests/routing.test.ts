import { test } from 'node:test';
import assert from 'node:assert';
import { 
  calculateOrthogonalRoute, 
  calculateBarkerEndpointSymbols, 
  calculateLayeredAutoLayout,
  calculateDiagramRoutes 
} from '../src/routing/index.js';

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

test('barkerSymbols: calculates crow foot prongs spreading against entity border', () => {
  const endpoint = { x: 100, y: 100 };
  const prevPoint = { x: 50, y: 100 }; // Incoming horizontally from left

  const symbols = calculateBarkerEndpointSymbols(endpoint, prevPoint, {
    isMany: true,
    isOptional: true,
    prongLength: 12,
    prongSpread: 9,
  });

  assert.ok(symbols.crowFootLines);
  assert.strictEqual(symbols.crowFootLines.length, 3);

  // Each line is [apex, toe]
  // Apex is at x = 88 (100 - 12), y = 100
  const [leftLine, centerLine, rightLine] = symbols.crowFootLines;
  const apex = leftLine[0];
  assert.strictEqual(apex.x, 88);
  assert.strictEqual(apex.y, 100);

  // Toes touch the entity border at x = 100
  const leftToe = leftLine[1];
  const centerToe = centerLine[1];
  const rightToe = rightLine[1];

  assert.strictEqual(centerToe.x, 100);
  assert.strictEqual(centerToe.y, 100);
  assert.strictEqual(leftToe.x, 100);
  assert.strictEqual(leftToe.y, 91); // 100 - 9
  assert.strictEqual(rightToe.x, 100);
  assert.strictEqual(rightToe.y, 109); // 100 + 9

  // Optional circle (if used) is placed back along the line
  assert.ok(symbols.circle);
  assert.ok(symbols.circle.cx < apex.x, 'Circle should be placed back along the line behind apex');
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

test('calculateDiagramRoutes: separates parallel edges with collision-free lane spacing', () => {
  const nodes = [
    { id: '행사', x: 100, y: 100, width: 250, height: 150 },
    { id: '설문응답', x: 200, y: 350, width: 250, height: 150 },
  ];
  const edges = [
    { id: 'rel_event_survey_1', source: '행사', target: '설문응답' },
    { id: 'rel_event_survey_2', source: '행사', target: '설문응답' },
  ];

  const routes = calculateDiagramRoutes(nodes, edges, { laneSpacing: 18 });

  assert.ok(routes['rel_event_survey_1']);
  assert.ok(routes['rel_event_survey_2']);

  const r1 = routes['rel_event_survey_1'];
  const r2 = routes['rel_event_survey_2'];

  // Ports must be distributed (different X coordinates)
  assert.notStrictEqual(r1.sourcePort.x, r2.sourcePort.x, 'Source ports must have different X coordinates');
  assert.notStrictEqual(r1.targetPort.x, r2.targetPort.x, 'Target ports must have different X coordinates');

  // Intermediate horizontal segment (midY) must have lane offset (different Y coordinates)
  assert.strictEqual(r1.waypoints.length, 4, 'Must have 4 waypoints for orthogonal step');
  assert.strictEqual(r2.waypoints.length, 4, 'Must have 4 waypoints for orthogonal step');

  const r1MidY = r1.waypoints[1].y;
  const r2MidY = r2.waypoints[1].y;
  assert.notStrictEqual(r1MidY, r2MidY, 'Mid horizontal segments must be separated by lane offset');
  assert.strictEqual(Math.abs(r1MidY - r2MidY), 18, 'Distance between parallel lanes must match laneSpacing');
});

