import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { parseDaNativeFile } from '../src/index.js';

test('daNativeParser: parses actual DA# 4 (.dax) file from DAP dataset', () => {
  const daxPath = 'D:\\Data\\DAP\\데이터와사람들\\(3.고급)31. 지역커뮤니티.dax';
  if (!fs.existsSync(daxPath)) {
    console.log('Skipping dax test: file not found on current environment');
    return;
  }

  const fileBytes = fs.readFileSync(daxPath);
  const model = parseDaNativeFile(fileBytes, '(3.고급)31. 지역커뮤니티.dax');

  assert.ok(model.entities.length >= 15, `Expected >= 15 entities, got ${model.entities.length}`);
  
  const userEnt = model.entities.find(e => e.name === '회원');
  assert.ok(userEnt, '회원 entity should exist');
  assert.ok(userEnt.attributes.some(a => a.name === '회원번호'), '회원번호 attribute should exist');
  assert.ok(userEnt.attributes.some(a => a.name === '회원명'), '회원명 attribute should exist');

  const companyEnt = model.entities.find(e => e.name === '회사');
  assert.ok(companyEnt, '회사 entity should exist');

  assert.ok(model.relationships.length > 0, `Expected discovered relationships, got ${model.relationships.length}`);
  assert.strictEqual(model.relationships.length, 16, `Expected exactly 16 DA# relationships, got ${model.relationships.length}`);

  // Subtype verification
  assert.ok(userEnt.subtype_sets, '회원 entity should have subtype_sets');
  assert.strictEqual(userEnt.subtype_sets.length, 1);
  assert.strictEqual(userEnt.subtype_sets[0].name, '회원권종류');
  assert.ok(userEnt.subtype_sets[0].subtypes.includes('개인'));
  assert.ok(userEnt.subtype_sets[0].subtypes.includes('단체'));
});

test('daNativeParser: parses actual DA# 5 (.damx) file from DAP dataset', () => {
  const damxPath = 'D:\\Data\\DAP\\데이터와사람들\\(4.특급)43. 학사관리 시스템.damx';
  if (!fs.existsSync(damxPath)) {
    console.log('Skipping damx test: file not found on current environment');
    return;
  }

  const fileBytes = fs.readFileSync(damxPath);
  const model = parseDaNativeFile(fileBytes, '(4.특급)43. 학사관리 시스템.damx');

  assert.ok(model.entities.length >= 10, `Expected >= 10 entities, got ${model.entities.length}`);
});
