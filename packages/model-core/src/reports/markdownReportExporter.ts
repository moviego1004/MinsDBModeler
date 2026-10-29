import type { LogicalModel } from '../types.js';

/**
 * Exports a LogicalModel to a complete Markdown Table & Column Specification Report.
 */
export function exportMarkdownReport(model: LogicalModel): string {
  const lines: string[] = [];
  const subjectArea = model.subject_area || '데이터 모델';

  lines.push(`# ${subjectArea} 데이터 모델 명세서`);
  lines.push('');
  lines.push(`- **버전:** ${model.version || '1.0.0'}`);
  lines.push(`- **상태:** ${model.status || 'draft'}`);
  lines.push(`- **표기법:** ${model.notation || 'Barker logical model'}`);
  lines.push('');

  // 1. Table Overview
  lines.push('## 1. 엔터티 및 테이블 목록');
  lines.push('');
  lines.push('| No | 엔터티명 (논리) | 테이블명 (물리) | 유형 | 분류 | 속성 수 | 설명 |');
  lines.push('| :---: | :--- | :--- | :---: | :---: | :---: | :--- |');

  model.entities.forEach((ent, idx) => {
    lines.push(
      `| ${idx + 1} | **${ent.name}** | \`${ent.physicalName || '-'}\` | ${ent.type} | ${ent.classification || '-'} | ${ent.attributes.length} | ${ent.purpose || '-'} |`
    );
  });
  lines.push('');

  // 2. Detailed Column Specifications
  lines.push('## 2. 엔터티별 속성 및 컬럼 상세 정의');
  lines.push('');

  model.entities.forEach((ent) => {
    lines.push(`### 2.${model.entities.indexOf(ent) + 1} ${ent.name} (${ent.physicalName || ent.name})`);
    if (ent.purpose) {
      lines.push(`> ${ent.purpose}`);
      lines.push('');
    }

    lines.push('| 순번 | 속성명 (논리) | 컬럼명 (물리) | 도메인 | PK | FK | 필수 | 기본값 | 비고 |');
    lines.push('| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |');

    ent.attributes.forEach((attr, idx) => {
      const isPK = attr.identifier || attr.keyType === 'PK' ? '✓' : '';
      const isFK = attr.fk || attr.keyType === 'FK' ? '✓' : '';
      const isReq = attr.required ? '✓' : '';

      lines.push(
        `| ${idx + 1} | ${attr.name} | \`${attr.physicalName || '-'}\` | ${attr.domain || '-'} | ${isPK} | ${isFK} | ${isReq} | ${attr.defaultValue || '-'} | ${attr.description || '-'} |`
      );
    });
    lines.push('');
  });

  // 3. Relationships
  if (model.relationships?.length) {
    lines.push('## 3. 관계 정의서 (Relationships)');
    lines.push('');
    lines.push('| ID | 부모 엔터티 | 자식 엔터티 | 카디널리티 | 참여도 | 식별 | 외래키 속성 | Barker 문장 |');
    lines.push('| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :--- |');

    model.relationships.forEach((rel) => {
      lines.push(
        `| ${rel.id} | ${rel.parent} | ${rel.child} | ${rel.cardinality} | ${rel.parent_participation}:${rel.child_participation} | ${rel.identifying ? '식별' : '비식별'} | ${rel.fk_attributes?.join(', ') || '-'} | ${rel.barker_sentence || '-'} |`
      );
    });
    lines.push('');
  }

  return lines.join('\n');
}
