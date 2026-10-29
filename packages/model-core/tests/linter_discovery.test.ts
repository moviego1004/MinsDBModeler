import { test } from 'node:test';
import assert from 'node:assert';
import { lintModel, autoDiscoverRelationships } from '../src/index.js';
import type { LogicalModel, Entity } from '../src/types.js';

test('lintModel: detects orphan entities, missing PKs, and circular references', () => {
  const model: LogicalModel = {
    subject_area: 'Test Linter',
    entities: [
      {
        name: '고립엔터티',
        type: 'entity',
        identifier: [],
        attributes: [{ name: '이름', required: true }], // No PK
      },
      {
        name: 'A',
        type: 'entity',
        identifier: 'a_id',
        attributes: [{ name: 'a_id', required: true, identifier: true }],
      },
      {
        name: 'B',
        type: 'entity',
        identifier: 'b_id',
        attributes: [{ name: 'b_id', required: true, identifier: true }],
      },
    ],
    relationships: [
      {
        id: 'r1',
        parent: 'A',
        child: 'B',
        cardinality: 'one_to_many',
        parent_participation: '0..M',
        child_participation: '1..1',
        identifying: false,
      },
      {
        id: 'r2',
        parent: 'B',
        child: 'A',
        cardinality: 'one_to_many',
        parent_participation: '0..M',
        child_participation: '1..1',
        identifying: false,
      },
    ],
  };

  const issues = lintModel(model);
  
  // 1. Should flag orphan
  assert.ok(issues.some(i => i.id.startsWith('orphan_고립엔터티')), 'Should report orphan entity');

  // 2. Should flag missing PK
  assert.ok(issues.some(i => i.id.startsWith('no_pk_고립엔터티')), 'Should report missing PK');

  // 3. Should flag circular dependency A -> B -> A
  assert.ok(issues.some(i => i.category === 'CONSISTENCY'), 'Should report circular relationship');
});

test('autoDiscoverRelationships: infers FK relationships from PK matching', () => {
  const entities: Entity[] = [
    {
      name: '부서',
      type: 'entity',
      identifier: '부서코드',
      attributes: [
        { name: '부서코드', required: true, identifier: true, physicalName: 'DEPT_CODE' },
        { name: '부서명', required: true },
      ],
    },
    {
      name: '사원',
      type: 'entity',
      identifier: '사원번호',
      attributes: [
        { name: '사원번호', required: true, identifier: true, physicalName: 'EMP_NO' },
        { name: '사원명', required: true },
        { name: '부서코드', required: true, physicalName: 'DEPT_CODE' }, // Matches Parent PK
      ],
    },
  ];

  const discovered = autoDiscoverRelationships(entities, []);
  assert.strictEqual(discovered.length, 1);
  assert.strictEqual(discovered[0].parent, '부서');
  assert.strictEqual(discovered[0].child, '사원');
  assert.deepStrictEqual(discovered[0].fk_attributes, ['부서코드']);
  assert.strictEqual(discovered[0].child_participation, '1..1');
});
