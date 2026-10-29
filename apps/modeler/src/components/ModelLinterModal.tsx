import { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  X, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { lintModel } from '@barker-modeler/model-core';
import type { LogicalModel, LinterCategory } from '@barker-modeler/model-core';

interface ModelLinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: LogicalModel;
  onSelectEntity: (entityName: string) => void;
}

export default function ModelLinterModal({
  isOpen,
  onClose,
  model,
  onSelectEntity,
}: ModelLinterModalProps) {
  const [activeCategory, setActiveCategory] = useState<LinterCategory | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'error' | 'warning' | 'info'>('ALL');

  const issues = useMemo(() => {
    if (!isOpen) return [];
    return lintModel(model);
  }, [isOpen, model]);

  const counts = useMemo(() => {
    return {
      all: issues.length,
      basic: issues.filter((i) => i.category === 'BASIC').length,
      standardization: issues.filter((i) => i.category === 'STANDARDIZATION').length,
      consistency: issues.filter((i) => i.category === 'CONSISTENCY').length,
      physical: issues.filter((i) => i.category === 'PHYSICAL').length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      infos: issues.filter((i) => i.severity === 'info').length,
    };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter((item) => {
      if (activeCategory !== 'ALL' && item.category !== activeCategory) return false;
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) return false;
      return true;
    });
  }, [issues, activeCategory, selectedSeverity]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '900px', 
          width: '90%', 
          maxHeight: '85vh', 
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
            <ShieldCheck size={20} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>DA# 4대 모델 검토기 (Model Linter)</h2>
            <span style={{ 
              fontSize: '0.8rem', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              backgroundColor: counts.errors > 0 ? 'var(--danger-bg, #fee2e2)' : 'var(--success-bg, #dcfce7)',
              color: counts.errors > 0 ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)',
              fontWeight: 'bold',
            }}>
              {counts.errors > 0 ? `${counts.errors}건의 오류 발생` : '무결성 검사 통과'}
            </span>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
          padding: '0 16px',
        }}>
          {[
            { id: 'ALL', label: '전체', count: counts.all },
            { id: 'BASIC', label: '기본 규칙 (Basic)', count: counts.basic },
            { id: 'STANDARDIZATION', label: '표준화 (Standard)', count: counts.standardization },
            { id: 'CONSISTENCY', label: '정합성 (Consistency)', count: counts.consistency },
            { id: 'PHYSICAL', label: '물리 규칙 (Physical)', count: counts.physical },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              style={{
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: activeCategory === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeCategory === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: activeCategory === tab.id ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '0.75rem',
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: activeCategory === tab.id ? 'var(--primary)' : 'var(--border-color)',
                color: activeCategory === tab.id ? '#fff' : 'inherit',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Severity Filter Bar */}
        <div style={{
          padding: '8px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          fontSize: '0.8rem',
          backgroundColor: 'var(--bg)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>심각도 필터:</span>
          {(['ALL', 'error', 'warning', 'info'] as const).map((sev) => (
            <label key={sev} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="severityFilter"
                checked={selectedSeverity === sev}
                onChange={() => setSelectedSeverity(sev)}
              />
              {sev === 'ALL' && `전체 (${counts.all})`}
              {sev === 'error' && <span style={{ color: '#ef4444' }}>오류 ({counts.errors})</span>}
              {sev === 'warning' && <span style={{ color: '#f59e0b' }}>경고 ({counts.warnings})</span>}
              {sev === 'info' && <span style={{ color: '#3b82f6' }}>안내 ({counts.infos})</span>}
            </label>
          ))}
        </div>

        {/* Issue List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {filteredIssues.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
            }}>
              <CheckCircle2 size={40} color="var(--success, #16a34a)" style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>해당 카테고리에서 검출된 위반 사항이 없습니다.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>모델의 데이터 무결성과 표준화 규칙이 안전하게 준수되고 있습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredIssues.map((issue) => {
                const isError = issue.severity === 'error';
                const isWarn = issue.severity === 'warning';
                const borderColor = isError ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
                const icon = isError ? (
                  <AlertCircle size={18} color="#ef4444" />
                ) : isWarn ? (
                  <AlertTriangle size={18} color="#f59e0b" />
                ) : (
                  <Info size={18} color="#3b82f6" />
                );

                return (
                  <div
                    key={issue.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${borderColor}`,
                      borderRadius: '6px',
                      padding: '12px 14px',
                      backgroundColor: 'var(--card-bg, #fff)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {icon}
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          [{issue.category}] {issue.targetName}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: isError ? '#fee2e2' : isWarn ? '#fef3c7' : '#e0f2fe',
                          color: isError ? '#dc2626' : isWarn ? '#b45309' : '#0369a1',
                          textTransform: 'uppercase',
                        }}>
                          {issue.severity}
                        </span>
                      </div>
                      {issue.targetType === 'entity' && (
                        <button
                          className="btn btn-icon"
                          title="캔버스에서 엔터티 선택"
                          style={{ padding: '2px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            onSelectEntity(issue.targetName.split('.')[0]);
                            onClose();
                          }}
                        >
                          <ExternalLink size={12} /> 이동
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '2px' }}>
                      {issue.message}
                    </div>
                    {issue.remediation && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        💡 <strong>권장 조치:</strong> {issue.remediation}
                      </div>
                    )}
                  </div>
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
          justifyContent: 'flex-end',
          backgroundColor: 'var(--header-bg)',
        }}>
          <button className="btn btn-primary" onClick={onClose}>
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
