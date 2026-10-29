import { test } from 'node:test';
import assert from 'node:assert';
import { exportProjectBundle, importProjectBundle } from '../src/projectBundle.js';
import type { LogicalModel } from '../src/types.js';

test('projectBundle: export and import modular project files', () => {
  const model: LogicalModel = {
    subject_area: 'Order Management',
    notation: 'Barker',
    entities: [
      {
        id: 'ent_customer',
        name: '고객',
        type: 'entity',
        classification: 'KEY',
        identifier: '고객번호',
        attributes: [
          { name: '고객번호', required: true, identifier: true },
          { name: '고객명', required: true },
        ],
      },
      {
        id: 'ent_order',
        name: '주문',
        type: 'entity',
        classification: 'MAIN',
        identifier: '주문번호',
        attributes: [
          { name: '주문번호', required: true, identifier: true },
          { name: '주문일시', required: true },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_cust_ord',
        parent: '고객',
        child: '주문',
        cardinality: 'one_to_many',
        parent_participation: '0..M',
        child_participation: '1..1',
        identifying: false,
      },
    ],
    diagrams: [
      {
        id: 'diag_main',
        subject_area: 'Order Management',
        objects: [
          { id: 'obj_1', modelRef: '고객', x: 100, y: 100, width: 200, height: 150 },
          { id: 'obj_2', modelRef: '주문', x: 400, y: 100, width: 200, height: 150 },
        ],
        connectors: [],
      },
    ],
  };

  // Export
  const files = exportProjectBundle(model, 'Order Management');
  assert.ok(files['project.yaml']);
  assert.ok(files['entities/고객.yaml']);
  assert.ok(files['entities/주문.yaml']);
  assert.ok(files['relationships.yaml']);
  assert.ok(files['diagrams/Order Management.yaml']);

  // Import
  const importedModel = importProjectBundle(files);
  assert.strictEqual(importedModel.subject_area, 'Order Management');
  assert.strictEqual(importedModel.entities.length, 2);
  assert.strictEqual(importedModel.entities.find(e => e.name === '고객')?.classification, 'KEY');
  assert.strictEqual(importedModel.relationships.length, 1);
  assert.strictEqual(importedModel.diagrams?.length, 1);
  assert.strictEqual(importedModel.diagrams[0].objects.length, 2);
});
