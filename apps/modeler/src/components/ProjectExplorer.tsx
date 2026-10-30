import { useMemo, useState } from 'react';
import { Edit2, Layers, LayoutGrid, Plus, Search, Trash2 } from 'lucide-react';
import { diagramMemberIds, type DiagramView, type ModelLevel, type ModelProject } from '@barker-modeler/model-core';

interface ProjectExplorerProps {
  project: ModelProject;
  level: ModelLevel;
  activeDiagramId: string;
  selectedEntityId: string | null;
  onSelectDiagram: (id: string) => void;
  onCreateDiagram: (level: ModelLevel) => void;
  onRenameDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onSelectEntity: (level: ModelLevel, id: string) => void;
  onAddEntity: () => void;
}

const LEVEL_LABEL: Record<ModelLevel, string> = { conceptual: '개념 모델', logical: '논리 모델' };

/** DA# Browser-style tree: subject-area diagrams per level + the object catalog. */
export default function ProjectExplorer(props: ProjectExplorerProps) {
  const { project, level, activeDiagramId, selectedEntityId } = props;
  const [query, setQuery] = useState('');

  const entities = level === 'conceptual' ? project.conceptual.entities : project.entities;
  const usage = useMemo(() => {
    const count = new Map<string, number>();
    project.diagrams
      .filter((d) => d.level === level && !d.includeAll)
      .forEach((d) => diagramMemberIds(project, d).forEach((id) => count.set(id, (count.get(id) || 0) + 1)));
    return count;
  }, [project, level]);

  const filtered = entities
    .filter((e) => !query.trim() || e.name.toLowerCase().includes(query.toLowerCase()) || (e.physicalName || '').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const renderDiagram = (d: DiagramView) => {
    const active = d.id === activeDiagramId;
    return (
      <div key={d.id} className={`tree-item ${active ? 'active' : ''}`} onClick={() => props.onSelectDiagram(d.id)}>
        <span className="tree-label">
          {d.includeAll ? <LayoutGrid size={12} /> : <Layers size={12} />} {d.name}
        </span>
        <span className="tree-meta">{d.includeAll ? '전체' : diagramMemberIds(project, d).size}</span>
        {!d.includeAll && (
          <span className="tree-actions">
            <button
              className="btn btn-icon"
              title="이름 바꾸기"
              onClick={(e) => {
                e.stopPropagation();
                props.onRenameDiagram(d.id);
              }}
            >
              <Edit2 size={10} />
            </button>
            <button
              className="btn btn-icon"
              title="다이어그램 삭제 (모델 객체는 유지)"
              onClick={(e) => {
                e.stopPropagation();
                props.onDeleteDiagram(d.id);
              }}
            >
              <Trash2 size={10} style={{ color: 'var(--danger)' }} />
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="sidebar-section">
        <h3>다이어그램 (주제영역)</h3>
        {(['conceptual', 'logical'] as ModelLevel[]).map((lv) => (
          <div key={lv} className="tree-group">
            <div className="tree-group-title">
              <span>{LEVEL_LABEL[lv]}</span>
              <button className="btn btn-icon" title={`새 ${LEVEL_LABEL[lv]} 다이어그램`} onClick={() => props.onCreateDiagram(lv)}>
                <Plus size={12} />
              </button>
            </div>
            {project.diagrams.filter((d) => d.level === lv).map(renderDiagram)}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <h3>
          {level === 'conceptual' ? '개념 엔터티' : '엔터티'} <span className="tree-meta">{entities.length}</span>
          <button className="btn btn-icon" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={props.onAddEntity}>
            <Plus size={14} /> 추가
          </button>
        </h3>
        <div className="tree-search">
          <Search size={12} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 / 물리명 검색" />
        </div>
        <div className="entity-list">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="entity-list-item"
              onClick={() => props.onSelectEntity(level, e.id)}
              style={{
                borderColor: selectedEntityId === e.id ? 'var(--accent-color)' : undefined,
                backgroundColor: selectedEntityId === e.id ? 'rgba(59, 130, 246, 0.05)' : undefined,
              }}
              title={usage.get(e.id) ? `${usage.get(e.id)}개 주제영역 다이어그램에 포함` : '주제영역 다이어그램에 없음 (전체 다이어그램에만 표시)'}
            >
              <span>{e.name}</span>
              <span className="item-badge">{usage.get(e.id) ? `${e.type} · ${usage.get(e.id)}` : e.type}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
