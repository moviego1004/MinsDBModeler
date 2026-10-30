import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Trash2, Wand2 } from 'lucide-react';

interface DdlPaneProps {
  outputs: Record<string, string>;
  targetDbms: string;
  onGenerate: () => void;
  onChange: (path: string, content: string) => void;
  onDelete: (path: string) => void;
  focusPath?: string | null;
}

/** DDL tab: generated artifacts under output/ (regenerated from the logical model by the transform wizard). */
export default function DdlPane({ outputs, targetDbms, onGenerate, onChange, onDelete, focusPath }: DdlPaneProps) {
  const paths = Object.keys(outputs).sort((a, b) => Number(b.endsWith('.sql')) - Number(a.endsWith('.sql')) || a.localeCompare(b));
  const [selected, setSelected] = useState<string | null>(focusPath || paths[0] || null);

  useEffect(() => {
    if (focusPath && outputs[focusPath] !== undefined) setSelected(focusPath);
    else if (!selected || outputs[selected] === undefined) setSelected(paths[0] || null);
  }, [focusPath, outputs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ddl-pane">
      <div className="ddl-list">
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={onGenerate}>
          <Wand2 size={14} /> DDL 생성 / 갱신
        </button>
        <div className="ddl-hint">대상 DBMS: {targetDbms}. 논리 모델에서 물리 변환 후 output/ 폴더에 저장합니다.</div>
        {paths.length === 0 && <div className="ddl-hint">아직 생성된 산출물이 없습니다.</div>}
        {paths.map((p) => (
          <div key={p} className={`tree-item ${p === selected ? 'active' : ''}`} onClick={() => setSelected(p)}>
            <span className="tree-label">
              <FileCode size={12} /> {p.replace(/^output\//, '')}
            </span>
            <span className="tree-actions">
              <button
                className="btn btn-icon"
                title="삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`${p} 파일을 삭제할까요?`)) onDelete(p);
                }}
              >
                <Trash2 size={10} style={{ color: 'var(--danger)' }} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="ddl-editor">
        {selected && outputs[selected] !== undefined ? (
          <Editor
            key={selected}
            height="100%"
            language={selected.endsWith('.sql') || selected.endsWith('.ddl') ? 'sql' : 'yaml'}
            theme="light"
            value={outputs[selected]}
            onChange={(v) => v !== undefined && onChange(selected, v)}
            options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: 'on', automaticLayout: true }}
          />
        ) : (
          <div className="ddl-empty">왼쪽에서 "DDL 생성 / 갱신"을 눌러 현재 논리 모델의 DDL을 만드세요.</div>
        )}
      </div>
    </div>
  );
}
