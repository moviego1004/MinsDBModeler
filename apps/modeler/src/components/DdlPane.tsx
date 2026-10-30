import { useEffect, useMemo, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { AlertTriangle, CheckCircle, FileCode, GitCompare, Save, Trash2, BookPlus, Eye } from 'lucide-react';
import type { PhysicalModel, ProjectConfig, StandardWord } from '@barker-modeler/model-core';

interface DdlPaneProps {
  physical: PhysicalModel;
  /** DDL compiled from the current logical model (always up to date). */
  liveDdl: string;
  config: ProjectConfig;
  onConfigChange: (patch: Partial<Pick<ProjectConfig, 'targetDbms' | 'subtypeStrategy' | 'namingCase'>>) => void;
  /** output/ path the live DDL is saved to. */
  ddlPath: string;
  outputs: Record<string, string>;
  onSave: () => void;
  onChange: (path: string, content: string) => void;
  onDelete: (path: string) => void;
  onRegisterWords: (words: StandardWord[]) => void;
  focusPath?: string | null;
}

type View = { kind: 'preview' } | { kind: 'diff' } | { kind: 'file'; path: string };

const EDITOR_OPTIONS = { minimap: { enabled: false }, fontSize: 12, wordWrap: 'off' as const, automaticLayout: true, scrollBeyondLastLine: false };

/**
 * DDL tab: the DDL is compiled from the logical model on every change and shown as a
 * live preview. "저장" writes it (plus the physical spec) under output/, where it can be
 * compared with the next version. Unregistered standard words are warnings, not blockers.
 */
export default function DdlPane(props: DdlPaneProps) {
  const { physical, liveDdl, config, ddlPath, outputs } = props;
  const [view, setView] = useState<View>({ kind: 'preview' });
  const [abbrs, setAbbrs] = useState<Record<string, string>>({});
  const [showWords, setShowWords] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    if (props.focusPath && outputs[props.focusPath] !== undefined) setView({ kind: 'file', path: props.focusPath });
  }, [props.focusPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view.kind === 'file' && outputs[view.path] === undefined) setView({ kind: 'preview' });
  }, [outputs, view]);

  const saved = outputs[ddlPath];
  const upToDate = saved !== undefined && saved === liveDdl;
  const paths = useMemo(
    () => Object.keys(outputs).sort((a, b) => Number(b.endsWith('.sql')) - Number(a.endsWith('.sql')) || a.localeCompare(b)),
    [outputs]
  );
  const columns = physical.tables.reduce((n, t) => n + t.columns.length, 0);
  const filled = Object.entries(abbrs).filter(([, v]) => v.trim());

  const registerWords = () => {
    if (!filled.length) return;
    props.onRegisterWords(filled.map(([logicalName, physicalAbbr]) => ({ logicalName, physicalAbbr: physicalAbbr.trim().toUpperCase() })));
    setAbbrs({});
  };

  return (
    <div className="ddl-pane">
      <div className="ddl-list">
        <div className="ddl-section-title">물리 변환 설정</div>
        <label className="ddl-field">
          <span>대상 DBMS</span>
          <select className="form-control" value={config.targetDbms} onChange={(e) => props.onConfigChange({ targetDbms: e.target.value as ProjectConfig['targetDbms'] })}>
            <option value="ORACLE">Oracle</option>
            <option value="POSTGRESQL">PostgreSQL</option>
            <option value="MYSQL">MySQL</option>
          </select>
        </label>
        <label className="ddl-field">
          <span>서브타입 변환</span>
          <select className="form-control" value={config.subtypeStrategy} onChange={(e) => props.onConfigChange({ subtypeStrategy: e.target.value as ProjectConfig['subtypeStrategy'] })}>
            <option value="ROLL_UP">통합 — 슈퍼타입 테이블 하나</option>
            <option value="ROLL_DOWN">분리 — 서브타입별 테이블</option>
            <option value="IDENTITY">1:1 — 슈퍼/서브 각각 테이블</option>
          </select>
        </label>
        <label className="ddl-field">
          <span>물리명 표기</span>
          <select className="form-control" value={config.namingCase} onChange={(e) => props.onConfigChange({ namingCase: e.target.value as ProjectConfig['namingCase'] })}>
            <option value="UPPER_SNAKE">대문자 (USR_NO)</option>
            <option value="LOWER_SNAKE">소문자 (usr_no)</option>
          </select>
        </label>
        <div className="ddl-hint">물리 탭과 같은 설정입니다. 바꾸면 물리 다이어그램도 함께 바뀝니다.</div>

        <div className="ddl-stats">
          <span>테이블 <b>{physical.tables.length}</b></span>
          <span>컬럼 <b>{columns}</b></span>
          <span>FK <b>{physical.foreignKeys.length}</b></span>
        </div>

        {physical.nonStandardWords.length > 0 ? (
          <div className="ddl-alert warn">
            <div className="ddl-alert-head" onClick={() => setShowWords((v) => !v)}>
              <AlertTriangle size={13} /> 미등록 표준 단어 {physical.nonStandardWords.length}개 {showWords ? '▾' : '▸'}
            </div>
            <div className="ddl-hint" style={{ margin: '4px 0 0' }}>
              DDL은 생성되지만 해당 부분은 한글 원문 그대로(따옴표 처리) 들어갑니다. 약어를 입력해 한 번에 등록하세요.
            </div>
            {showWords && (
              <>
                <div className="ddl-words">
                  {physical.nonStandardWords.map((w) => (
                    <div key={w.word} className="ddl-word" title={w.usedIn.slice(0, 12).join('\n') + (w.usedIn.length > 12 ? '\n…' : '')}>
                      <span className="ddl-word-name">{w.word}</span>
                      <span className="ddl-word-count">{w.usedIn.length}</span>
                      <input
                        className="form-control"
                        placeholder="약어"
                        value={abbrs[w.word] || ''}
                        onChange={(e) => setAbbrs((prev) => ({ ...prev, [w.word]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && registerWords()}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={!filled.length} onClick={registerWords}>
                  <BookPlus size={13} /> 입력한 {filled.length}개 단어 사전에 등록
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ddl-alert ok">
            <CheckCircle size={13} /> 모든 이름이 표준 단어로 변환됩니다
          </div>
        )}

        {physical.warnings.length > 0 && (
          <div className="ddl-alert warn">
            <div className="ddl-alert-head" onClick={() => setShowWarnings((v) => !v)}>
              <AlertTriangle size={13} /> 변환 경고 {physical.warnings.length}건 {showWarnings ? '▾' : '▸'}
            </div>
            {showWarnings && (
              <ul className="ddl-warnings">
                {physical.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', margin: '10px 0 4px' }} onClick={props.onSave} disabled={upToDate}>
          <Save size={14} /> {saved === undefined ? 'output/에 저장' : upToDate ? '저장본이 최신입니다' : '저장본 갱신'}
        </button>
        <div className="ddl-hint">
          {ddlPath} 와 물리 사양(.yaml)을 함께 저장합니다.
          {saved !== undefined && !upToDate && ' 저장본과 달라진 내용은 "저장본과 비교"에서 확인하세요.'}
        </div>

        <div className="ddl-section-title" style={{ marginTop: 12 }}>보기</div>
        <div className={`tree-item ${view.kind === 'preview' ? 'active' : ''}`} onClick={() => setView({ kind: 'preview' })}>
          <Eye size={12} /> 최신 DDL 미리보기
        </div>
        <div
          className={`tree-item ${view.kind === 'diff' ? 'active' : ''}`}
          style={{ opacity: saved === undefined ? 0.45 : 1 }}
          title={saved === undefined ? '아직 저장본이 없습니다' : ''}
          onClick={() => saved !== undefined && setView({ kind: 'diff' })}
        >
          <GitCompare size={12} /> 저장본과 비교 {saved !== undefined && !upToDate && <span className="ddl-dot" />}
        </div>

        <div className="ddl-section-title" style={{ marginTop: 12 }}>output/ 산출물</div>
        {paths.length === 0 && <div className="ddl-hint">아직 저장된 산출물이 없습니다.</div>}
        {paths.map((p) => (
          <div key={p} className={`tree-item ${view.kind === 'file' && view.path === p ? 'active' : ''}`} onClick={() => setView({ kind: 'file', path: p })}>
            <span className="tree-label">
              <FileCode size={12} /> {p.replace(/^output\//, '')}
            </span>
            <span className="tree-actions">
              <button
                className="btn btn-icon"
                title="삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`${p} 파일을 삭제할까요?`)) props.onDelete(p);
                }}
              >
                <Trash2 size={10} style={{ color: 'var(--danger)' }} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="ddl-editor">
        {view.kind === 'preview' && (
          <Editor key="preview" height="100%" language="sql" theme="light" value={liveDdl} options={{ ...EDITOR_OPTIONS, readOnly: true }} />
        )}
        {view.kind === 'diff' && saved !== undefined && (
          <DiffEditor
            key="diff"
            height="100%"
            language="sql"
            theme="light"
            original={saved}
            modified={liveDdl}
            options={{ ...EDITOR_OPTIONS, readOnly: true, renderSideBySide: true, originalEditable: false }}
          />
        )}
        {view.kind === 'file' && outputs[view.path] !== undefined && (
          <Editor
            key={view.path}
            height="100%"
            language={/\.(sql|ddl)$/i.test(view.path) ? 'sql' : 'yaml'}
            theme="light"
            value={outputs[view.path]}
            onChange={(v) => v !== undefined && props.onChange(view.path, v)}
            options={EDITOR_OPTIONS}
          />
        )}
      </div>
    </div>
  );
}
