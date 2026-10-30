import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseModel,
  parseStandards,
  serializeStandards,
  addStandardWords,
  translateLogicalName,
  resolveDataType,
  compilePhysicalModel,
  generateDdl,
  physicalDiagramModel,
  parseOverrides,
  pairForeignKeyAttributes,
} from '../src/index.js';

const fixture = (f: string) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf-8');
const community = () => parseModel(fixture('community-da.yaml'));

const dict = parseStandards(
  `words:
  - { logical: 회원, physical: MBR }
  - { logicalName: 번호, physicalAbbr: NO }
  - { logical: 행사, physical: EVT }
  - { logical: 회사, physical: CO }
  - { logical: 코드, physical: CD }
  - { logical: 소속, physical: BLNG }
`,
  `domains:
  - { logicalName: 번호, dataTypeOracle: "NUMBER(10)", dataTypePostgres: "INTEGER", dataTypeMysql: "INT" }
  - { logical: 코드, oracle: "VARCHAR2(20)", postgres: "VARCHAR(20)" }
`
);

test('standards: every key spelling is read, domain data types survive', () => {
  assert.strictEqual(dict.words.length, 6);
  assert.deepStrictEqual(dict.domains[0], { logicalName: '번호', dataTypeOracle: 'NUMBER(10)', dataTypePostgres: 'INTEGER', dataTypeMysql: 'INT' });
  assert.strictEqual(dict.domains[1].dataTypeMysql, 'VARCHAR(20)');
  const round = serializeStandards(dict);
  assert.deepStrictEqual(parseStandards(round.dictionary, round.domains), dict);
});

test('standards: translation, ASCII runs, non-standard words, data types', () => {
  assert.strictEqual(translateLogicalName('회원번호', dict).physicalName, 'MBR_NO');
  const r = translateLogicalName('QVI회원 등급', dict);
  assert.strictEqual(r.physicalName, 'QVI_MBR_등급');
  assert.deepStrictEqual(r.nonStandardWords, ['등급']);
  assert.strictEqual(resolveDataType(undefined, '회원번호', 'ORACLE', dict), 'NUMBER(10)');
  assert.strictEqual(resolveDataType('코드', 'x', 'MYSQL', dict), 'VARCHAR(20)');
  assert.strictEqual(resolveDataType('VARCHAR(30)', 'x', 'ORACLE', dict), 'VARCHAR2(30)');
  const more = addStandardWords(dict, [{ logicalName: '등급', physicalAbbr: 'grd' }]);
  assert.strictEqual(translateLogicalName('회원등급', more).physicalName, 'MBR_GRD');
});

test('fk pairing: name, suffix and positional matches', () => {
  assert.deepStrictEqual(pairForeignKeyAttributes(['설문ID', '설문문항번호'], ['설문ID', '설문문항번호']), ['설문ID', '설문문항번호']);
  assert.deepStrictEqual(pairForeignKeyAttributes(['보기번호'], ['답변문항보기번호']), ['답변문항보기번호']);
  assert.deepStrictEqual(pairForeignKeyAttributes(['이용자번호'], ['신청자이용자번호']), ['신청자이용자번호']);
  assert.deepStrictEqual(pairForeignKeyAttributes(['A', 'B'], ['X']), [undefined, undefined]);
});

test('physical ROLL_UP: subtypes fold into the root table, subtype FK stays nullable', () => {
  const pm = compilePhysicalModel(community(), { dbms: 'ORACLE', subtypeStrategy: 'ROLL_UP', dictionary: dict });
  const names = pm.tables.map((t) => t.entity);
  assert.ok(names.includes('회원') && !names.includes('개인') && !names.includes('연중행사'));
  const member = pm.tables.find((t) => t.entity === '회원')!;
  assert.deepStrictEqual(member.entities.sort(), ['개인', '단체', '회원'].sort());
  const job = member.columns.find((c) => c.logicalName === '직위')!;
  assert.strictEqual(job.nullable, true);
  // 회사 → 개인 lands on the member table as a nullable FK
  const fk = pm.foreignKeys.find((f) => f.relationshipId === 'R01')!;
  assert.strictEqual(fk.table, member.name);
  assert.strictEqual(member.columns.find((c) => c.name === fk.columns[0])!.nullable, true);
  // 2-level hierarchy: one 행사 table with a nested discriminator
  const evt = pm.tables.find((t) => t.entity === '행사')!;
  assert.ok(evt.columns.some((c) => c.logicalName === '회의구분' && c.nullable));
  assert.ok(evt.columns.some((c) => c.logicalName === '행사종류' && !c.nullable));
});

test('physical ROLL_DOWN: leaf tables copy ancestor columns, relationships fan out', () => {
  const pm = compilePhysicalModel(community(), { dbms: 'POSTGRESQL', subtypeStrategy: 'ROLL_DOWN', dictionary: dict });
  const names = pm.tables.map((t) => t.entity);
  assert.ok(!names.includes('회원') && names.includes('개인') && names.includes('단체') && names.includes('9월회의') && !names.includes('연중행사'));
  const indiv = pm.tables.find((t) => t.entity === '개인')!;
  assert.ok(indiv.columns.find((c) => c.logicalName === '회원번호')!.primaryKey);
  // 회원 → 회비 becomes one FK per leaf table
  assert.strictEqual(pm.foreignKeys.filter((f) => f.relationshipId === 'R02').length, 2);
});

test('physical IDENTITY: subtype tables share the supertype key', () => {
  const pm = compilePhysicalModel(community(), { dbms: 'MYSQL', subtypeStrategy: 'IDENTITY', dictionary: dict });
  const indiv = pm.tables.find((t) => t.entity === '개인')!;
  const pk = indiv.columns.filter((c) => c.primaryKey).map((c) => c.logicalName);
  assert.deepStrictEqual(pk, ['회원번호']);
  assert.ok(pm.foreignKeys.some((f) => f.relationshipId === 'subtype:개인' && f.identifying));
});

test('physical: explicit FK attributes are reused, identifying FK joins the PK, overrides apply', () => {
  const overrides = parseOverrides(`table_overrides:
  - entity_ref: 회사
    table_name: TB_COMPANY
    columns:
      - attribute_ref: 회사명
        column_name: CO_NAME
`);
  const pm = compilePhysicalModel(community(), { dbms: 'ORACLE', subtypeStrategy: 'ROLL_UP', dictionary: dict, overrides });
  assert.ok(pm.tables.some((t) => t.name === 'TB_COMPANY' && t.columns.some((c) => c.name === 'CO_NAME')));
  const dues = pm.tables.find((t) => t.entity === '회비')!;
  const fk = pm.foreignKeys.find((f) => f.relationshipId === 'R02')!;
  assert.deepStrictEqual(fk.columns, [dues.columns.find((c) => c.logicalName === '납부회원번호')!.name]);
  assert.strictEqual(dues.columns.filter((c) => c.logicalName === '납부회원번호').length, 1);
  assert.ok(dues.columns.find((c) => c.logicalName === '납부회원번호')!.primaryKey);
  // recursive relationship gets its own column
  const app = pm.tables.find((t) => t.entity === '응용분야');
  if (app) assert.ok(pm.foreignKeys.some((f) => f.table === app.name && f.refTable === app.name));
});

test('ddl: deterministic, quotes non-ASCII identifiers, lists unregistered words', () => {
  const pm = compilePhysicalModel(community(), { dbms: 'ORACLE', subtypeStrategy: 'ROLL_UP', dictionary: dict });
  const a = generateDdl(pm, { title: 'x' });
  const b = generateDdl(compilePhysicalModel(community(), { dbms: 'ORACLE', subtypeStrategy: 'ROLL_UP', dictionary: dict }), { title: 'x' });
  assert.strictEqual(a, b);
  assert.ok(pm.nonStandardWords.length > 0);
  assert.match(a, /WARNING: 표준 단어 사전에 없는 단어/);
  assert.match(a, /CREATE TABLE "TB_/); // Korean leftovers are quoted
  assert.match(a, /ALTER TABLE .* FOREIGN KEY/);
  assert.doesNotMatch(a, /DROP TABLE/);
});

test('physical diagram model: shapes keep logical names, FKs become relationships', () => {
  const pm = compilePhysicalModel(community(), { dbms: 'ORACLE', subtypeStrategy: 'ROLL_UP', dictionary: dict });
  const { model, tableNameOf } = physicalDiagramModel(pm);
  assert.ok(model.entities.some((e) => e.name === '회원'));
  assert.ok(!model.entities.some((e) => e.name === '개인'));
  assert.ok(tableNameOf.get('회원')!.startsWith('TB_MBR'));
  assert.ok(model.relationships.every((r) => model.entities.some((e) => e.name === r.parent) && model.entities.some((e) => e.name === r.child)));
});
