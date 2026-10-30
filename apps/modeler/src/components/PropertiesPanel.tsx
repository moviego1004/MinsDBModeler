import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Attribute, Entity, LogicalModel, Relationship } from '@barker-modeler/model-core';

/**
 * Right-hand property editors (entity / relationship / diagram).
 * Moved out of App.tsx unchanged; level-specific sections are injected through the *Extras slots.
 */
export interface PropertiesPanelProps {
  model: LogicalModel;
  selectedEntity: Entity | null;
  selectedRelationship: Relationship | null;
  handleUpdateEntity: (entity: Entity) => void;
  handleAddAttribute: () => void;
  handleUpdateAttribute: (index: number, attr: Attribute) => void;
  handleDeleteAttribute: (index: number) => void;
  handleDeleteEntity: (name: string) => void;
  handleUpdateRelationship: (rel: Relationship) => void;
  handleDeleteRelationship: (id: string) => void;
  handleUpdateModelMeta: (key: keyof LogicalModel, value: any) => void;
  entityExtras?: ReactNode;
  relationshipExtras?: ReactNode;
  modelExtras?: ReactNode;
}

export default function PropertiesPanel({
  model,
  selectedEntity,
  selectedRelationship,
  handleUpdateEntity,
  handleAddAttribute,
  handleUpdateAttribute,
  handleDeleteAttribute,
  handleDeleteEntity,
  handleUpdateRelationship,
  handleDeleteRelationship,
  handleUpdateModelMeta,
  entityExtras,
  relationshipExtras,
  modelExtras,
}: PropertiesPanelProps) {
  return (
    <>
          {selectedEntity ? (
            // Entity Editor
            <div>
              <div className="detail-header">
                <h2>Entity Details</h2>
                <p>Edit metadata and attributes of the selected entity.</p>
              </div>

              <div className="form-group">
                <label>Entity Name (논리명)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedEntity.name}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Physical Table Name (물리 테이블명)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. TB_USER_INFO"
                  value={selectedEntity.physicalName || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, physicalName: e.target.value.toUpperCase() || undefined })}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Classification (성격)</label>
                  <select 
                    className="form-control"
                    style={{ fontSize: '0.75rem' }}
                    value={selectedEntity.classification || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, classification: (e.target.value || undefined) as any })}
                  >
                    <option value="">-- 분류 없음 --</option>
                    <option value="KEY">KEY (핵심 엔터티)</option>
                    <option value="MAIN">MAIN (기본 엔터티)</option>
                    <option value="ACTION">ACTION (행위 엔터티)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Level (관리 중요도)</label>
                  <select 
                    className="form-control"
                    style={{ fontSize: '0.75rem' }}
                    value={selectedEntity.level || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, level: e.target.value ? Number(e.target.value) as any : undefined })}
                  >
                    <option value="">-- 레벨 미지정 --</option>
                    <option value="1">Level 1 (전사 핵심)</option>
                    <option value="2">Level 2 (주제영역 주요)</option>
                    <option value="3">Level 3 (단위 업무/보조)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Type</label>
                <select 
                  className="form-control"
                  value={selectedEntity.type}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, type: e.target.value as any })}
                >
                  <option value="entity">Standard Entity</option>
                  <option value="supertype">Supertype (Container)</option>
                  <option value="subtype">Subtype (Nested)</option>
                </select>
              </div>

              {/* Volume Estimation Section */}
              <div style={{ marginTop: '12px', marginBottom: '12px', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  📊 예상 볼륨 산정 (Volume Info)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>발생 주기</span>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      value={selectedEntity.volume?.period || ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), period: (e.target.value || undefined) as any }
                      })}
                    >
                      <option value="">-- 주기 선택 --</option>
                      <option value="daily">일별 (Daily)</option>
                      <option value="monthly">월별 (Monthly)</option>
                      <option value="yearly">연별 (Yearly)</option>
                      <option value="on_demand">수시 (On Demand)</option>
                    </select>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>월 발생량(건)</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="0"
                      value={selectedEntity.volume?.monthlyQuantity ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), monthlyQuantity: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>보존기한(개월)</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="개월 수"
                      value={selectedEntity.volume?.retentionMonths ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), retentionMonths: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 누적건수</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="0"
                      value={selectedEntity.volume?.totalQuantity ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), totalQuantity: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Purpose / Description (정의/설명)</label>
                <textarea
                  className="form-control"
                  style={{ height: '54px', fontSize: '0.75rem', resize: 'vertical' }}
                  placeholder="엔터티의 비즈니스 정의 및 주요 설명..."
                  value={selectedEntity.purpose || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, purpose: e.target.value || undefined })}
                />
              </div>

              {selectedEntity.type === 'subtype' && (
                <div className="form-group">
                  <label>Supertype Entity</label>
                  <select
                    className="form-control"
                    value={selectedEntity.supertype || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, supertype: e.target.value || undefined })}
                  >
                    <option value="">-- Select Supertype --</option>
                    {model.entities
                      .filter(e => e.name !== selectedEntity.name)
                      .map(e => (
                        <option key={e.name} value={e.name}>{e.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Discriminator Attribute (Optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedEntity.discriminator || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, discriminator: e.target.value || undefined })}
                  placeholder="e.g. 이용자구분코드"
                />
              </div>

              {entityExtras}

              {/* Attributes Section */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Attributes
                  <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={handleAddAttribute}>
                    <Plus size={12} /> Add
                  </button>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {selectedEntity.attributes.map((attr, idx) => (
                    <div key={idx} style={{ backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <div className="form-group" style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>논리 속성명</span>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                              value={attr.name}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>물리 컬럼명</span>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="e.g. USER_ID"
                              style={{ fontSize: '0.75rem' }}
                              value={attr.physicalName || ''}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, physicalName: e.target.value.toUpperCase() || undefined })}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Domain / Type</span>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ fontSize: '0.75rem' }}
                            placeholder="Domain / Type"
                            value={attr.domain || ''}
                            onChange={(e) => handleUpdateAttribute(idx, { ...attr, domain: e.target.value || undefined })}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Key Type</span>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.75rem' }}
                            value={attr.keyType || (attr.identifier ? 'PK' : attr.fk ? 'FK' : 'NORMAL')}
                            onChange={(e) => {
                              const kt = e.target.value as any;
                              handleUpdateAttribute(idx, {
                                ...attr,
                                keyType: kt,
                                identifier: kt === 'PK',
                                fk: kt === 'FK',
                                required: kt === 'PK' ? true : attr.required
                              });
                            }}
                          >
                            <option value="NORMAL">일반 속성</option>
                            <option value="PK">PK (주식별자)</option>
                            <option value="AK">AK (대체키/UK)</option>
                            <option value="FK">FK (외래키)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <label className="form-checkbox" style={{ fontSize: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={attr.identifier || attr.keyType === 'PK'}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                handleUpdateAttribute(idx, {
                                  ...attr,
                                  identifier: checked,
                                  keyType: checked ? 'PK' : (attr.keyType === 'PK' ? 'NORMAL' : attr.keyType),
                                  required: checked ? true : attr.required
                                });
                              }}
                            />
                            PK (#)
                          </label>
                          <label className="form-checkbox" style={{ fontSize: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={attr.required || false}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, required: e.target.checked })}
                              disabled={attr.identifier || attr.keyType === 'PK'}
                            />
                            Req (*)
                          </label>
                        </div>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                          onClick={() => handleDeleteAttribute(idx)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '24px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => handleDeleteEntity(selectedEntity.name)}
              >
                <Trash2 size={16} /> Delete Entity
              </button>
            </div>
          ) : selectedRelationship ? (
            // Relationship Editor
            <div>
              <div className="detail-header">
                <h2>Relationship Details</h2>
                <p>Edit cardinality and optionality of the selected connection.</p>
              </div>

              <div className="form-group">
                <label>Relationship ID</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.id}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Relationship Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.name || ''}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, name: e.target.value || undefined })}
                />
              </div>

              <div className="form-group">
                <label>Parent (One / Source)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.parent}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Child (Many / Target)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.child}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Cardinality</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.cardinality}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, cardinality: e.target.value as any })}
                >
                  <option value="one_to_many">One to Many (1:M)</option>
                  <option value="one_to_one">One to One (1:1)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Parent Participation (toward Child)</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.parent_participation}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, parent_participation: e.target.value as any })}
                >
                  <option value="0..M">0..M (Optional Many)</option>
                  <option value="1..M">1..M (Mandatory Many)</option>
                  <option value="0..1">0..1 (Optional One)</option>
                  <option value="1..1">1..1 (Mandatory One)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Child Participation (toward Parent)</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.child_participation}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, child_participation: e.target.value as any })}
                >
                  <option value="1..1">1..1 (Mandatory One)</option>
                  <option value="0..1">0..1 (Optional One)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedRelationship.identifying}
                    onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, identifying: e.target.checked })}
                  />
                  Identifying Relationship (Solid Line)
                </label>
              </div>

              {relationshipExtras}

              <div className="quick-tips">
                <strong>Barker Rendering Tips:</strong>
                <p>- <strong>Identifying:</strong> Solid middle line segment.</p>
                <p>- <strong>Non-Identifying:</strong> Dashed middle line segment.</p>
                <p>- <strong>Optional:</strong> Dashed endpoint segment near the optional side.</p>
              </div>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '24px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => handleDeleteRelationship(selectedRelationship.id)}
              >
                <Trash2 size={16} /> Delete Relationship
              </button>
            </div>
          ) : (
            // General Model Meta Editor
            <div>
              <div className="detail-header">
                <h2>다이어그램 정보</h2>
                <p>주제영역 다이어그램과 프로젝트 공통 업무규칙입니다.</p>
              </div>

              <div className="form-group">
                <label>다이어그램 이름 (주제영역)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={model.subject_area}
                  onChange={(e) => handleUpdateModelMeta('subject_area', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>프로젝트 버전</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={model.version || ''}
                  onChange={(e) => handleUpdateModelMeta('version', e.target.value)}
                />
              </div>

              {/* Rules List */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem' }}>Business Rules</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {model.rules && model.rules.map((rule, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        backgroundColor: 'var(--bg-main)', 
                        padding: '10px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-light)',
                        fontSize: '0.8rem',
                        position: 'relative'
                      }}
                    >
                      <p>{rule}</p>
                      <button 
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        onClick={() => {
                          const updatedRules = model.rules?.filter((_, i) => i !== idx);
                          handleUpdateModelMeta('rules', updatedRules);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    className="btn" 
                    style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const newRule = prompt('새 비즈니스 규칙을 입력하세요:');
                      if (newRule) {
                        const updatedRules = [...(model.rules || []), newRule];
                        handleUpdateModelMeta('rules', updatedRules);
                      }
                    }}
                  >
                    <Plus size={14} /> Add Business Rule
                  </button>
                </div>
              </div>

              {modelExtras}
            </div>
          )}
    </>
  );
}
