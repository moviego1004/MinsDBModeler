import { test } from 'node:test';
import assert from 'node:assert';
import { parseDaXml, exportDaXml, importExcelXml, exportExcelXml, parseDdl } from '../src/index.js';
import type { LogicalModel } from '../src/types.js';

test('daBridge: exportDaXml and parseDaXml round-trip', () => {
  const model: LogicalModel = {
    subject_area: '공통관리시스템',
    notation: 'Barker',
    entities: [
      {
        id: 'ent_USER',
        name: '사용자',
        physicalName: 'TB_USER',
        classification: 'KEY',
        purpose: '전사 사용자 계정 정보',
        type: 'entity',
        identifier: ['사용자ID'],
        attributes: [
          {
            id: 'att_USER_ID',
            name: '사용자ID',
            physicalName: 'USER_ID',
            domain: 'VARCHAR(50)',
            required: true,
            identifier: true,
            keyType: 'PK'
          },
          {
            id: 'att_USER_NM',
            name: '사용자명',
            physicalName: 'USER_NM',
            domain: 'VARCHAR(100)',
            required: true,
            keyType: 'NORMAL'
          }
        ]
      },
      {
        id: 'ent_ORDER',
        name: '주문',
        physicalName: 'TB_ORDER',
        classification: 'ACTION',
        type: 'entity',
        identifier: ['주문번호'],
        attributes: [
          {
            id: 'att_ORDER_NO',
            name: '주문번호',
            physicalName: 'ORDER_NO',
            domain: 'VARCHAR(20)',
            required: true,
            identifier: true,
            keyType: 'PK'
          },
          {
            id: 'att_ORDER_USER_ID',
            name: '사용자ID',
            physicalName: 'USER_ID',
            domain: 'VARCHAR(50)',
            required: true,
            keyType: 'FK',
            fk: true
          }
        ]
      }
    ],
    relationships: [
      {
        id: 'R_USER_ORDER',
        name: 'R_사용자_주문',
        parent: '사용자',
        child: '주문',
        cardinality: 'one_to_many',
        identifying: false
      }
    ]
  };

  // 1. Export to DA# compatible ERwin XML
  const xml = exportDaXml(model);
  assert.ok(xml.includes('<Model name="공통관리시스템"'), 'XML should contain model name');
  assert.ok(xml.includes('Physical_Name="TB_USER"'), 'XML should contain physical name');
  assert.ok(xml.includes('Classification="KEY"'), 'XML should contain DA# classification');
  assert.ok(xml.includes('Parent_Entity="사용자"'), 'XML should contain relationship');

  // 2. Parse back
  const imported = parseDaXml(xml);
  assert.strictEqual(imported.entities.length, 2);
  assert.strictEqual(imported.relationships.length, 1);

  const userEnt = imported.entities.find(e => e.name === '사용자');
  assert.ok(userEnt, 'User entity should exist');
  assert.strictEqual(userEnt.physicalName, 'TB_USER');
  assert.strictEqual(userEnt.classification, 'KEY');
  assert.strictEqual(userEnt.attributes.length, 2);

  const pkCol = userEnt.attributes.find(a => a.name === '사용자ID');
  assert.ok(pkCol, 'PK attribute should exist');
  assert.strictEqual(pkCol.identifier, true);
  assert.strictEqual(pkCol.keyType, 'PK');
});

test('daBridge: importExcelXml restores model from Excel XML spreadsheet', () => {
  const model: LogicalModel = {
    subject_area: '인사관리',
    entities: [
      {
        id: 'ent_DEPT',
        name: '부서',
        physicalName: 'TB_DEPT',
        classification: 'MAIN',
        type: 'entity',
        identifier: ['부서코드'],
        attributes: [
          {
            name: '부서코드',
            physicalName: 'DEPT_CD',
            domain: 'VARCHAR(10)',
            required: true,
            identifier: true,
            keyType: 'PK'
          },
          {
            name: '부서명',
            physicalName: 'DEPT_NM',
            domain: 'VARCHAR(100)',
            required: true,
            keyType: 'NORMAL'
          }
        ]
      }
    ],
    relationships: []
  };

  const excelXml = exportExcelXml(model);
  const importedModel = importExcelXml(excelXml);

  assert.strictEqual(importedModel.entities.length, 1);
  const dept = importedModel.entities[0];
  assert.strictEqual(dept.name, '부서');
  assert.strictEqual(dept.physicalName, 'TB_DEPT');
  assert.strictEqual(dept.classification, 'MAIN');
  assert.strictEqual(dept.attributes.length, 2);
  assert.strictEqual(dept.attributes[0].identifier, true);
});

test('daBridge: parseDdl recovers Korean logical names from COMMENT ON statements', () => {
  const ddl = `
    CREATE TABLE TB_CUSTOMER (
      CUST_ID VARCHAR(20) NOT NULL,
      CUST_NM VARCHAR(100) NOT NULL,
      PRIMARY KEY (CUST_ID)
    );

    COMMENT ON TABLE TB_CUSTOMER IS '고객';
    COMMENT ON COLUMN TB_CUSTOMER.CUST_ID IS '고객번호';
    COMMENT ON COLUMN TB_CUSTOMER.CUST_NM IS '고객명';

    CREATE TABLE TB_CONTRACT (
      CNTR_NO VARCHAR(20) NOT NULL,
      CUST_ID VARCHAR(20) NOT NULL,
      PRIMARY KEY (CNTR_NO)
    );

    COMMENT ON TABLE TB_CONTRACT IS '계약';
    COMMENT ON COLUMN TB_CONTRACT.CNTR_NO IS '계약번호';
    COMMENT ON COLUMN TB_CONTRACT.CUST_ID IS '고객번호';

    ALTER TABLE TB_CONTRACT ADD CONSTRAINT FK_CNTR_CUST FOREIGN KEY (CUST_ID) REFERENCES TB_CUSTOMER (CUST_ID);
  `;

  const model = parseDdl(ddl);
  assert.strictEqual(model.entities.length, 2);

  const cust = model.entities.find(e => e.name === '고객');
  assert.ok(cust, 'Customer entity should have Korean logical name');
  assert.strictEqual(cust.physicalName, 'TB_CUSTOMER');

  const custNo = cust.attributes.find(a => a.name === '고객번호');
  assert.ok(custNo, 'CUST_ID should be mapped to 고객번호');
  assert.strictEqual(custNo.physicalName, 'CUST_ID');
  assert.strictEqual(custNo.identifier, true);

  const cntr = model.entities.find(e => e.name === '계약');
  assert.ok(cntr, 'Contract entity should have Korean logical name');

  assert.strictEqual(model.relationships.length, 1);
  assert.strictEqual(model.relationships[0].parent, '고객');
  assert.strictEqual(model.relationships[0].child, '계약');
});
