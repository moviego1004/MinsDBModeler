import { useState } from 'react';
import { Database, FolderOpen, FolderPlus, Clock, X } from 'lucide-react';
import {
  createEmptyProject,
  importLegacyProject,
  serializeProject,
  type DbmsType,
  type ModelProject,
  type NamingCase,
  type SubtypeStrategy,
} from '@barker-modeler/model-core';
import { projectFs, getRecentProjects, forgetRecentProject, getLegacyProjects, type RecentProject } from '../services/projectFs.js';
import { buildSampleProject } from '../services/sampleProject.js';

interface StartScreenProps {
  onOpen: (root: string) => Promise<void>;
  onCreated: (root: string, project: ModelProject, files: Record<string, string>, notice?: string) => void;
}

export default function StartScreen({ onOpen, onCreated }: StartScreenProps) {
  const [recent, setRecent] = useState<RecentProject[]>(getRecentProjects);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFolder = async () => {
    setError(null);
    const root = await projectFs.pickFolder('프로젝트 폴더 열기');
    if (!root) return;
    try {
      await onOpen(root);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="start-screen">
      <div className="start-card">
        <div className="start-brand">
          <Database size={28} />
          <div>
            <h1>MinsDBModeler</h1>
            <p>Barker 표기법 데이터 모델러 · 개념 → 논리 → 물리 → DDL</p>
          </div>
        </div>

        {!projectFs.isDesktop && (
          <div className="start-notice">
            브라우저 개발 모드입니다. 프로젝트는 브라우저 저장소의 가상 폴더에 저장됩니다. 실제 폴더 저장은 데스크톱 앱(Tauri)에서 동작합니다.
          </div>
        )}

        <div className="start-actions">
          <button className="start-action" onClick={() => setShowNew(true)}>
            <FolderPlus size={22} />
            <strong>새 프로젝트</strong>
            <span>폴더를 만들고 대상 DBMS·명명 규칙을 정합니다</span>
          </button>
          <button className="start-action" onClick={openFolder}>
            <FolderOpen size={22} />
            <strong>프로젝트 열기</strong>
            <span>minsmodeler.yaml 이 있는 폴더를 엽니다</span>
          </button>
        </div>

        {error && <div className="start-error">{error}</div>}

        <div className="start-recent">
          <h3>
            <Clock size={14} /> 최근 프로젝트
          </h3>
          {recent.length === 0 ? (
            <p className="start-empty">아직 연 프로젝트가 없습니다.</p>
          ) : (
            recent.map((r) => (
              <div key={r.root} className="start-recent-item" onClick={() => onOpen(r.root).catch((e) => setError(e?.message || String(e)))}>
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.root}</span>
                </div>
                <button
                  className="btn btn-icon"
                  title="목록에서 제거"
                  onClick={(e) => {
                    e.stopPropagation();
                    forgetRecentProject(r.root);
                    setRecent(getRecentProjects());
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreated={onCreated} />}
    </div>
  );
}

type Template = 'empty' | 'sample' | 'legacy';

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: StartScreenProps['onCreated'] }) {
  const legacy = getLegacyProjects();
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [targetDbms, setTargetDbms] = useState<DbmsType>('ORACLE');
  const [namingCase, setNamingCase] = useState<NamingCase>('UPPER_SNAKE');
  const [subtypeStrategy, setSubtypeStrategy] = useState<SubtypeStrategy>('ROLL_UP');
  const [template, setTemplate] = useState<Template>('empty');
  const [legacyId, setLegacyId] = useState(legacy[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderName = name.trim().replace(/[\\/:*?"<>|]/g, '_');
  const root = parent && folderName ? projectFs.join(parent, folderName) : '';

  const pickParent = async () => {
    const p = await projectFs.pickFolder('프로젝트를 만들 위치 선택');
    if (p) setParent(p);
  };

  const create = async () => {
    setError(null);
    if (!folderName) return setError('프로젝트 이름을 입력하세요.');
    if (!parent) return setError('프로젝트를 만들 위치를 선택하세요.');
    setBusy(true);
    try {
      const state = await projectFs.inspect(root);
      if (state === 'project') throw new Error(`이미 프로젝트가 있는 폴더입니다: ${root}`);
      if (state === 'other') throw new Error(`비어 있지 않은 폴더입니다: ${root}`);

      let project: ModelProject;
      let notice: string | undefined;
      const settings = { name: name.trim(), targetDbms, namingCase, subtypeStrategy };
      if (template === 'sample') {
        const res = buildSampleProject();
        project = { ...res.project, config: { ...res.project.config, ...settings } };
      } else if (template === 'legacy') {
        const src = legacy.find((p) => p.id === legacyId);
        if (!src) throw new Error('가져올 기존 프로젝트를 선택하세요.');
        const res = importLegacyProject({ name: src.name, files: src.files });
        project = { ...res.project, config: { ...res.project.config, ...settings } };
        notice =
          `"${src.name}" 가져오기 완료: 엔터티 ${res.report.addedEntities}개` +
          (res.report.mergedEntities ? ` (중복 정의 ${res.report.mergedEntities}건 통합)` : '') +
          `, 관계 ${res.report.addedRelationships}개, 다이어그램 ${res.report.diagrams}개` +
          (res.report.skippedRelationships.length ? `\n\n건너뛴 관계 ${res.report.skippedRelationships.length}건:\n${res.report.skippedRelationships.slice(0, 10).join('\n')}` : '');
      } else {
        project = createEmptyProject(settings);
      }
      const files = serializeProject(project);
      await projectFs.write(root, files, []);
      onCreated(root, project, files, notice);
    } catch (e: any) {
      setError(e?.message || String(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>새 프로젝트</h3>
          <button className="btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>프로젝트 이름</label>
            <input className="form-control" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예: QVI 포털" />
          </div>
          <div className="form-group">
            <label>위치</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-control" value={parent} onChange={(e) => setParent(e.target.value)} placeholder="폴더를 선택하세요" />
              <button className="btn" onClick={pickParent}>
                <FolderOpen size={14} /> 선택
              </button>
            </div>
            {root && <small style={{ color: 'var(--text-muted)' }}>생성될 폴더: {root}</small>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div className="form-group">
              <label>대상 DBMS</label>
              <select className="form-control" value={targetDbms} onChange={(e) => setTargetDbms(e.target.value as DbmsType)}>
                <option value="ORACLE">Oracle</option>
                <option value="POSTGRESQL">PostgreSQL</option>
                <option value="MYSQL">MySQL</option>
              </select>
            </div>
            <div className="form-group">
              <label>물리명 규칙</label>
              <select className="form-control" value={namingCase} onChange={(e) => setNamingCase(e.target.value as NamingCase)}>
                <option value="UPPER_SNAKE">UPPER_SNAKE</option>
                <option value="LOWER_SNAKE">lower_snake</option>
              </select>
            </div>
            <div className="form-group">
              <label>서브타입 변환</label>
              <select className="form-control" value={subtypeStrategy} onChange={(e) => setSubtypeStrategy(e.target.value as SubtypeStrategy)}>
                <option value="ROLL_UP">통합 (Roll-up)</option>
                <option value="ROLL_DOWN">분리 (Roll-down)</option>
                <option value="IDENTITY">1:1 분리</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>시작 내용</label>
            <div className="template-options">
              <label className="form-checkbox">
                <input type="radio" checked={template === 'empty'} onChange={() => setTemplate('empty')} /> 빈 프로젝트
              </label>
              <label className="form-checkbox">
                <input type="radio" checked={template === 'sample'} onChange={() => setTemplate('sample')} /> QVI 예제
              </label>
              <label className="form-checkbox" style={{ opacity: legacy.length ? 1 : 0.5 }}>
                <input type="radio" disabled={!legacy.length} checked={template === 'legacy'} onChange={() => setTemplate('legacy')} /> 이전 버전 데이터 가져오기
              </label>
            </div>
            {template === 'legacy' && (
              <select className="form-control" style={{ marginTop: 6 }} value={legacyId} onChange={(e) => setLegacyId(e.target.value)}>
                {legacy.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.files.length}개 파일)
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <div className="start-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={create}>
            <FolderPlus size={14} /> 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
