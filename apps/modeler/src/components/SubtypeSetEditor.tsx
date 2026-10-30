import { useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { buildSubtypeHierarchy } from '@barker-modeler/model-core';
import type { Entity, LogicalModel, SubtypeSetRef } from '@barker-modeler/model-core';

interface Props {
  model: LogicalModel;
  entity: Entity;
  onChange: (supertype: string, sets: SubtypeSetRef[]) => void;
}

/**
 * Edits the subtype sets (Barker categories) of one supertype: discriminator,
 * 배타/포괄 (disjoint), 완전/부분 (total) and member subtypes. Reads the merged view of
 * every notation (model-level sets, embedded sets, entity.supertype).
 */
export default function SubtypeSetEditor({ model, entity, onChange }: Props) {
  const hierarchy = useMemo(() => buildSubtypeHierarchy(model), [model]);
  const sets: SubtypeSetRef[] = (hierarchy.categoriesOf.get(entity.name) || []).map((c) => ({
    name: c.label,
    disjoint: c.disjoint,
    total: c.total,
    subtypes: [...c.subtypes],
  }));
  // The hierarchy drops sets without members; keep just-created empty sets editable.
  [...(entity.subtype_sets || []), ...(model.subtype_sets || []).filter((x) => x.supertype === entity.name)]
    .filter((x) => !(x.subtypes || []).length)
    .forEach((x) => {
      const name = ('discriminator' in x && x.discriminator) || x.name || '구분';
      if (!sets.some((y) => y.name === name)) sets.push({ name, disjoint: x.disjoint ?? true, total: x.total ?? true, subtypes: [] });
    });

  // An entity can join a set unless it is this entity, one of its ancestors, or already nested elsewhere.
  const blocked = new Set([entity.name, ...hierarchy.ancestorsOf(entity.name)]);
  const candidates = model.entities.filter((e) => !blocked.has(e.name) && (!hierarchy.parentOf.has(e.name) || hierarchy.parentOf.get(e.name) === entity.name));
  const used = new Set(sets.flatMap((s) => s.subtypes));

  const update = (i: number, patch: Partial<SubtypeSetRef>) => onChange(entity.name, sets.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const discriminatorOptions = entity.attributes.map((a) => a.name);

  if (!sets.length && entity.type !== 'supertype') {
    return (
      <div className="subtype-editor">
        <button
          className="btn"
          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
          onClick={() => onChange(entity.name, [{ name: discriminatorOptions.find((n) => /구분|유형|종류/.test(n)) || '구분', disjoint: true, total: true, subtypes: [] }])}
        >
          <Plus size={12} /> 서브타입 세트 추가 (슈퍼타입으로 만들기)
        </button>
      </div>
    );
  }

  return (
    <div className="subtype-editor">
      <div className="subtype-editor-title">
        서브타입 세트
        <button
          className="btn btn-icon"
          title="세트 추가"
          onClick={() => onChange(entity.name, [...sets, { name: `구분${sets.length + 1}`, disjoint: true, total: true, subtypes: [] }])}
        >
          <Plus size={12} />
        </button>
      </div>
      {sets.map((s, i) => (
        <div key={i} className="subtype-set">
          <div className="subtype-set-row">
            <span>구분 속성</span>
            <input className="form-control" list={`disc-${i}`} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
            <datalist id={`disc-${i}`}>
              {discriminatorOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button className="btn btn-icon" title="세트 삭제 (서브타입은 일반 엔터티가 됨)" onClick={() => onChange(entity.name, sets.filter((_, n) => n !== i))}>
              <Trash2 size={11} style={{ color: 'var(--danger)' }} />
            </button>
          </div>
          <div className="subtype-set-flags">
            <label title="한 인스턴스는 서브타입 중 하나에만 속합니다 (Barker 기본)">
              <input type="radio" checked={s.disjoint} onChange={() => update(i, { disjoint: true })} /> 배타
            </label>
            <label title="한 인스턴스가 여러 서브타입에 동시에 속할 수 있습니다 (DA# Inclusive)">
              <input type="radio" checked={!s.disjoint} onChange={() => update(i, { disjoint: false })} /> 포괄
            </label>
            <span className="subtype-set-sep" />
            <label title="모든 인스턴스가 서브타입 중 하나 이상에 속합니다">
              <input type="checkbox" checked={s.total} onChange={(e) => update(i, { total: e.target.checked })} /> 완전 (빠짐 없음)
            </label>
          </div>
          <div className="subtype-chips">
            {s.subtypes.map((name) => (
              <span key={name} className="trace-chip">
                <button>{name}</button>
                <button title="세트에서 제외" onClick={() => update(i, { subtypes: s.subtypes.filter((x) => x !== name) })}>
                  <X size={10} />
                </button>
              </span>
            ))}
            <select
              className="form-control subtype-add"
              value=""
              onChange={(e) => e.target.value && update(i, { subtypes: [...s.subtypes, e.target.value] })}
            >
              <option value="">+ 서브타입 추가…</option>
              {candidates
                .filter((c) => !used.has(c.name))
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
