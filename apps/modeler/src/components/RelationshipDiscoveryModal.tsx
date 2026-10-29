import { useState, useMemo } from 'react';
import { Network, Plus, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { autoDiscoverRelationships } from '@barker-modeler/model-core';
import type { LogicalModel, Relationship } from '@barker-modeler/model-core';

interface RelationshipDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: LogicalModel;
  onApplyRelationships: (newRels: Relationship[]) => void;
}

export default function RelationshipDiscoveryModal({
  isOpen,
  onClose,
  model,
  onApplyRelationships,
}: RelationshipDiscoveryModalProps) {
  const discoveredRelationships = useMemo(() => {
    if (!isOpen) return [];
    return autoDiscoverRelationships(model.entities, model.relationships);
  }, [isOpen, model]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Initialize all selected by default when opened
  const [lastOpened, setLastOpened] = useState(false);
  if (isOpen && !lastOpened) {
    setLastOpened(true);
    setSelectedIds(new Set(discoveredRelationships.map((r) => r.id)));
  } else if (!isOpen && lastOpened) {
    setLastOpened(false);
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(new Set(discoveredRelationships.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleApply = () => {
    const toApply = discoveredRelationships.filter((r) => selectedIds.has(r.id));
    if (toApply.length > 0) {
      onApplyRelationships(toApply);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '850px', 
          width: '90%', 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--header-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={20} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>DA# 관계 자동 찾기 (Auto-Relationship Discovery)</h2>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Info Header */}
        <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
          엔터티의 <strong>주식별자(PK)</strong>와 타 엔터티의 <strong>동일/유사 명칭 속성</strong>을 분석하여 누락된 외래키 관계선({discoveredRelationships.length}건)을 자동으로 도출했습니다.
        </div>

        {/* Toolbar */}
        <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleSelectAll(true)}>
              전체 선택
            </button>
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleSelectAll(false)}>
              전체 해제
            </button>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            선택됨: <strong>{selectedIds.size}</strong> / {discoveredRelationships.length}건
          </span>
        </div>

        {/* Discovered Relationship List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {discoveredRelationships.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <ShieldCheck size={36} color="var(--success)" style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>추가 도출 가능한 외래키 관계가 없습니다.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>모든 식별자 매칭 관계가 이미 모델에 정의되어 있습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {discoveredRelationships.map((rel) => {
                const isChecked = selectedIds.has(rel.id);
                return (
                  <label
                    key={rel.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: isChecked ? 'var(--card-bg-selected, #f0fdf4)' : 'var(--card-bg, #fff)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(rel.id)}
                    />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                      <strong style={{ color: 'var(--primary)' }}>{rel.parent}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(부모 1)</span>
                      <ArrowRight size={14} color="var(--text-muted)" />
                      <strong style={{ color: 'var(--primary)' }}>{rel.child}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(자식 M)</span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--border-color)',
                        color: 'var(--text)',
                      }}>
                        매칭 속성: <code>{rel.fk_attributes?.join(', ')}</code>
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: rel.identifying ? '#fee2e2' : '#e0f2fe',
                        color: rel.identifying ? '#dc2626' : '#0369a1',
                      }}>
                        {rel.identifying ? '식별 관계' : '비식별 관계'}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--header-bg)',
        }}>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-primary"
            disabled={selectedIds.size === 0}
            onClick={handleApply}
          >
            <Plus size={16} /> 선택한 관계 일괄 적용 ({selectedIds.size}건)
          </button>
        </div>
      </div>
    </div>
  );
}
