import { useState, useMemo } from 'react';
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Download, 
  Plus,
  Save
} from 'lucide-react';
import { 
  getDictionary, 
  saveDictionary, 
  translateLogicalName, 
  resolveDataType 
} from '../services/dictionaryStorage.js';
import type { StandardizationDictionary } from '../services/dictionaryStorage.js';
import type { LogicalModel, Entity, Relationship } from '@barker-modeler/model-core';
import { parseModel } from '@barker-modeler/model-core';
import { parse as yamlParse } from 'yaml';

interface PhysicalTransformWizardProps {
  model: LogicalModel;
  projectFiles: any[];
  activeFileName: string;
  onClose: () => void;
  onSavePhysicalFile: (filename: string, content: string) => void;
}

export default function PhysicalTransformWizard({
  model,
  projectFiles,
  activeFileName,
  onClose,
  onSavePhysicalFile
}: PhysicalTransformWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dbType, setDbType] = useState<'ORACLE' | 'POSTGRES' | 'MYSQL'>('ORACLE');
  const [subtypeStrategy, setSubtypeStrategy] = useState<'ROLL_UP' | 'ROLL_DOWN' | 'IDENTITY'>('ROLL_UP');
  const [namingCase, setNamingCase] = useState<'UPPER' | 'CAMEL'>('UPPER');
  const [transformScope, setTransformScope] = useState<'PROJECT' | 'FILE'>('PROJECT');
  
  const [dict, setDict] = useState<StandardizationDictionary>(() => {
    const dictionaryFile = projectFiles.find(f => f.name === 'standardization/dictionary.yaml');
    const domainsFile = projectFiles.find(f => f.name === 'standardization/domains.yaml');
    
    if (dictionaryFile || domainsFile) {
      try {
        const dictYaml = dictionaryFile ? yamlParse(dictionaryFile.content) as any : {};
        const domainsYaml = domainsFile ? yamlParse(domainsFile.content) as any : {};
        
        const words = Array.isArray(dictYaml.words) 
          ? dictYaml.words.map((w: any) => ({
              logicalName: w.logicalName || w.logical || '',
              physicalAbbr: w.physicalAbbr || w.physical || ''
            }))
          : [];

        const terms = Array.isArray(dictYaml.terms)
          ? dictYaml.terms.map((t: any) => ({
              logicalName: t.logicalName || t.logical || '',
              physicalName: t.physicalName || t.physical || ''
            }))
          : [];

        const domains = Array.isArray(domainsYaml.domains)
          ? domainsYaml.domains.map((d: any) => ({
              logicalName: d.logicalName || d.logical || d.name || '',
              physicalName: d.physicalName || d.physical || d.type || ''
            }))
          : [];

        return {
          domains,
          words,
          terms,
          codes: dictYaml.codes || []
        };
      } catch (e) {
        console.error('Failed to parse project dictionary files, using global dictionary', e);
      }
    }
    return getDictionary();
  });
  const [newWordsMap, setNewWordsMap] = useState<Record<string, string>>({});

  // Gather all entities defined in logical model files (exclude conceptual files)
  const allProjectEntities = useMemo(() => {
    const entities: Entity[] = [];
    const addedNames = new Set<string>();
    projectFiles.forEach((f: any) => {
      if (f.name.startsWith('conceptual/') || !f.name.endsWith('.yaml')) {
        return;
      }
      try {
        const parsed = parseModel(f.content);
        (parsed.entities || []).forEach(ent => {
          if (ent && ent.name && !addedNames.has(ent.name)) {
            entities.push(ent);
            addedNames.add(ent.name);
          }
        });
      } catch (e) {
        // ignore
      }
    });
    return entities;
  }, [projectFiles]);

  // Gather all relationships defined in logical model files (exclude conceptual files)
  const allProjectRelationships = useMemo(() => {
    const list: Relationship[] = [];
    const addedIds = new Set<string>();
    projectFiles.forEach((f: any) => {
      if (f.name.startsWith('conceptual/') || !f.name.endsWith('.yaml')) {
        return;
      }
      try {
        const parsed = parseModel(f.content);
        (parsed.relationships || []).forEach(rel => {
          if (rel && rel.id && !addedIds.has(rel.id)) {
            list.push(rel);
            addedIds.add(rel.id);
          }
        });
      } catch (e) {
        // ignore
      }
    });
    return list;
  }, [projectFiles]);

  // 1. Scan model for non-standard words
  const nonStandardWordsResult = useMemo(() => {
    const wordSet = new Set<string>();
    const targetEntities = transformScope === 'PROJECT' ? allProjectEntities : (model?.entities || []);
    
    // Scan all Entity names
    targetEntities.forEach(ent => {
      if (!ent || !ent.name) return;
      const res = translateLogicalName(ent.name, dict, namingCase);
      (res.nonStandardWords || []).forEach(w => wordSet.add(w));
      
      // Scan all Attribute names
      (ent.attributes || []).forEach(attr => {
        if (!attr || !attr.name) return;
        const aRes = translateLogicalName(attr.name, dict, namingCase);
        (aRes.nonStandardWords || []).forEach(w => wordSet.add(w));
      });
    });

    return Array.from(wordSet);
  }, [model, dict, namingCase, transformScope, allProjectEntities]);

  // Handle registering a new standard word from the wizard directly
  const handleRegisterWord = (korean: string) => {
    const abbr = newWordsMap[korean]?.trim().toUpperCase();
    if (!abbr) {
      alert('영문 약어를 입력해 주세요.');
      return;
    }
    
    const updatedDict = {
      ...dict,
      words: [...(dict?.words || []), { logicalName: korean, physicalAbbr: abbr }]
    };
    setDict(updatedDict);
    saveDictionary(updatedDict);
    
    // Clear from form state
    setNewWordsMap(prev => {
      const copy = { ...prev };
      delete copy[korean];
      return copy;
    });
  };

  // 2. Perform the physical model conversion and generate SQL DDL & Physical YAML
  const physicalResult = useMemo(() => {
    if (nonStandardWordsResult.length > 0) return null;

    // Helper map to quickly find parent entities across the entire project
    const entityMap = new Map<string, Entity>();
    allProjectEntities.forEach(ent => {
      if (ent && ent.name) {
        entityMap.set(ent.name, ent);
      }
    });

    // Map parent to children subtypes project-wide
    const parentToSubtypes = new Map<string, string[]>();
    allProjectEntities.forEach(ent => {
      if (ent && ent.name && ent.supertype) {
        const list = parentToSubtypes.get(ent.supertype) || [];
        list.push(ent.name);
        parentToSubtypes.set(ent.supertype, list);
      }
    });

    // Determine tables to create based on subtype strategy and transform scope
    const targetEntities = transformScope === 'PROJECT' ? allProjectEntities : (model?.entities || []);

    const tables: Array<{
      logicalName: string;
      tableName: string;
      columns: Array<{
        logicalName: string;
        columnName: string;
        dataType: string;
        primaryKey: boolean;
        nullable: boolean;
        foreignKey?: boolean;
        refTable?: string;
        refColumn?: string;
        description?: string;
      }>;
      purpose?: string;
    }> = [];

    // Map Logical Entity Name -> Physical Table Name for all project entities
    const entityToTable = new Map<string, string>();
    allProjectEntities.forEach(ent => {
      if (ent && ent.name) {
        let pTable = translateLogicalName(ent.name, dict, namingCase).physicalName;
        // Prepend TB_ for cleaner database tables (classic professional standard)
        pTable = `TB_${pTable}`;
        entityToTable.set(ent.name, pTable);
      }
    });

    // Helper to resolve parent columns recursively for ROLL_DOWN
    const getAncestorColumns = (entName: string): any[] => {
      const cols: any[] = [];
      let current = entityMap.get(entName);
      while (current && current.supertype) {
        const parent = entityMap.get(current.supertype);
        if (parent) {
          (parent.attributes || []).forEach(attr => {
            const pCol = translateLogicalName(attr.name, dict, namingCase).physicalName;
            const pType = resolveDataType(attr.domain, attr.name, dbType, dict);
            cols.push({
              logicalName: attr.name,
              columnName: pCol,
              dataType: pType,
              primaryKey: parent.identifier === attr.name || (Array.isArray(parent.identifier) && parent.identifier.includes(attr.name)),
              nullable: !attr.required,
              description: attr.description
            });
          });
          current = parent;
        } else {
          break;
        }
      }
      return cols;
    };

    // Compile physical tables
    targetEntities.forEach(ent => {
      const isSubtype = !!ent.supertype;
      const childSubtypes = parentToSubtypes.get(ent.name) || [];
      const isSupertype = childSubtypes.length > 0;

      // Skip rules depending on strategy
      if (subtypeStrategy === 'ROLL_UP' && isSubtype) {
        // Subtype columns will be merged into supertype table, skip generating table for subtype
        return;
      }
      if (subtypeStrategy === 'ROLL_DOWN' && isSupertype) {
        // Supertype columns are copied down, skip generating table for supertype
        return;
      }

      const columns: any[] = [];
      const tblName = entityToTable.get(ent.name) || ent.name;

      // 1. Copy parent columns down if ROLL_DOWN
      if (subtypeStrategy === 'ROLL_DOWN' && isSubtype) {
        const ancestorCols = getAncestorColumns(ent.name);
        ancestorCols.forEach(ac => {
          columns.push({ ...ac });
        });
      }

      // 2. Add local attributes
      (ent.attributes || []).forEach(attr => {
        const pCol = translateLogicalName(attr.name, dict, namingCase).physicalName;
        const pType = resolveDataType(attr.domain, attr.name, dbType, dict);
        columns.push({
          logicalName: attr.name,
          columnName: pCol,
          dataType: pType,
          primaryKey: ent.identifier === attr.name || (Array.isArray(ent.identifier) && ent.identifier.includes(attr.name)),
          nullable: !attr.required,
          description: attr.description
        });
      });

      // 3. If ROLL_UP and it is a supertype, merge all subtypes' attributes into this table!
      if (subtypeStrategy === 'ROLL_UP' && isSupertype) {
        // Gather all nested subtypes recursively
        const gatherAllSubtypes = (pName: string): string[] => {
          let list: string[] = [];
          const children = parentToSubtypes.get(pName) || [];
          children.forEach(c => {
            list.push(c);
            list = list.concat(gatherAllSubtypes(c));
          });
          return list;
        };

        const allSubtypes = gatherAllSubtypes(ent.name);
        allSubtypes.forEach(subName => {
          const subEnt = entityMap.get(subName);
          if (subEnt) {
            (subEnt.attributes || []).forEach(attr => {
              // Avoid duplicate column names if already defined
              const pCol = translateLogicalName(attr.name, dict, namingCase).physicalName;
              if (columns.some(c => c.columnName === pCol)) return;

              const pType = resolveDataType(attr.domain, attr.name, dbType, dict);
              columns.push({
                logicalName: `${subName}.${attr.name}`,
                columnName: pCol,
                dataType: pType,
                primaryKey: false,
                nullable: true, // Subtype attributes are always optional in a rolled-up single table
                description: `[Subtype: ${subName}] ${attr.description || ''}`
              });
            });
          }
        });

        // Add a Discriminator Column
        const discName = ent.discriminator || '신청유형코드';
        const discColName = translateLogicalName(discName, dict, namingCase).physicalName;
        const discDataType = resolveDataType('코드', discName, dbType, dict);
        if (!columns.some(c => c.columnName === discColName)) {
          columns.push({
            logicalName: `${discName} (구분용)`,
            columnName: discColName,
            dataType: discDataType,
            primaryKey: false,
            nullable: false,
            description: `서브타입 판별용 구분 코드 (${allSubtypes.join(', ')})`
          });
        }
      }

      // 4. If IDENTITY and it is a subtype, add a PK column that is also a Foreign Key referencing the supertype PK!
      if (subtypeStrategy === 'IDENTITY' && isSubtype && ent.supertype) {
        const parentEnt = entityMap.get(ent.supertype);
        if (parentEnt) {
          const pParentTable = entityToTable.get(ent.supertype) || ent.supertype;
          
          // Assuming single primary key
          const parentPkName = Array.isArray(parentEnt.identifier) ? parentEnt.identifier[0] : parentEnt.identifier;
          if (parentPkName) {
            const pParentPkCol = translateLogicalName(parentPkName, dict, namingCase).physicalName;
            const pParentPkType = resolveDataType((parentEnt.attributes || []).find(a => a.name === parentPkName)?.domain, parentPkName, dbType, dict);

            // Force the PK column to be the primary key and foreign key referencing supertype
            const existingPkIdx = columns.findIndex(c => c.primaryKey);
            if (existingPkIdx !== -1) {
              columns[existingPkIdx].foreignKey = true;
              columns[existingPkIdx].refTable = pParentTable;
              columns[existingPkIdx].refColumn = pParentPkCol;
            } else {
              columns.unshift({
                logicalName: parentPkName,
                columnName: pParentPkCol,
                dataType: pParentPkType,
                primaryKey: true,
                nullable: false,
                foreignKey: true,
                refTable: pParentTable,
                refColumn: pParentPkCol,
                description: `[IDENTITY PK/FK] ${parentEnt.name} 테이블 참조`
              });
            }
          }
        }
      }

      tables.push({
        logicalName: ent.name,
        tableName: tblName,
        columns,
        purpose: ent.purpose || ent.name
      });
    });

    // 5. Build Foreign Keys from Logical Relationships
    const foreignKeyAlterStatements: string[] = [];
    const targetRelationships = transformScope === 'PROJECT' ? allProjectRelationships : model.relationships;
    targetRelationships.forEach(rel => {
      const parentEnt = entityMap.get(rel.parent);
      const childEnt = entityMap.get(rel.child);
      if (!parentEnt || !childEnt) return;

      // Determine where the FK goes based on Subtype strategies
      let parentPhysTable = entityToTable.get(rel.parent);
      let childPhysTable = entityToTable.get(rel.child);

      if (subtypeStrategy === 'ROLL_UP') {
        // If parent or child are subtypes, they were rolled up to their root supertypes
        const getRootSupertype = (entName: string): string => {
          let curr = entityMap.get(entName);
          while (curr && curr.supertype) {
            curr = entityMap.get(curr.supertype);
          }
          return curr ? curr.name : entName;
        };
        parentPhysTable = entityToTable.get(getRootSupertype(rel.parent));
        childPhysTable = entityToTable.get(getRootSupertype(rel.child));
      } else if (subtypeStrategy === 'ROLL_DOWN') {
        // If parent is rolled down, we skip FK to parent (or it duplicates per child subtype table)
        if (parentToSubtypes.get(rel.parent)) {
          // Parent is a supertype, which is not created. We replicate the relationship for each child subtype table
          const children = parentToSubtypes.get(rel.parent) || [];
          children.forEach(cSubName => {
            const pSubTable = entityToTable.get(cSubName);
            const cTable = entityToTable.get(rel.child);
            if (pSubTable && cTable && pSubTable !== cTable) {
              addFkColumnsAndStatements(cSubName, rel.child, pSubTable, cTable, rel.id);
            }
          });
          return;
        }
      }

      if (parentPhysTable && childPhysTable && parentPhysTable !== childPhysTable) {
        addFkColumnsAndStatements(rel.parent, rel.child, parentPhysTable, childPhysTable, rel.id);
      }
    });

    function addFkColumnsAndStatements(
      parentLogName: string,
      _childLogName: string,
      pPhysTable: string,
      cPhysTable: string,
      _relId: string
    ) {
      const parentEnt = entityMap.get(parentLogName);
      const childTableObj = tables.find(t => t.tableName === cPhysTable);
      if (!parentEnt || !childTableObj) return;

      // Extract parent's PK column details
      const parentPkAttr = Array.isArray(parentEnt.identifier) ? parentEnt.identifier[0] : parentEnt.identifier;
      if (!parentPkAttr) return;

      const pParentPkCol = translateLogicalName(parentPkAttr, dict, namingCase).physicalName;
      const pParentPkType = resolveDataType((parentEnt.attributes || []).find(a => a.name === parentPkAttr)?.domain, parentPkAttr, dbType, dict);

      // Check if FK column already exists in child table
      let fkColName = pParentPkCol;
      // If parent key is generic (e.g. ID, NO), prefix it with parent abbreviation to avoid collisions
      if (pParentPkCol === 'ID' || pParentPkCol === 'NO' || pParentPkCol === 'CD') {
        const parentAbbr = translateLogicalName(parentLogName, dict, namingCase).physicalName;
        fkColName = `${parentAbbr}_${pParentPkCol}`;
      }

      // Add to child columns if not present
      if (!childTableObj.columns.some(c => c.columnName === fkColName)) {
        childTableObj.columns.push({
          logicalName: `${parentLogName}.${parentPkAttr} (FK)`,
          columnName: fkColName,
          dataType: pParentPkType,
          primaryKey: false,
          nullable: true, // FK columns can be nullable depending on relationship participation
          foreignKey: true,
          refTable: pPhysTable,
          refColumn: pParentPkCol,
          description: `[FK] ${parentLogName} 참조`
        });
      }

      // Build ALTER TABLE constraint statement
      const fkName = `FK_${cPhysTable.replace('TB_', '')}_${pPhysTable.replace('TB_', '')}`;
      const statement = `ALTER TABLE ${cPhysTable} ADD CONSTRAINT ${fkName} FOREIGN KEY (${fkColName}) REFERENCES ${pPhysTable} (${pParentPkCol});`;
      if (!foreignKeyAlterStatements.includes(statement)) {
        foreignKeyAlterStatements.push(statement);
      }
    }

    // 6. Generate DDL script text
    let ddl = `-- MinsDBModeler Generated DDL for ${dbType}\n`;
    ddl += `-- Generated At: ${new Date().toISOString()}\n`;
    ddl += `-- Notation: Barker logical model -> Relational Physical Model\n`;
    ddl += `-- Subtype Strategy: ${subtypeStrategy}\n\n`;

    // Drop table statements for clean execution
    tables.forEach(t => {
      ddl += `DROP TABLE ${t.tableName} CASCADE CONSTRAINTS;\n`;
    });
    ddl += `\n`;

    // Create table statements
    tables.forEach(t => {
      ddl += `-- Table: ${t.tableName} (${t.logicalName})\n`;
      ddl += `CREATE TABLE ${t.tableName} (\n`;

      const colDefs = t.columns.map(c => {
        let def = `  ${c.columnName} ${c.dataType}`;
        if (!c.nullable) {
          def += ' NOT NULL';
        }
        return def;
      });

      // PK Constraint
      const pkCols = t.columns.filter(c => c.primaryKey).map(c => c.columnName);
      if (pkCols.length > 0) {
        colDefs.push(`  CONSTRAINT PK_${t.tableName.replace('TB_', '')} PRIMARY KEY (${pkCols.join(', ')})`);
      }

      ddl += colDefs.join(',\n') + '\n';
      
      // MySQL Table Comment
      if (dbType === 'MYSQL') {
        ddl += `) COMMENT = '${t.logicalName} - ${t.purpose || ''}';\n\n`;
      } else {
        ddl += `);\n\n`;
      }

      // Comments for Oracle / Postgres
      if (dbType === 'ORACLE' || dbType === 'POSTGRES') {
        ddl += `COMMENT ON TABLE ${t.tableName} IS '${t.logicalName} - ${t.purpose || ''}';\n`;
        t.columns.forEach(c => {
          if (c.description || c.logicalName) {
            ddl += `COMMENT ON COLUMN ${t.tableName}.${c.columnName} IS '${c.logicalName} - ${c.description || ''}';\n`;
          }
        });
        ddl += `\n`;
      }
    });

    // Append Foreign Key ALTER statements
    if (foreignKeyAlterStatements.length > 0) {
      ddl += `-- Foreign Key Constraints\n`;
      foreignKeyAlterStatements.forEach(stmt => {
        ddl += `${stmt}\n`;
      });
    }

    const yamlString = `-- Physical Model Specifications\n` + 
      `db_type: ${dbType}\n` +
      `subtype_strategy: ${subtypeStrategy}\n` +
      `tables:\n` +
      tables.map(t => 
        `  - name: ${t.tableName}\n` +
        `    logical_name: ${t.logicalName}\n` +
        `    columns:\n` +
        t.columns.map(c => 
          `      - name: ${c.columnName}\n` +
          `        type: ${c.dataType}\n` +
          (c.primaryKey ? `        pk: true\n` : '') +
          (c.foreignKey ? `        fk: true\n` : '') +
          (c.nullable ? `        null: true\n` : '')
        ).join('')
      ).join('');

    return {
      ddl,
      yaml: yamlString,
      tablesCount: tables.length,
      columnsCount: tables.reduce((acc, t) => acc + t.columns.length, 0),
    };
  }, [model, dict, dbType, subtypeStrategy, namingCase, activeFileName, nonStandardWordsResult, transformScope, allProjectEntities, allProjectRelationships]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 성공적으로 복사되었습니다!');
  };

  const handleDownloadFile = (text: string, ext: string) => {
    const filename = activeFileName.replace('-logical.yaml', `-physical.${ext}`).replace('.yaml', `.${ext}`);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToProject = () => {
    if (!physicalResult) return;
    const yamlFilename = activeFileName.replace('-logical.yaml', '-physical.yaml').replace('.yaml', '-physical.yaml');
    onSavePhysicalFile(yamlFilename, physicalResult.yaml);
    
    const sqlFilename = activeFileName.replace('-logical.yaml', '.sql').replace('.yaml', '.sql');
    onSavePhysicalFile(sqlFilename, physicalResult.ddl);

    alert(`물리 사양서 "${yamlFilename}" 및 DDL 스크립트 "${sqlFilename}" 파일이 프로젝트에 성공적으로 추가되었습니다!`);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div 
        className="modal-content" 
        style={{ 
          width: '85%', 
          maxWidth: '900px', 
          height: '80vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '24px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={24} className="text-blue-500" />
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>논리 → 물리 모델 전환 마법사 (Physical Model Converter)</h2>
          </div>
          <button className="btn" onClick={onClose}>취소 (Cancel)</button>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step === 1 ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === 1 ? 'var(--accent-color)' : 'var(--border-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>1</span>
            <span style={{ fontWeight: step === 1 ? 'bold' : 'normal', fontSize: '0.85rem' }}>물리 스펙 설정</span>
          </div>
          <div style={{ height: '1px', width: '60px', backgroundColor: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step === 2 ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === 2 ? 'var(--accent-color)' : 'var(--border-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>2</span>
            <span style={{ fontWeight: step === 2 ? 'bold' : 'normal', fontSize: '0.85rem' }}>표준 단어 검증</span>
          </div>
          <div style={{ height: '1px', width: '60px', backgroundColor: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step === 3 ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === 3 ? 'var(--accent-color)' : 'var(--border-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>3</span>
            <span style={{ fontWeight: step === 3 ? 'bold' : 'normal', fontSize: '0.85rem' }}>물리 모델 및 DDL 생성</span>
          </div>
        </div>

        {/* Step Contents */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
          
          {/* STEP 1: SETTINGS */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>1. 대상 DBMS (Database Specification)</label>
                <select className="form-control" value={dbType} onChange={e => setDbType(e.target.value as any)}>
                  <option value="ORACLE">Oracle Database (VARCHAR2, TIMESTAMP, COMMENT ON)</option>
                  <option value="POSTGRES">PostgreSQL (VARCHAR, TIMESTAMP, COMMENT ON)</option>
                  <option value="MYSQL">MySQL (VARCHAR, DATETIME, COMMENT inline)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>2. 서브타입 물리적 전환 전략 (Subtype Mapping Strategy)</label>
                <select className="form-control" value={subtypeStrategy} onChange={e => setSubtypeStrategy(e.target.value as any)}>
                  <option value="ROLL_UP">단일 테이블 통합 전략 (Roll-up / Single Table) - 권장</option>
                  <option value="ROLL_DOWN">개별 테이블 분할 전략 (Roll-down / Subtype Tables)</option>
                  <option value="IDENTITY">1:1 관계 테이블 전략 (Identity / Super & Subtype Tables)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {subtypeStrategy === 'ROLL_UP' && '* 모든 서브타입들의 고유 속성들이 슈퍼타입 테이블 하나로 통합(NULL 허용)되며, 판별 코드가 추가됩니다.'}
                  {subtypeStrategy === 'ROLL_DOWN' && '* 슈퍼타입은 생성되지 않고, 각 서브타입이 개별 테이블이 되며 공통 속성들이 복사 이식됩니다.'}
                  {subtypeStrategy === 'IDENTITY' && '* 슈퍼타입 및 모든 서브타입들이 1:1 관계의 개별 테이블로 매핑되며, 기본키(PK)를 공유합니다.'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>3. 영문 물리명 케이스 포맷 (Naming Case Style)</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" checked={namingCase === 'UPPER'} onChange={() => setNamingCase('UPPER')} />
                    대문자 언더스코어 (SNAKE_CASE - 예: USR_NO)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" checked={namingCase === 'CAMEL'} onChange={() => setNamingCase('CAMEL')} />
                    카멜케이스 (camelCase - 예: usrNo)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>4. 물리 전환 대상 범위 (Scope of Transformation)</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" checked={transformScope === 'PROJECT'} onChange={() => setTransformScope('PROJECT')} />
                    프로젝트 전체 통합 (모든 yaml 파일을 하나의 스키마로 병합 전환)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" checked={transformScope === 'FILE'} onChange={() => setTransformScope('FILE')} />
                    현재 파일만 전환 (다른 파일의 PK/FK 관계 등은 추적하여 연동)
                  </label>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {transformScope === 'PROJECT' && `* 프로젝트 내에 정의된 총 ${allProjectEntities.length}개 엔터티와 ${allProjectRelationships.length}개 관계를 모두 병합하여 하나의 DDL로 자동 컴파일합니다.`}
                  {transformScope === 'FILE' && `* 현재 로드된 파일("${activeFileName}") 내의 ${model.entities.length}개 엔터티를 물리 테이블로 빌드합니다. 타 yaml 파일에 위치한 상위 슈퍼타입 및 외래키 참조 대상 엔터티는 자동으로 추적하여 DDL 스키마에 PK/FK로 온전히 이식합니다.`}
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: STANDARD WORDS VALIDATION */}
          {step === 2 && (
            <div>
              {nonStandardWordsResult.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle size={48} className="text-green-500" />
                  <h3 style={{ margin: 0, fontWeight: 'bold' }}>단어 표준성 검증 통과!</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    모델에 사용된 모든 단어명들이 표준 단어 사전에 올바르게 매핑되어 있습니다.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '10px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid var(--warning)', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                    <AlertTriangle className="text-yellow-500" size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#a16207' }}>
                        비표준 단어({nonStandardWordsResult.length}개) 검출됨
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        모델의 엔터티나 속성명에서 표준 단어 사전에 등록되지 않은 단어 조각들이 있습니다. 
                        영문 약어를 입력해 즉석 등록하시면 물리명이 자동으로 완전하게 추천 결합됩니다.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {nonStandardWordsResult.map((w, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '10px 16px', 
                          backgroundColor: 'rgba(255,255,255,0.02)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--warning)' }}>{w}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(미등록 단어)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ width: '150px', height: '32px', fontSize: '0.8rem' }}
                            placeholder="추천 영문 약어" 
                            value={newWordsMap[w] || ''}
                            onChange={e => setNewWordsMap(prev => ({ ...prev, [w]: e.target.value }))}
                          />
                          <button 
                            className="btn btn-primary" 
                            style={{ height: '32px', padding: '0 10px', fontSize: '0.8rem' }}
                            onClick={() => handleRegisterWord(w)}
                          >
                            <Plus size={12} /> 등록
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: OUTPUT */}
          {step === 3 && physicalResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div style={{ display: 'flex', gap: '20px', backgroundColor: 'var(--bg-sidebar)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>생성된 테이블 수</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{physicalResult.tablesCount}개</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }}></div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>생성된 컬럼 수</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{physicalResult.columnsCount}개</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }}></div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>대상 DBMS</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--warning)' }}>{dbType}</div>
                </div>
              </div>

              {/* DDL Output Panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>SQL DDL Script Output</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleCopyToClipboard(physicalResult.ddl)}>
                      <Copy size={12} /> 코드 복사
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDownloadFile(physicalResult.ddl, 'sql')}>
                      <Download size={12} /> DDL 다운로드
                    </button>
                  </div>
                </div>
                <textarea 
                  readOnly 
                  className="form-control" 
                  value={physicalResult.ddl}
                  style={{ 
                    flex: 1, 
                    fontFamily: 'Consolas, Courier New, monospace', 
                    fontSize: '0.8rem', 
                    whiteSpace: 'pre', 
                    overflow: 'auto',
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div>
            {step > 1 && (
              <button className="btn btn-secondary" onClick={() => setStep(prev => (prev - 1) as any)}>
                이전 단계 (Back)
              </button>
            )}
          </div>
          <div>
            {step === 1 && (
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                다음 단계 (단어 검증)
              </button>
            )}
            {step === 2 && (
              <button 
                className="btn btn-primary" 
                onClick={() => setStep(3)}
                disabled={nonStandardWordsResult.length > 0}
                style={{ opacity: nonStandardWordsResult.length > 0 ? 0.4 : 1, cursor: nonStandardWordsResult.length > 0 ? 'not-allowed' : 'pointer' }}
              >
                물리 DDL 추출 (Generate)
              </button>
            )}
            {step === 3 && (
              <button className="btn btn-primary" onClick={handleSaveToProject} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save size={16} /> 프로젝트 저장 및 종료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
