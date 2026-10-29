import { test } from 'node:test';
import assert from 'node:assert';
import { parseModel, stringifyModel } from '../src/parser.js';

test('parseModel: should assign stable IDs and parse DA# metadata', () => {
  const yaml = `
subject_area: Test Area
entities:
  - name: 이용자
    physicalName: TB_USER
    classification: KEY
    level: 1
    volume:
      period: daily
      monthlyQuantity: 50000
      retentionMonths: 36
      totalQuantity: 1800000
    identifier: 이용자번호
    attributes:
      - name: 이용자번호
        physicalName: USER_NO
        domain: 식별번호
        required: true
        identifier: true
      - name: 이용자명
        domain: 성명
        required: true
`;

  const model = parseModel(yaml);
  assert.strictEqual(model.entities.length, 1);
  const ent = model.entities[0];
  assert.ok(ent.id, 'Entity should have an ID');
  assert.strictEqual(ent.physicalName, 'TB_USER');
  assert.strictEqual(ent.classification, 'KEY');
  assert.strictEqual(ent.level, 1);
  assert.strictEqual(ent.volume?.monthlyQuantity, 50000);
  assert.strictEqual(ent.attributes[0].physicalName, 'USER_NO');
  assert.strictEqual(ent.attributes[0].keyType, 'PK');
  assert.ok(ent.attributes[0].id, 'Attribute should have an ID');

  const outputYaml = stringifyModel(model);
  assert.ok(outputYaml.includes('classification: KEY'));
  assert.ok(outputYaml.includes('physicalName: TB_USER'));
});
