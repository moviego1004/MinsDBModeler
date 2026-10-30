import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer, Group, Rect, Text, Line } from 'react-konva';
import type {
  Point,
  Relationship,
  BarkerDiagramLayout,
  EntityShape,
  CategoryShape,
  RouteResult,
} from '@barker-modeler/model-core';
import { calculateBarkerEndpointSymbols, routeBarkerRelationships } from '@barker-modeler/model-core';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Camera, Search, X } from 'lucide-react';

/**
 * Dumb renderer for the Barker layout engine.
 * Every coordinate and size comes from `layout` (packages/model-core/src/rendering);
 * this component only maps shape kinds to Konva primitives and forwards events.
 */

export interface KonvaModelerCanvasProps {
  layout: BarkerDiagramLayout;
  relationships: Relationship[];
  selectedEntityName?: string | null;
  selectedRelationshipId?: string | null;
  viewMode?: 'logical' | 'physical';
  onSelectEntity?: (name: string | null) => void;
  onSelectRelationship?: (id: string) => void;
  onEntityDoubleClick?: (name: string) => void;
  onPaneDoubleClick?: (event: MouseEvent) => void;
  /** Root shape moved. `final` is true on drop. */
  onRootMove?: (name: string, pos: { x: number; y: number }, final: boolean) => void;
  /** Root shape resized. `final` is true on release. */
  onRootResize?: (name: string, size: { width: number; height: number }, final: boolean) => void;
}

// DA#-like palette. Kept in one place so a theme switch only touches this object.
const PALETTE = {
  independentFill: '#dbe8c6',
  dependentFill: '#ffffff',
  border: '#3b4252',
  categoryFill: '#fdf7c8',
  categoryLabel: '#6b5a0a',
  text: '#1e293b',
  muted: '#64748b',
  fk: '#1d4ed8',
  selected: '#2563eb',
  edge: '#475569',
};

const ROUTE_OPTIONS = { padding: 24, laneSpacing: 18 };

export default function KonvaModelerCanvas({
  layout,
  relationships,
  selectedEntityName,
  selectedRelationshipId,
  viewMode = 'logical',
  onSelectEntity,
  onSelectRelationship,
  onEntityDoubleClick,
  onPaneDoubleClick,
  onRootMove,
  onRootResize,
}: KonvaModelerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [bg, setBg] = useState('#f8fafc');
  const style = layout.style;

  /* ------------------------------ viewport ------------------------------ */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setDimensions({ width: r.width || 800, height: r.height || 600 }));
    });
    observer.observe(container);
    setDimensions({ width: container.clientWidth || 800, height: container.clientHeight || 600 });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const update = () =>
      setBg(getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim() || '#f8fafc');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  const zoomAround = (center: { x: number; y: number }, newScale: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const old = stage.scaleX();
    const p = { x: (center.x - stage.x()) / old, y: (center.y - stage.y()) / old };
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: center.x - p.x * newScale, y: center.y - p.y * newScale });
    stage.batchDraw();
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const s = e.evt.deltaY < 0 ? stage.scaleX() * 1.1 : stage.scaleX() / 1.1;
    if (s < 0.15 || s > 4) return;
    zoomAround(pointer, s);
  };

  const center = () => ({ x: dimensions.width / 2, y: dimensions.height / 2 });
  const handleZoomIn = () => zoomAround(center(), Math.min((stageRef.current?.scaleX() || 1) * 1.25, 4));
  const handleZoomOut = () => zoomAround(center(), Math.max((stageRef.current?.scaleX() || 1) / 1.25, 0.15));
  const handleResetZoom = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
  };

  const handleZoomToFit = useCallback(() => {
    const stage = stageRef.current;
    const b = layout.bounds;
    if (!stage || b.width <= 0) return;
    const pad = 60;
    const scale = Math.max(0.2, Math.min(dimensions.width / (b.width + pad * 2), dimensions.height / (b.height + pad * 2), 1.2));
    stage.scale({ x: scale, y: scale });
    stage.position({
      x: (dimensions.width - b.width * scale) / 2 - b.x * scale,
      y: (dimensions.height - b.height * scale) / 2 - b.y * scale,
    });
    stage.batchDraw();
  }, [layout.bounds, dimensions]);

  const handleExportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const a = document.createElement('a');
    a.href = stage.toDataURL({ pixelRatio: 2 });
    a.download = `model_diagram_${Date.now()}.png`;
    a.click();
  };

  /* ------------------------------- search ------------------------------- */
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const allShapes = useMemo(() => Array.from(layout.shapes.values()), [layout]);
  const searchResults = searchQuery.trim()
    ? allShapes.filter((s) => {
        const q = searchQuery.toLowerCase();
        return s.entity.toLowerCase().includes(q) || s.label.toLowerCase().includes(q);
      })
    : [];

  const jumpTo = (shape: EntityShape) => {
    const stage = stageRef.current;
    if (!stage) return;
    const k = stage.scaleX();
    stage.position({
      x: dimensions.width / 2 - (shape.x + shape.width / 2) * k,
      y: dimensions.height / 2 - (shape.y + shape.height / 2) * k,
    });
    stage.batchDraw();
    onSelectEntity?.(shape.entity);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  /* ------------------------------- shapes ------------------------------- */
  const selectHandlers = (name: string) => ({
    onClick: (e: any) => {
      e.cancelBubble = true;
      onSelectEntity?.(name);
    },
    onTap: (e: any) => {
      e.cancelBubble = true;
      onSelectEntity?.(name);
    },
    onDblClick: (e: any) => {
      e.cancelBubble = true;
      onEntityDoubleClick?.(name);
    },
  });

  const renderCategory = (cat: CategoryShape, ox: number, oy: number) => (
    <Group key={cat.key} x={cat.x - ox} y={cat.y - oy}>
      <Rect width={cat.width} height={cat.height} fill={PALETTE.categoryFill} cornerRadius={2} listening={false} />
      <Text
        text={cat.label}
        x={style.categoryPadding}
        y={3}
        fontSize={style.fontSize - 1}
        fill={PALETTE.categoryLabel}
        listening={false}
      />
      {cat.children.map((child) => renderShape(child, cat.x, cat.y))}
    </Group>
  );

  // One recursive function for every depth; shape kind is the only branch.
  const renderShape = (shape: EntityShape, ox: number, oy: number): React.ReactNode => {
    const selected = selectedEntityName === shape.entity;
    const stroke = selected ? PALETTE.selected : PALETTE.border;
    const strokeWidth = selected ? 2.2 : 1;

    if (shape.kind === 'pill') {
      return (
        <Group key={shape.entity} x={shape.x - ox} y={shape.y - oy} {...selectHandlers(shape.entity)}>
          <Rect
            width={shape.width}
            height={shape.height}
            fill={PALETTE.dependentFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={shape.height / 2}
          />
          <Text
            text={shape.label}
            width={shape.width}
            y={(shape.height - style.fontSize) / 2}
            align="center"
            fontSize={style.fontSize}
            fontStyle="bold"
            fill={PALETTE.text}
            listening={false}
          />
        </Group>
      );
    }

    const showDomains = viewMode === 'physical';
    return (
      <Group key={shape.entity} x={shape.x - ox} y={shape.y - oy} {...selectHandlers(shape.entity)}>
        <Rect
          width={shape.width}
          height={shape.height}
          fill={shape.independent ? PALETTE.independentFill : PALETTE.dependentFill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          cornerRadius={6}
        />
        <Text
          text={shape.label}
          x={style.paddingX}
          y={(style.headerHeight - style.headerFontSize) / 2}
          fontSize={style.headerFontSize}
          fontStyle="bold"
          fill={PALETTE.text}
          listening={false}
        />
        {shape.rows.map((row) => {
          const ty = row.y + (style.rowHeight - style.fontSize) / 2;
          const color = row.isFk ? PALETTE.fk : PALETTE.text;
          return (
            <Group key={row.name} listening={false}>
              <Text text={row.marker} x={style.paddingX} y={ty} fontSize={style.fontSize} fontStyle="bold" fill={color} />
              <Text
                text={row.isFk ? `${row.name} (FK)` : row.name}
                x={style.paddingX + style.markerWidth}
                y={ty}
                fontSize={style.fontSize}
                fill={color}
              />
              {showDomains && row.domain && (
                <Text
                  text={row.domain}
                  x={0}
                  width={shape.width - style.paddingX}
                  y={ty + 1}
                  align="right"
                  fontSize={style.fontSize - 1}
                  fill={PALETTE.muted}
                />
              )}
            </Group>
          );
        })}
        {shape.categories.map((cat) => renderCategory(cat, shape.x, shape.y))}
      </Group>
    );
  };

  const renderRoot = (root: EntityShape) => {
    const selected = selectedEntityName === root.entity;
    return (
      <Group
        key={`root:${root.entity}`}
        x={root.x}
        y={root.y}
        draggable={!!onRootMove}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragMove={(e) => {
          if (e.target !== e.currentTarget) return;
          onRootMove?.(root.entity, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) }, false);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          if (e.target !== e.currentTarget) return;
          onRootMove?.(root.entity, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) }, true);
        }}
      >
        {renderShape(root, root.x, root.y)}
        {selected && root.kind === 'box' && onRootResize && (
          <Rect
            x={root.width - 8}
            y={root.height - 8}
            width={8}
            height={8}
            fill={PALETTE.selected}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              onRootResize(root.entity, { width: e.target.x() + 8, height: e.target.y() + 8 }, false);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              onRootResize(root.entity, { width: e.target.x() + 8, height: e.target.y() + 8 }, true);
            }}
          />
        )}
      </Group>
    );
  };

  /* ------------------------------- edges -------------------------------- */
  const routes = useMemo<Record<string, RouteResult>>(
    () => routeBarkerRelationships(layout, relationships, ROUTE_OPTIONS),
    [layout, relationships]
  );

  const renderEdge = (rel: Relationship) => {
    const route = routes[rel.id];
    if (!route || route.waypoints.length < 2) return null;

    const card = (rel.cardinality || 'one_to_many').toLowerCase();
    const parentPart = (rel.parent_participation || '0..M').toUpperCase();
    const childPart = (rel.child_participation || '1..1').toUpperCase();
    // Crow's foot sits on the "many" end; each half is dashed when that end is optional.
    const childMany = card === 'one_to_many' || card === 'many_to_many' || parentPart.includes('M');
    const parentMany = card === 'many_to_many' || childPart.includes('M');
    const parentOptional = parentPart.startsWith('0');
    const childOptional = childPart.startsWith('0');

    const highlighted = selectedRelationshipId === rel.id || hoveredEdgeId === rel.id;
    const color = highlighted ? PALETTE.selected : PALETTE.edge;
    const width = highlighted ? 2.4 : 1.2;

    const pts = route.waypoints;
    const mid = Math.floor(pts.length / 2);
    const flat = (list: Point[]) => list.flatMap((p) => [p.x, p.y]);
    const childSymbols = calculateBarkerEndpointSymbols(route.targetPort, pts[pts.length - 2], {
      isMany: childMany,
      isOptional: childOptional,
      prongLength: 12,
      prongSpread: 8,
    });
    const parentSymbols = calculateBarkerEndpointSymbols(route.sourcePort, pts[1], {
      isMany: parentMany,
      isOptional: parentOptional,
      prongLength: 12,
      prongSpread: 8,
    });
    const label = rel.name || '';
    const labelPoint = pts[mid];

    return (
      <Group key={rel.id}>
        <Line
          points={flat(pts)}
          stroke="transparent"
          strokeWidth={14}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelectRelationship?.(rel.id);
          }}
          onMouseEnter={() => setHoveredEdgeId(rel.id)}
          onMouseLeave={() => setHoveredEdgeId(null)}
        />
        <Line points={flat(pts.slice(0, mid + 1))} stroke={color} strokeWidth={width} dash={parentOptional ? [5, 4] : undefined} listening={false} />
        <Line points={flat(pts.slice(mid))} stroke={color} strokeWidth={width} dash={childOptional ? [5, 4] : undefined} listening={false} />
        {[...(childSymbols.crowFootLines || []), ...(parentSymbols.crowFootLines || [])].map((prong, i) => (
          <Line key={i} points={flat(prong)} stroke={color} strokeWidth={width} listening={false} />
        ))}
        {label && labelPoint && (
          <Text
            text={label}
            x={labelPoint.x + 4}
            y={labelPoint.y - style.fontSize - 2}
            fontSize={style.fontSize - 1}
            fill={highlighted ? PALETTE.selected : PALETTE.muted}
            listening={false}
          />
        )}
      </Group>
    );
  };

  /* ------------------------------- render ------------------------------- */
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: bg, overflow: 'hidden', position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === stageRef.current) onSelectEntity?.(null);
        }}
        onDblClick={(e) => {
          if (e.target === stageRef.current) onPaneDoubleClick?.(e.evt);
        }}
        onDragStart={(e) => {
          const stage = stageRef.current;
          if (stage && e.target !== stage) stage.stopDrag();
        }}
      >
        <Layer>{layout.roots.map(renderRoot)}</Layer>
        <Layer>{relationships.map(renderEdge)}</Layer>
      </Stage>

      {/* Quick search */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, display: 'flex', flexDirection: 'column', width: 260 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-main, #ffffff)',
            border: '1px solid var(--border-color, #cbd5e1)',
            borderRadius: 6,
            padding: '4px 8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted, #94a3b8)', marginRight: 6 }} />
          <input
            type="text"
            placeholder="엔터티 빠른 검색..."
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8rem', width: '100%', color: 'var(--text-main, #0f172a)' }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: 2 }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {isSearchOpen && searchResults.length > 0 && (
          <div
            style={{
              marginTop: 4,
              maxHeight: 220,
              overflowY: 'auto',
              backgroundColor: 'var(--bg-main, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            }}
          >
            {searchResults.map((s) => (
              <div
                key={s.entity}
                onClick={() => jumpTo(s)}
                style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border-light, #f1f5f9)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}
              >
                <strong style={{ color: 'var(--text-main, #0f172a)' }}>{s.label}</strong>
                <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.65rem' }}>
                  {s.isSubtype ? `SUBTYPE · ${s.parent}` : s.isSupertype ? 'SUPERTYPE' : 'ENTITY'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Canvas controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 20,
          display: 'flex',
          gap: 6,
          backgroundColor: 'var(--bg-main, #ffffff)',
          border: '1px solid var(--border-color, #cbd5e1)',
          borderRadius: 8,
          padding: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        {[
          { title: '확대 (Zoom In)', onClick: handleZoomIn, icon: <ZoomIn size={15} /> },
          { title: '축소 (Zoom Out)', onClick: handleZoomOut, icon: <ZoomOut size={15} /> },
          { title: '화면 맞춤 (Zoom to Fit)', onClick: handleZoomToFit, icon: <Maximize2 size={15} /> },
          { title: '원래 배율 1:1 리셋', onClick: handleResetZoom, icon: <RotateCcw size={15} /> },
          { title: '다이어그램 이미지(PNG) 내보내기', onClick: handleExportPNG, icon: <Camera size={15} /> },
        ].map((b) => (
          <button key={b.title} className="btn btn-icon" title={b.title} onClick={b.onClick} style={{ width: 30, height: 30, padding: 0 }}>
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
