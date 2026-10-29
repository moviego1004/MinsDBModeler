import type { Entity, Relationship } from './types.js';

export interface DiscoveryOptions {
  ignoredColumnNames?: string[];
  caseSensitive?: boolean;
}

const DEFAULT_IGNORED_NAMES = new Set([
  'ID',
  'NO',
  'NUM',
  'SEQ',
  'SERIAL',
  'REG_DT',
  'MOD_DT',
  'CREATE_DT',
  'UPDATE_DT',
  'USE_YN',
  'DEL_YN',
  'STATUS',
  'TYPE',
  'CODE',
  'NAME',
  'DESC',
  'DESCRIPTION',
  '비고',
  '등록일시',
  '수정일시',
  '사용여부',
  '삭제여부',
  '구분',
]);

/**
 * DA# 5-inspired "관계 찾기" (Auto-Relationship Discovery)
 * Infers missing FK relationships by matching PK attributes from Parent entities
 * to identically named or equivalent attributes in Child entities.
 */
export function autoDiscoverRelationships(
  entities: Entity[],
  existingRelationships: Relationship[] = [],
  options: DiscoveryOptions = {}
): Relationship[] {
  const ignored = new Set(
    (options.ignoredColumnNames || Array.from(DEFAULT_IGNORED_NAMES)).map((s) => s.toUpperCase())
  );
  const discovered: Relationship[] = [];

  // Track existing relationships to avoid duplicates
  const existingPairSet = new Set<string>();
  existingRelationships.forEach((r) => {
    existingPairSet.add(`${r.parent}::${r.child}`);
  });

  // Map each entity's primary identifiers
  interface CandidateParent {
    entity: Entity;
    pkNames: string[];
    pkPhysicalNames: string[];
  }

  const parentCandidates: CandidateParent[] = entities
    .map((ent) => {
      const pkAttrs = ent.attributes.filter((a) => a.identifier || a.keyType === 'PK');
      return {
        entity: ent,
        pkNames: pkAttrs.map((a) => a.name),
        pkPhysicalNames: pkAttrs.map((a) => a.physicalName || '').filter(Boolean),
      };
    })
    .filter((p) => p.pkNames.length > 0);

  for (const parent of parentCandidates) {
    for (const pkName of parent.pkNames) {
      const upperPk = pkName.toUpperCase();
      if (ignored.has(upperPk)) continue;

      for (const child of entities) {
        if (child.name === parent.entity.name) continue; // Skip self

        // Check if relationship already exists
        const pairKey = `${parent.entity.name}::${child.name}`;
        if (existingPairSet.has(pairKey)) continue;

        // Check if child has matching attribute
        const matchingChildAttr = child.attributes.find((attr) => {
          if (attr.name.toUpperCase() === upperPk) return true;
          // Also check physical name match if available
          if (
            attr.physicalName &&
            parent.pkPhysicalNames.includes(attr.physicalName.toUpperCase())
          ) {
            return true;
          }
          return false;
        });

        if (matchingChildAttr) {
          const isIdentifying = matchingChildAttr.identifier || matchingChildAttr.keyType === 'PK';
          const newRel: Relationship = {
            id: `rel_auto_${parent.entity.name}_${child.name}_${discovered.length + 1}`,
            name: `${parent.entity.name}_${child.name}`,
            parent: parent.entity.name,
            child: child.name,
            parent_to_child: '배치된다',
            child_to_parent: '소속된다',
            cardinality: 'one_to_many',
            parent_participation: '0..M',
            child_participation: matchingChildAttr.required ? '1..1' : '0..1',
            identifying: isIdentifying ?? false,
            fk_attributes: [matchingChildAttr.name],
            barker_sentence: `각 ${parent.entity.name}은(는) 하나 이상의 ${child.name}을(를) 가질 수 있다`,
          };

          discovered.push(newRel);
          existingPairSet.add(pairKey);
        }
      }
    }
  }

  return discovered;
}
