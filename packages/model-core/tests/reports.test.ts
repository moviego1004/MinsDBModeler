import { test } from 'node:test';
import assert from 'node:assert';
import { exportExcelXml, exportMarkdownReport } from '../src/reports/index.js';
import type { LogicalModel } from '../src/types.js';

test('reports: exportExcelXml generates multi-sheet XML spreadsheet', () => {
  const model: LogicalModel = {
    subject_area: '회원관리',
    entities: [
      {
        name: '회원',
        physicalName: 'TB_MEMBER',
        classification: 'KEY',
        type: 'entity',
        identifier: '회원번호',
        purpose: '서비스 이용 고객',
        attributes: [
          { name: '회원번호', physicalName: 'MEMBER_NO', domain: '식별번호', required: true, identifier: true },
          { name: '회원명', physicalName: 'MEMBER_NM', domain: '성명', required: true },
        ],
      },
    ],
    relationships: [],
  };

  const xml = exportExcelXml(model);
  assert.ok(xml.includes('urn:schemas-microsoft-com:office:spreadsheet'));
  assert.ok(xml.includes('ss:Name="테이블목록"'));
  assert.ok(xml.includes('ss:Name="컬럼정의서"'));
  assert.ok(xml.includes('TB_MEMBER'));
  assert.ok(xml.includes('MEMBER_NO'));
});

test('reports: exportMarkdownReport generates formatted markdown', () => {
  const model: LogicalModel = {
    subject_area: '회원관리',
    entities: [
      {
        name: '회원',
        physicalName: 'TB_MEMBER',
        type: 'entity',
        identifier: '회원번호',
        attributes: [
          { name: '회원번호', physicalName: 'MEMBER_NO', domain: '식별번호', required: true, identifier: true },
        ],
      },
    ],
    relationships: [],
  };

  const md = exportMarkdownReport(model);
  assert.ok(md.includes('# 회원관리 데이터 모델 명세서'));
  assert.ok(md.includes('| **회원** | `TB_MEMBER` |'));
});
