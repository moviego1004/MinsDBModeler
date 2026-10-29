import { test } from 'node:test';
import assert from 'node:assert';
import { createZipBundle, readZipBundle } from '../src/zipPacker.js';

test('createZipBundle and readZipBundle round-trip', () => {
  const originalFiles = {
    'project.yaml': 'project_name: TestProject\nversion: 1.0.0\n',
    'entities/USER.yaml': 'name: USER\nclassification: KEY\n',
    'relationships.yaml': '- id: R001\n  parent: USER\n  child: ORDER\n'
  };

  const zipBytes = createZipBundle(originalFiles);
  assert.ok(zipBytes.length > 0, 'Zip bytes should not be empty');

  const restoredFiles = readZipBundle(zipBytes);
  assert.strictEqual(restoredFiles['project.yaml'], originalFiles['project.yaml']);
  assert.strictEqual(restoredFiles['entities/USER.yaml'], originalFiles['entities/USER.yaml']);
  assert.strictEqual(restoredFiles['relationships.yaml'], originalFiles['relationships.yaml']);
});
