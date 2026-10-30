import { parse as yamlParse } from 'yaml';
import type { Attribute, Entity, LogicalModel, Relationship } from '../types.js';
import type { SubtypeStrategy } from '../project/types.js';
import { buildSubtypeHierarchy } from '../rendering/subtypeHierarchy.js';
import {
  findNonStandardWords,
  resolveDataType,
  translateLogicalName,
  type DdlDialect,
  type NonStandardWordUsage,
  type StandardizationDictionary,
} from '../standards/dictionary.js';

/**
 * Logical → physical compiler.
 *
 * Pure function of (logical model, dictionary, options). The physical tab, the DDL
 * preview and the saved DDL all come from this one place, so they cannot drift apart.
 *
 * Subtype strategies (DA#: 통합 / 분리 / 1:1):
 *   ROLL_UP   — one table per subtype hierarchy (root); subtype columns become nullable,
 *               a discriminator column per subtype set is added when missing.
 *   ROLL_DOWN — one table per leaf subtype; ancestor columns are copied down.
 *               Supertypes produce no table; relationships to them fan out to every leaf.
 *   IDENTITY  — every entity is a table; a subtype table shares its supertype's PK
 *               (PK + FK to the supertype table).
 */

export type PhysicalNamingCase = 'UPPER_SNAKE' | 'LOWER_SNAKE';

export interface PhysicalColumn {
  name: string;
  logicalName: string;
  /** Logical entity the column comes from (supertype, subtype or FK parent). */
  sourceEntity: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: boolean;
  comment?: string;
}

export interface PhysicalTable {
  name: string;
  /** Logical entity this table is named after (its diagram shape). */
  entity: string;
  /** Every logical entity folded into this table (ROLL_UP). */
  entities: string[];
  logicalName: string;
  comment?: string;
  tablespace?: string;
  columns: PhysicalColumn[];
}

export interface PhysicalForeignKey {
  name: string;
  table: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  /** Source logical relationship id, or `subtype:<entity>` for IDENTITY subtype links. */
  relationshipId: string;
  identifying: boolean;
  mandatory: boolean;
}

export interface PhysicalModel {
  dbms: DdlDialect;
  strategy: SubtypeStrategy;
  tables: PhysicalTable[];
  foreignKeys: PhysicalForeignKey[];
  nonStandardWords: NonStandardWordUsage[];
  warnings: string[];
}

export interface TableOverride {
  /** Entity name or id. */
  entity: string;
  tableName?: string;
  tablespace?: string;
  columns: { attribute: string; columnName?: string; dataType?: string }[];
}

export interface CompileOptions {
  dbms: DdlDialect | 'POSTGRESQL';
  subtypeStrategy: SubtypeStrategy;
  namingCase?: PhysicalNamingCase;
  dictionary: StandardizationDictionary;
  overrides?: TableOverride[];
  /** Prefix for generated table names (not applied to explicit physical names). Default "TB_". */
  tablePrefix?: string;
}

/** Reads physical/overrides.yaml (`table_overrides:` list). Unknown keys are ignored. */
export function parseOverrides(yaml: string | undefined): TableOverride[] {
  if (!yaml) return [];
  try {
    const doc: any = yamlParse(yaml) || {};
    const list = Array.isArray(doc.table_overrides) ? doc.table_overrides : [];
    return list
      .map((o: any) => ({
        entity: String(o?.entity_ref ?? o?.entity ?? '').trim(),
        tableName: o?.table_name ? String(o.table_name) : undefined,
        tablespace: o?.tablespace ? String(o.tablespace) : undefined,
        columns: (Array.isArray(o?.columns) ? o.columns : [])
          .map((c: any) => ({
            attribute: String(c?.attribute_ref ?? c?.attribute ?? '').trim(),
            columnName: c?.column_name ? String(c.column_name) : undefined,
            dataType: c?.data_type ? String(c.data_type) : undefined,
          }))
          .filter((c: any) => c.attribute),
      }))
      .filter((o: TableOverride) => o.entity);
  } catch {
    return [];
  }
}

const identifierList = (e: Entity): string[] => {
  const ids = Array.isArray(e.identifier) ? e.identifier : e.identifier ? [e.identifier] : [];
  const flagged = (e.attributes || []).filter((a) => a.identifier || a.keyType === 'PK').map((a) => a.name);
  return [...new Set([...ids.filter(Boolean), ...flagged])];
};

/**
 * Pairs the parent's PK attributes with the child's FK attribute names listed on the
 * relationship: same name first, then a suffix match (답변문항보기번호 ↔ 보기번호),
 * then position when the remaining counts agree. Unpaired PK attributes get undefined
 * (the compiler then reuses a same-named child column or migrates a new one).
 */
export function pairForeignKeyAttributes(parentKeys: string[], fkAttributes: string[]): (string | undefined)[] {
  const result: (string | undefined)[] = parentKeys.map(() => undefined);
  const free = [...fkAttributes];
  const take = (i: number, name: string) => {
    result[i] = name;
    free.splice(free.indexOf(name), 1);
  };
  parentKeys.forEach((k, i) => {
    if (free.includes(k)) take(i, k);
  });
  parentKeys.forEach((k, i) => {
    if (result[i]) return;
    const m = free.find((f) => f.endsWith(k) || k.endsWith(f));
    if (m) take(i, m);
  });
  const open = parentKeys.map((_, i) => i).filter((i) => !result[i]);
  if (open.length && open.length === free.length) open.forEach((i, n) => (result[i] = free[n]));
  return result;
}

const mandatoryChild = (r: Relationship) => /^1/.test(String(r.child_participation || ''));

export function compilePhysicalModel(model: Pick<LogicalModel, 'entities' | 'relationships' | 'subtype_sets'>, options: CompileOptions): PhysicalModel {
  const dbms: DdlDialect = options.dbms === 'POSTGRESQL' ? 'POSTGRES' : options.dbms;
  const strategy = options.subtypeStrategy;
  const dict = options.dictionary;
  const lower = options.namingCase === 'LOWER_SNAKE';
  const prefix = options.tablePrefix ?? 'TB_';
  const warnings: string[] = [];
  const caseOf = (s: string) => (lower ? s.toLowerCase() : s.toUpperCase());

  const entities = model.entities.filter((e) => e && e.name);
  const byName = new Map(entities.map((e) => [e.name, e] as const));
  const hierarchy = buildSubtypeHierarchy({ entities, subtype_sets: model.subtype_sets });
  const childrenOf = (name: string) => (hierarchy.categoriesOf.get(name) || []).flatMap((c) => c.subtypes);
  const descendantsOf = (name: string): string[] => childrenOf(name).flatMap((c) => [c, ...descendantsOf(c)]);
  const leavesOf = (name: string): string[] => {
    const kids = childrenOf(name);
    return kids.length ? kids.flatMap(leavesOf) : [name];
  };

  const overrideOf = (e: Entity) => (options.overrides || []).find((o) => o.entity === e.name || (e.id && o.entity === e.id));
  const columnOverride = (e: Entity, a: Attribute) => overrideOf(e)?.columns.find((c) => c.attribute === a.name || (a.id && c.attribute === a.id));

  const tableNameOf = (e: Entity): string => {
    const o = overrideOf(e);
    if (o?.tableName) return o.tableName;
    if (e.physicalName) return e.physicalName;
    return caseOf(prefix + translateLogicalName(e.name, dict).physicalName);
  };
  const columnNameOf = (e: Entity, a: Attribute): string => {
    const o = columnOverride(e, a);
    if (o?.columnName) return o.columnName;
    if (a.physicalName) return a.physicalName;
    return caseOf(translateLogicalName(a.name, dict).physicalName);
  };
  const dataTypeOf = (e: Entity, a: Attribute): string => columnOverride(e, a)?.dataType || resolveDataType(a.domain, a.name, dbms, dict);

  const columnFrom = (owner: Entity, a: Attribute, pk: boolean, forceNullable = false): PhysicalColumn => ({
    name: columnNameOf(owner, a),
    logicalName: a.name,
    sourceEntity: owner.name,
    dataType: dataTypeOf(owner, a),
    nullable: pk ? false : forceNullable || !a.required,
    primaryKey: pk,
    foreignKey: a.fk || a.keyType === 'FK' || undefined,
    comment: a.description,
  });

  /** PK attributes of an entity; subtypes without their own identifier use the nearest ancestor's. */
  const keyOwner = (name: string): Entity | undefined => {
    let cur = byName.get(name);
    while (cur) {
      if (identifierList(cur).length) return cur;
      const parent = hierarchy.parentOf.get(cur.name);
      cur = parent ? byName.get(parent) : undefined;
    }
    return byName.get(name);
  };
  const keyAttributes = (name: string): { owner: Entity; attrs: Attribute[] } | null => {
    const owner = keyOwner(name);
    if (!owner) return null;
    const ids = identifierList(owner);
    const attrs = ids.map((n) => owner.attributes.find((a) => a.name === n) || ({ name: n, required: true } as Attribute));
    return attrs.length ? { owner, attrs } : null;
  };

  /* ---------------------------- 1. tables ---------------------------- */
  const tables: PhysicalTable[] = [];
  const tableOfEntity = new Map<string, PhysicalTable[]>();
  const pushColumn = (t: PhysicalTable, c: PhysicalColumn) => {
    const existing = t.columns.find((x) => x.name === c.name);
    if (!existing) {
      t.columns.push(c);
      return existing;
    }
    if (existing.sourceEntity !== c.sourceEntity && existing.logicalName !== c.logicalName) {
      warnings.push(`${t.name}: 컬럼명 ${c.name} 중복 (${existing.sourceEntity}.${existing.logicalName} / ${c.sourceEntity}.${c.logicalName}) — 뒤의 것은 생략`);
    }
    return existing;
  };
  const newTable = (e: Entity, folded: string[] = [e.name]): PhysicalTable => {
    const t: PhysicalTable = {
      name: tableNameOf(e),
      entity: e.name,
      entities: folded,
      logicalName: e.name,
      comment: e.purpose,
      tablespace: overrideOf(e)?.tablespace,
      columns: [],
    };
    folded.forEach((n) => tableOfEntity.set(n, [...(tableOfEntity.get(n) || []), t]));
    tables.push(t);
    return t;
  };
  const ownColumns = (t: PhysicalTable, e: Entity, opts: { pkNames?: Set<string>; nullable?: boolean } = {}) => {
    const pk = opts.pkNames ?? new Set(identifierList(e));
    e.attributes.forEach((a) => pushColumn(t, columnFrom(e, a, pk.has(a.name), opts.nullable)));
  };

  entities.forEach((e) => {
    const isSub = hierarchy.parentOf.has(e.name);
    const hasSubs = childrenOf(e.name).length > 0;

    if (strategy === 'ROLL_UP') {
      if (isSub) return;
      const subs = descendantsOf(e.name);
      const t = newTable(e, [e.name, ...subs]);
      ownColumns(t, e);
      (hierarchy.categoriesOf.get(e.name) || []).forEach(function addCategory(cat) {
        const disc = cat.discriminator || (cat.label && cat.label !== '구분' ? cat.label : `${cat.supertype}구분코드`);
        const owner = byName.get(cat.supertype)!;
        // the discriminator is usually an attribute already ("이용자구분" ↔ "이용자구분코드")
        const existing = (n: string) => n === disc || n === `${disc}코드` || n === `${disc}값`;
        if (!t.columns.some((c) => existing(c.logicalName))) {
          const a: Attribute = owner.attributes.find((x) => existing(x.name)) || { name: disc, required: true, domain: '코드' };
          pushColumn(t, {
            ...columnFrom(owner, a, false),
            // a nested set only applies to rows of that subtype
            nullable: cat.supertype !== e.name,
            comment: `서브타입 구분 (${cat.subtypes.join(', ')})`,
          });
        }
        cat.subtypes.forEach((s) => {
          const sub = byName.get(s);
          if (!sub) return;
          sub.attributes.forEach((a) => pushColumn(t, columnFrom(sub, a, false, true)));
          (hierarchy.categoriesOf.get(s) || []).forEach(addCategory);
        });
      });
      return;
    }

    if (strategy === 'ROLL_DOWN') {
      if (hasSubs) return;
      const t = newTable(e);
      const ancestors = hierarchy.ancestorsOf(e.name).reverse(); // root first
      const key = keyAttributes(e.name);
      const pkNames = new Set(key?.attrs.map((a) => a.name) || []);
      [...ancestors.map((n) => byName.get(n)!), e].forEach((owner) => {
        if (!owner) return;
        owner.attributes.forEach((a) => pushColumn(t, columnFrom(owner, a, pkNames.has(a.name))));
      });
      // supertypes resolve to all of their leaves for relationships
      ancestors.forEach((n) => tableOfEntity.set(n, [...(tableOfEntity.get(n) || []), t]));
      return;
    }

    // IDENTITY
    const t = newTable(e);
    if (isSub) {
      const key = keyAttributes(hierarchy.parentOf.get(e.name)!);
      key?.attrs.forEach((a) => pushColumn(t, { ...columnFrom(key.owner, a, true), sourceEntity: key.owner.name, foreignKey: true }));
      ownColumns(t, e, { pkNames: new Set([...identifierList(e), ...(key?.attrs.map((a) => a.name) || [])]) });
    } else {
      ownColumns(t, e);
    }
  });

  /* ------------------------- 2. foreign keys ------------------------- */
  const foreignKeys: PhysicalForeignKey[] = [];
  const pkColumns = (t: PhysicalTable) => t.columns.filter((c) => c.primaryKey);
  const fkNames = new Set<string>();
  const uniqueFkName = (child: string, parent: string) => {
    const strip = (s: string) => s.replace(new RegExp(`^${prefix}`, 'i'), '');
    const base = caseOf(`FK_${strip(child)}_${strip(parent)}`);
    let name = base;
    for (let i = 2; fkNames.has(name.toUpperCase()); i++) name = `${base}_${i}`;
    fkNames.add(name.toUpperCase());
    return name;
  };

  const addForeignKey = (args: {
    child: PhysicalTable;
    parent: PhysicalTable;
    relId: string;
    identifying: boolean;
    mandatory: boolean;
    /** logical FK attribute names in the child, in parent-PK order */
    fkAttributes?: string[];
    recursive?: boolean;
    childOptional?: boolean;
  }) => {
    const { child, parent } = args;
    const refCols = pkColumns(parent);
    if (!refCols.length) {
      warnings.push(`${parent.name}: 기본키가 없어 ${child.name} → ${parent.name} 외래키를 만들 수 없음 (${args.relId})`);
      return;
    }
    const nullable = !args.mandatory || !!args.childOptional;
    const cols: string[] = [];
    const fkFor = pairForeignKeyAttributes(
      refCols.map((c) => c.logicalName),
      args.fkAttributes || []
    );
    refCols.forEach((ref, i) => {
      const fkLogical = fkFor[i];
      let col = fkLogical ? child.columns.find((c) => c.logicalName === fkLogical) : undefined;
      if (!col && fkLogical) {
        // FK attribute named in the relationship but not declared on the entity → materialise it
        const childEnt = byName.get(child.entity)!;
        col = {
          name: columnNameOf(childEnt, { name: fkLogical, required: !nullable } as Attribute),
          logicalName: fkLogical,
          sourceEntity: parent.entity,
          dataType: ref.dataType,
          nullable,
          primaryKey: false,
        };
        child.columns.push(col);
      }
      if (!col && !args.recursive) {
        const same = child.columns.find((c) => c.name === ref.name);
        // Reuse a same-named column (key unification across FKs, as DA# does), except when a
        // second relationship to the same parent already uses it — that one needs its own column.
        if (same && !foreignKeys.some((f) => f.table === child.name && f.refTable === parent.name && f.columns.includes(same.name))) col = same;
      }
      if (!col) {
        let name = args.recursive ? caseOf(`PRNT_${ref.name}`) : ref.name;
        if (/^(ID|NO|CD|SN|SEQ)$/i.test(name)) name = caseOf(`${parent.name.replace(new RegExp(`^${prefix}`, 'i'), '')}_${name}`);
        const base = name;
        for (let n = 2; child.columns.some((c) => c.name === name); n++) name = `${base}_${n}`;
        col = { name, logicalName: `${parent.logicalName}.${ref.logicalName}`, sourceEntity: parent.entity, dataType: ref.dataType, nullable, primaryKey: false };
        child.columns.push(col);
      }
      col.foreignKey = true;
      if (args.identifying && !args.recursive) {
        col.primaryKey = true;
        col.nullable = false;
      } else if (!col.primaryKey) {
        col.nullable = nullable;
      }
      cols.push(col.name);
    });
    const key = `${child.name}|${cols.join(',')}|${parent.name}`;
    if (foreignKeys.some((f) => `${f.table}|${f.columns.join(',')}|${f.refTable}` === key)) return;
    foreignKeys.push({
      name: uniqueFkName(child.name, parent.name),
      table: child.name,
      columns: cols,
      refTable: parent.name,
      refColumns: refCols.map((c) => c.name),
      relationshipId: args.relId,
      identifying: args.identifying,
      mandatory: !nullable,
    });
  };

  // IDENTITY: subtype → supertype
  if (strategy === 'IDENTITY') {
    hierarchy.parentOf.forEach((parent, sub) => {
      const child = tableOfEntity.get(sub)?.[0];
      const sup = tableOfEntity.get(parent)?.[0];
      if (!child || !sup) return;
      const supPk = pkColumns(sup).map((c) => c.name);
      foreignKeys.push({
        name: uniqueFkName(child.name, sup.name),
        table: child.name,
        columns: supPk,
        refTable: sup.name,
        refColumns: supPk,
        relationshipId: `subtype:${sub}`,
        identifying: true,
        mandatory: true,
      });
    });
  }

  model.relationships.forEach((r) => {
    if (!byName.has(r.parent) || !byName.has(r.child)) return;
    const recursive = r.parent === r.child || !!r.recursive;
    const parents = tableOfEntity.get(r.parent) || [];
    const children = tableOfEntity.get(r.child) || [];
    // ROLL_UP: a relationship to a subtype lands on the merged table, but only rows of that
    // subtype carry it — the FK column must stay nullable.
    const childOptional = strategy === 'ROLL_UP' && hierarchy.parentOf.has(r.child);
    if (r.cardinality === 'many_to_many') {
      warnings.push(`${r.parent} ↔ ${r.child}: 다대다 관계는 교차 엔터티로 해소해야 DDL에 반영됩니다 (${r.id})`);
      return;
    }
    parents.forEach((p) =>
      children.forEach((c) => {
        if (p === c && !recursive) return; // relationship inside one merged table
        addForeignKey({
          child: c,
          parent: p,
          relId: r.id,
          identifying: !!r.identifying,
          mandatory: mandatoryChild(r),
          fkAttributes: r.fk_attributes,
          recursive,
          childOptional,
        });
      })
    );
  });

  // PK columns first, in a stable order
  tables.forEach((t) => {
    const pk = t.columns.filter((c) => c.primaryKey);
    t.columns = [...pk, ...t.columns.filter((c) => !c.primaryKey)];
    if (!pk.length) warnings.push(`${t.name} (${t.logicalName}): 기본키 없음`);
  });

  const dupes = tables.map((t) => t.name.toUpperCase()).filter((n, i, all) => all.indexOf(n) !== i);
  [...new Set(dupes)].forEach((n) => warnings.push(`테이블명 중복: ${n} — 엔터티 물리명을 지정하세요`));

  const usedEntities = entities.filter((e) => tableOfEntity.has(e.name));
  return { dbms, strategy, tables, foreignKeys, nonStandardWords: findNonStandardWords(usedEntities, dict), warnings };
}

/* ------------------------------ DDL output ------------------------------ */

export interface DdlOptions {
  title?: string;
  includeDrop?: boolean;
  includeComments?: boolean;
}

const needsQuote = (id: string) => !/^[A-Za-z_][A-Za-z0-9_$#]*$/.test(id);

export function generateDdl(pm: PhysicalModel, options: DdlOptions = {}): string {
  const q = (id: string) => (needsQuote(id) ? (pm.dbms === 'MYSQL' ? `\`${id}\`` : `"${id}"`) : id);
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const comments = options.includeComments !== false;
  const out: string[] = [];
  out.push(`-- ${options.title || 'MinsDBModeler'} DDL (${pm.dbms}, subtype strategy: ${pm.strategy})`);
  out.push('-- Generated by MinsDBModeler from the logical model. Do not edit by hand; regenerate instead.');
  if (pm.nonStandardWords.length) {
    out.push(`-- WARNING: 표준 단어 사전에 없는 단어 ${pm.nonStandardWords.length}개 — 물리명에 원문이 그대로 쓰였습니다:`);
    out.push(`--   ${pm.nonStandardWords.slice(0, 40).map((w) => w.word).join(', ')}${pm.nonStandardWords.length > 40 ? ' …' : ''}`);
  }
  pm.warnings.slice(0, 20).forEach((w) => out.push(`-- WARNING: ${w}`));
  if (pm.warnings.length > 20) out.push(`-- WARNING: … 외 ${pm.warnings.length - 20}건 (DDL 탭의 변환 경고 참고)`);
  out.push('');

  if (options.includeDrop) {
    [...pm.tables].reverse().forEach((t) => {
      if (pm.dbms === 'ORACLE') out.push(`DROP TABLE ${q(t.name)} CASCADE CONSTRAINTS;`);
      else out.push(`DROP TABLE IF EXISTS ${q(t.name)}${pm.dbms === 'POSTGRES' ? ' CASCADE' : ''};`);
    });
    out.push('');
  }

  pm.tables.forEach((t) => {
    out.push(`-- ${t.logicalName}${t.entities.length > 1 ? ` (+ ${t.entities.slice(1).join(', ')})` : ''}`);
    out.push(`CREATE TABLE ${q(t.name)} (`);
    const defs = t.columns.map((c) => {
      let d = `  ${q(c.name)} ${c.dataType}${c.nullable ? '' : ' NOT NULL'}`;
      if (pm.dbms === 'MYSQL' && comments) d += ` COMMENT ${lit(c.logicalName + (c.comment ? ` - ${c.comment}` : ''))}`;
      return d;
    });
    const pk = t.columns.filter((c) => c.primaryKey).map((c) => q(c.name));
    if (pk.length) defs.push(`  CONSTRAINT ${q(`PK_${t.name.replace(/^TB_/i, '')}`)} PRIMARY KEY (${pk.join(', ')})`);
    out.push(defs.join(',\n'));
    const tail = [pm.dbms === 'ORACLE' && t.tablespace ? `TABLESPACE ${t.tablespace}` : '', pm.dbms === 'MYSQL' && comments ? `COMMENT = ${lit(t.logicalName)}` : '']
      .filter(Boolean)
      .join(' ');
    out.push(`)${tail ? ' ' + tail : ''};`);
    if (comments && pm.dbms !== 'MYSQL') {
      out.push(`COMMENT ON TABLE ${q(t.name)} IS ${lit(t.logicalName + (t.comment ? ` - ${t.comment}` : ''))};`);
      t.columns.forEach((c) => out.push(`COMMENT ON COLUMN ${q(t.name)}.${q(c.name)} IS ${lit(c.logicalName + (c.comment ? ` - ${c.comment}` : ''))};`));
    }
    out.push('');
  });

  if (pm.foreignKeys.length) {
    out.push('-- Foreign keys');
    pm.foreignKeys.forEach((f) =>
      out.push(
        `ALTER TABLE ${q(f.table)} ADD CONSTRAINT ${q(f.name)} FOREIGN KEY (${f.columns.map(q).join(', ')}) REFERENCES ${q(f.refTable)} (${f.refColumns.map(q).join(', ')});`
      )
    );
    out.push('');
  }
  return out.join('\n');
}

/** Physical specification (테이블/컬럼 사양) as YAML text. */
export function physicalSpecYaml(pm: PhysicalModel): string {
  const lines = [`dbms: ${pm.dbms}`, `subtype_strategy: ${pm.strategy}`, 'tables:'];
  const s = (v: string) => (/^[\w가-힣.()]+$/.test(v) ? v : JSON.stringify(v));
  pm.tables.forEach((t) => {
    lines.push(`  - name: ${s(t.name)}`, `    logical_name: ${s(t.logicalName)}`);
    if (t.entities.length > 1) lines.push(`    merged_entities: [${t.entities.map(s).join(', ')}]`);
    lines.push('    columns:');
    t.columns.forEach((c) => {
      lines.push(`      - name: ${s(c.name)}`, `        logical_name: ${s(c.logicalName)}`, `        type: ${s(c.dataType)}`);
      if (c.primaryKey) lines.push('        pk: true');
      if (c.foreignKey) lines.push('        fk: true');
      if (c.nullable) lines.push('        nullable: true');
    });
  });
  if (pm.foreignKeys.length) {
    lines.push('foreign_keys:');
    pm.foreignKeys.forEach((f) =>
      lines.push(`  - name: ${s(f.name)}`, `    table: ${s(f.table)}`, `    columns: [${f.columns.map(s).join(', ')}]`, `    ref_table: ${s(f.refTable)}`, `    ref_columns: [${f.refColumns.map(s).join(', ')}]`)
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * The physical model as a diagram model: one shape per table, named after the logical
 * entity it comes from (so diagram positions are shared with the logical view), with
 * columns as attributes and foreign keys as relationships. `tableNameOf` gives labels.
 */
export function physicalDiagramModel(pm: PhysicalModel): { model: LogicalModel; tableNameOf: Map<string, string> } {
  const tableNameOf = new Map<string, string>();
  const shapeOfTable = new Map<string, string>();
  const entities: Entity[] = pm.tables.map((t) => {
    tableNameOf.set(t.entity, t.name);
    shapeOfTable.set(t.name, t.entity);
    return {
      name: t.entity,
      type: 'entity',
      identifier: t.columns.filter((c) => c.primaryKey).map((c) => c.name),
      purpose: t.comment,
      attributes: t.columns.map((c) => ({
        name: c.name,
        domain: c.dataType,
        required: !c.nullable,
        identifier: c.primaryKey,
        keyType: c.primaryKey ? 'PK' : c.foreignKey ? 'FK' : 'NORMAL',
        fk: c.foreignKey,
        description: c.logicalName,
      })),
    };
  });
  const relationships: Relationship[] = pm.foreignKeys
    .filter((f) => shapeOfTable.has(f.table) && shapeOfTable.has(f.refTable))
    .map((f) => ({
      id: `${f.relationshipId}@${f.table}`,
      name: f.name,
      parent: shapeOfTable.get(f.refTable)!,
      child: shapeOfTable.get(f.table)!,
      cardinality: f.relationshipId.startsWith('subtype:') ? 'one_to_one' : 'one_to_many',
      parent_participation: f.relationshipId.startsWith('subtype:') ? '0..1' : '0..M',
      child_participation: f.mandatory ? '1..1' : '0..1',
      identifying: f.identifying,
      fk_attributes: f.columns,
      recursive: f.table === f.refTable || undefined,
    }));
  return { model: { subject_area: 'physical', entities, relationships }, tableNameOf };
}
