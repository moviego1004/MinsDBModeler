import test from 'node:test';
import assert from 'node:assert';
import { parseModel, validateModel } from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('validateModel: should report duplicate entities', () => {
  const modelYaml = `
subject_area: Test Area
entities:
  - name: User
    type: entity
    identifier: id
    attributes: []
  - name: User
    type: entity
    identifier: id
    attributes: []
relationships: []
`;
  const model = parseModel(modelYaml);
  const errors = validateModel(model);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.message.includes('Duplicate entity name')));
});

test('validateModel: should report missing supertypes', () => {
  const modelYaml = `
subject_area: Test Area
entities:
  - name: Staff
    type: subtype
    supertype: User
    identifier: id
    attributes: []
relationships: []
`;
  const model = parseModel(modelYaml);
  const errors = validateModel(model);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.message.includes('Supertype "User" declared for subtype "Staff" does not exist')));
});

test('validateModel: should validate qvi-user-logical.yaml successfully', () => {
  const filePath = path.resolve(__dirname, '../../../doc/참고/model/qvi-user-logical.yaml');
  const yamlContent = fs.readFileSync(filePath, 'utf-8');
  const model = parseModel(yamlContent);
  const errors = validateModel(model);
  
  // Show warnings if any, but test should pass if there are no errors
  const criticalErrors = errors.filter(e => e.severity === 'error');
  if (criticalErrors.length > 0) {
    console.error('Critical errors in qvi-user-logical.yaml:', criticalErrors);
  }
  assert.strictEqual(criticalErrors.length, 0);
});

test('validateModel: should validate qvi-user-account-logical.yaml successfully', () => {
  const filePath = path.resolve(__dirname, '../../../doc/참고/model/qvi-user-account-logical.yaml');
  const yamlContent = fs.readFileSync(filePath, 'utf-8');
  const model = parseModel(yamlContent);
  const errors = validateModel(model, { allowUndefinedEntities: true });
  
  const criticalErrors = errors.filter(e => e.severity === 'error');
  if (criticalErrors.length > 0) {
    console.error('Critical errors in qvi-user-account-logical.yaml:', criticalErrors);
  }
  assert.strictEqual(criticalErrors.length, 0);
});
