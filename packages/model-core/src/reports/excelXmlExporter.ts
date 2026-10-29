import type { LogicalModel } from '../types.js';

/**
 * Escapes special XML characters.
 */
function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Exports a LogicalModel to Microsoft Excel XML Spreadsheet format (.xml / .xls)
 * with styled headers, borders, and multi-sheet support natively readable by Excel.
 */
export function exportExcelXml(model: LogicalModel): string {
  const subjectArea = model.subject_area || '데이터 모델';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4B5563"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4B5563"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4B5563"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4B5563"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10"/>
  </Style>
 </Styles>
`;

  // --- WORKSHEET 1: 테이블 목록 ---
  xml += ` <Worksheet ss:Name="테이블목록">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="140"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Column ss:Width="60"/>
   <Column ss:Width="60"/>
   <Column ss:Width="280"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">No</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">주제영역</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">엔터티명(논리)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">테이블명(물리)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">분류</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Level</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">속성수</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">정의 / 설명</Data></Cell>
   </Row>
`;

  model.entities.forEach((ent, idx) => {
    xml += `   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(subjectArea)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(ent.name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(ent.physicalName || '-')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(ent.classification || ent.type)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(ent.level || '-')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${ent.attributes.length}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(ent.purpose || '')}</Data></Cell>
   </Row>
`;
  });

  xml += `  </Table>
 </Worksheet>
`;

  // --- WORKSHEET 2: 컬럼 상세 정의서 ---
  xml += ` <Worksheet ss:Name="컬럼정의서">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="130"/>
   <Column ss:Width="40"/>
   <Column ss:Width="140"/>
   <Column ss:Width="150"/>
   <Column ss:Width="110"/>
   <Column ss:Width="45"/>
   <Column ss:Width="45"/>
   <Column ss:Width="50"/>
   <Column ss:Width="80"/>
   <Column ss:Width="240"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">엔터티명</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">순번</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">속성명(논리)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">컬럼명(물리)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">도메인 / 데이터타입</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">PK</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">FK</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">필수</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">기본값</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">설명</Data></Cell>
   </Row>
`;

  model.entities.forEach((ent) => {
    ent.attributes.forEach((attr, aIdx) => {
      const isPK = attr.identifier || attr.keyType === 'PK' ? 'Y' : '';
      const isFK = attr.fk || attr.keyType === 'FK' ? 'Y' : '';
      const isReq = attr.required ? 'Y' : 'N';

      xml += `   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(ent.name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${aIdx + 1}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(attr.name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(attr.physicalName || '-')}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(attr.domain || '-')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${isPK}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${isFK}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${isReq}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(attr.defaultValue || '')}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(attr.description || '')}</Data></Cell>
   </Row>
`;
    });
  });

  xml += `  </Table>
 </Worksheet>
`;

  // --- WORKSHEET 3: 관계 목록 ---
  xml += ` <Worksheet ss:Name="관계정의서">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="60"/>
   <Column ss:Width="120"/>
   <Column ss:Width="260"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">관계 ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">부모 엔터티</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">자식 엔터티</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">카디널리티</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">참여도</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">식별</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">외래키(FK) 속성</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Barker 관계문</Data></Cell>
   </Row>
`;

  model.relationships.forEach((rel) => {
    xml += `   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(rel.id)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(rel.parent)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(rel.child)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(rel.cardinality)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(rel.parent_participation)} : ${escapeXml(rel.child_participation)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${rel.identifying ? 'Y' : 'N'}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(rel.fk_attributes?.join(', ') || '-')}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(rel.barker_sentence || '')}</Data></Cell>
   </Row>
`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}
