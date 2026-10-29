import type { LogicalModel, Entity, Relationship } from './types.js';

export type LinterCategory = 'BASIC' | 'STANDARDIZATION' | 'CONSISTENCY' | 'PHYSICAL';

export interface LinterIssue {
  id: string;
  category: LinterCategory;
  severity: 'error' | 'warning' | 'info';
  targetType: 'entity' | 'attribute' | 'relationship';
  targetName: string;
  message: string;
  remediation?: string;
}

/**
 * DA# 5-inspired 4-pillar Model Verification Engine (Linter)
 * 1. Basic (명칭 중복, 필수 누락, 고립 엔터티)
 * 2. Standardization (도메인 미지정, 물리명 누락)
 * 3. Consistency (순환 참조, 식별자 상속 누락)
 * 4. Physical (PK 누락, 대용량 컬럼)
 */
export function lintModel(model: LogicalModel): LinterIssue[] {
  const issues: LinterIssue[] = [];
  const entityMap = new Map<string, Entity>();
  const entityConnected = new Set<string>();

  // Track connected entities from relationships
  model.relationships.forEach((rel) => {
    entityConnected.add(rel.parent);
    entityConnected.add(rel.child);
  });

  // Track subtype connections
  model.entities.forEach((ent) => {
    if (ent.supertype) {
      entityConnected.add(ent.name);
      entityConnected.add(ent.supertype);
    }
    ent.subtype_sets?.forEach((set) => {
      set.subtypes.forEach((sub) => {
        entityConnected.add(sub);
        entityConnected.add(ent.name);
      });
    });
  });

  // 1. Entity & Attribute Inspection
  model.entities.forEach((ent) => {
    entityMap.set(ent.name, ent);

    // --- BASIC RULES ---
    // Rule: Orphan Entity (고립 엔터티)
    if (!entityConnected.has(ent.name) && model.entities.length > 1) {
      issues.push({
        id: `orphan_${ent.name}`,
        category: 'BASIC',
        severity: 'warning',
        targetType: 'entity',
        targetName: ent.name,
        message: `고립된 엔터티입니다. 다른 엔터티와 연결된 관계선이나 서브타입 관계가 없습니다.`,
        remediation: `관계선을 연결하거나 상위/하위 서브타입을 지정하세요.`,
      });
    }

    // Rule: Missing Primary Identifier (식별자 누락)
    const hasPK = ent.attributes.some((a) => a.identifier || a.keyType === 'PK');
    const isSubtype = ent.type === 'subtype' || !!ent.supertype;
    if (!hasPK && !isSubtype) {
      issues.push({
        id: `no_pk_${ent.name}`,
        category: 'BASIC',
        severity: 'error',
        targetType: 'entity',
        targetName: ent.name,
        message: `엔터티에 주식별자(#)가 정의되지 않았습니다.`,
        remediation: `속성 중 하나 이상을 주식별자(identifier: true)로 지정하세요.`,
      });
    }

    // Rule: Missing classification (분류 누락 - DA# 특화)
    if (!ent.classification && !isSubtype) {
      issues.push({
        id: `no_classification_${ent.name}`,
        category: 'BASIC',
        severity: 'info',
        targetType: 'entity',
        targetName: ent.name,
        message: `엔터티 발생 분류(KEY, MAIN, ACTION)가 지정되지 않았습니다.`,
        remediation: `엔터티 성격에 맞게 KEY(기본), MAIN(중심), ACTION(행위)을 지정하세요.`,
      });
    }

    // --- STANDARDIZATION RULES ---
    // Rule: Missing Physical Name for Entity
    if (!ent.physicalName && !ent.name.startsWith('TB_')) {
      issues.push({
        id: `no_pname_ent_${ent.name}`,
        category: 'STANDARDIZATION',
        severity: 'warning',
        targetType: 'entity',
        targetName: ent.name,
        message: `엔터티의 물리 테이블명(physicalName)이 정의되지 않았습니다.`,
        remediation: `표준 단어 사전을 적용하여 물리 테이블명을 부여하세요.`,
      });
    }

    // Attribute inspections
    const attrNames = new Set<string>();
    ent.attributes.forEach((attr) => {
      // Duplicate attribute name
      if (attrNames.has(attr.name)) {
        issues.push({
          id: `dup_attr_${ent.name}_${attr.name}`,
          category: 'BASIC',
          severity: 'error',
          targetType: 'attribute',
          targetName: `${ent.name}.${attr.name}`,
          message: `엔터티 내에 중복된 속성명("${attr.name}")이 존재합니다.`,
          remediation: `속성명을 유일하게 변경하세요.`,
        });
      } else {
        attrNames.add(attr.name);
      }

      // Missing domain
      if (!attr.domain) {
        issues.push({
          id: `no_domain_${ent.name}_${attr.name}`,
          category: 'STANDARDIZATION',
          severity: 'warning',
          targetType: 'attribute',
          targetName: `${ent.name}.${attr.name}`,
          message: `속성 "${attr.name}"에 표준 도메인이 지정되지 않았습니다.`,
          remediation: `표준 도메인 사전을 연결하여 데이터 타입과 길이를 표준화하세요.`,
        });
      }

      // Missing physical column name
      if (!attr.physicalName) {
        issues.push({
          id: `no_pname_attr_${ent.name}_${attr.name}`,
          category: 'STANDARDIZATION',
          severity: 'info',
          targetType: 'attribute',
          targetName: `${ent.name}.${attr.name}`,
          message: `속성 "${attr.name}"의 물리 컬럼명이 정의되지 않았습니다.`,
        });
      }
    });

    // --- PHYSICAL RULES ---
    // Rule: Too many columns
    if (ent.attributes.length > 30) {
      issues.push({
        id: `too_many_attrs_${ent.name}`,
        category: 'PHYSICAL',
        severity: 'warning',
        targetType: 'entity',
        targetName: ent.name,
        message: `속성 수가 ${ent.attributes.length}개로 과도하게 많습니다 (30개 초과).`,
        remediation: `엔터티 정규화(1차/3차)를 통해 엔터티를 분해하거나 2단 속성 배열을 검토하세요.`,
      });
    }
  });

  // 2. CONSISTENCY RULES: Circular Relationship Detection
  const circularPath = detectCircularRelationships(model.relationships);
  if (circularPath) {
    issues.push({
      id: `circular_rel`,
      category: 'CONSISTENCY',
      severity: 'error',
      targetType: 'relationship',
      targetName: circularPath.join(' -> '),
      message: `순환 참조 관계(Circular Dependency)가 발견되었습니다: ${circularPath.join(' → ')}`,
      remediation: `순환 관계 중 하나를 비식별 관계로 완화하거나 모델 구조를 정규화하세요.`,
    });
  }

  return issues;
}

/**
 * Cycle detection via DFS on relationship graph.
 */
function detectCircularRelationships(relationships: Relationship[]): string[] | null {
  const adj = new Map<string, string[]>();
  relationships.forEach((rel) => {
    if (rel.parent !== rel.child) {
      const list = adj.get(rel.parent) || [];
      list.push(rel.child);
      adj.set(rel.parent, list);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        return [...path.slice(cycleStart), neighbor];
      }
    }

    path.pop();
    recStack.delete(node);
    return null;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}
