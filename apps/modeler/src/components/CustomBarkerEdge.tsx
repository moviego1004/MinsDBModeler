import { useStore, Position } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useCallback } from 'react';

export default function CustomBarkerEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  data,
  selected,
}: EdgeProps & { data?: any }) {
  // 1. Fetch nodes from React Flow store to calculate dynamic floating ports
  const sourceNode = useStore(useCallback((store: any) => store.nodeLookup.get(source), [source]));
  const targetNode = useStore(useCallback((store: any) => store.nodeLookup.get(target), [target]));

  // Default coordinate fallback
  let sX = sourceX;
  let sY = sourceY;
  let tX = targetX;
  let tY = targetY;
  let isVertical = sourcePosition === Position.Top || sourcePosition === Position.Bottom;

  if (sourceNode && targetNode) {
    const sWidth = sourceNode.measured?.width ?? sourceNode.width ?? 250;
    const sHeight = sourceNode.measured?.height ?? sourceNode.height ?? 120;
    const tWidth = targetNode.measured?.width ?? targetNode.width ?? 250;
    const tHeight = targetNode.measured?.height ?? targetNode.height ?? 120;

    const sPosAbs = sourceNode.internals?.positionAbsolute ?? sourceNode.position;
    const tPosAbs = targetNode.internals?.positionAbsolute ?? targetNode.position;

    const sx = sPosAbs.x;
    const sy = sPosAbs.y;
    const tx = tPosAbs.x;
    const ty = tPosAbs.y;

    // Center coordinates
    const scx = sx + sWidth / 2;
    const scy = sy + sHeight / 2;
    const tcx = tx + tWidth / 2;
    const tcy = ty + tHeight / 2;

    const dx = tcx - scx;
    const dy = tcy - scy;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal relationship
      isVertical = false;
      if (dx > 0) {
        // Source Right -> Target Left
        sX = sx + sWidth;
        sY = scy;
        tX = tx;
        tY = tcy;
      } else {
        // Source Left -> Target Right
        sX = sx;
        sY = scy;
        tX = tx + tWidth;
        tY = tcy;
      }
    } else {
      // Vertical relationship
      isVertical = true;
      if (dy > 0) {
        // Source Bottom -> Target Top
        sX = scx;
        sY = sy + sHeight;
        tX = tcx;
        tY = ty;
      } else {
        // Source Top -> Target Bottom
        sX = scx;
        sY = sy;
        tX = tcx;
        tY = ty + tHeight;
      }
    }
  }

  // Extract Barker properties from data
  const cardinality = data?.cardinality || 'one_to_many';
  const parentParticipation = data?.parent_participation || '0..M';
  const childParticipation = data?.child_participation || '1..1';
  const identifying = data?.identifying ?? false;

  // Optionality logic
  const isSourceOptional = childParticipation.startsWith('0');
  const isTargetOptional = parentParticipation.startsWith('0');

  // Styling
  const strokeColor = selected ? 'var(--accent-color)' : '#94a3b8';
  const strokeWidth = selected ? 3 : 2;

  // Path components based on orientation
  const xm = (sX + tX) / 2;
  const ym = (sY + tY) / 2;
  const dir = isVertical ? (tY >= sY ? 1 : -1) : (tX >= sX ? 1 : -1);

  return (
    <g className="react-flow__edge-path-group">
      {!isVertical ? (
        <>
          {/* H-V-H Orthogonal Routing */}
          {/* 1. Source Side (Horizontal) */}
          <line
            x1={sX}
            y1={sY}
            x2={xm}
            y2={sY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isSourceOptional ? '4 3' : undefined}
          />
          {/* 2. Middle (Vertical) */}
          <line
            x1={xm}
            y1={sY}
            x2={xm}
            y2={tY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={identifying ? undefined : '4 3'}
          />
          {/* 3. Target Side (Horizontal) */}
          <line
            x1={xm}
            y1={tY}
            x2={tX}
            y2={tY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isTargetOptional ? '4 3' : undefined}
          />
        </>
      ) : (
        <>
          {/* V-H-V Orthogonal Routing */}
          {/* 1. Source Side (Vertical) */}
          <line
            x1={sX}
            y1={sY}
            x2={sX}
            y2={ym}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isSourceOptional ? '4 3' : undefined}
          />
          {/* 2. Middle (Horizontal) */}
          <line
            x1={sX}
            y1={ym}
            x2={tX}
            y2={ym}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={identifying ? undefined : '4 3'}
          />
          {/* 3. Target Side (Vertical) */}
          <line
            x1={tX}
            y1={ym}
            x2={tX}
            y2={tY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isTargetOptional ? '4 3' : undefined}
          />
        </>
      )}

      {/* Source Endpoint Markers (Parent / One side) */}
      {!isVertical ? (
        // Horizontal Markers
        <>
          {childParticipation === '1..1' && (
            <line
              x1={sX + dir * 10}
              y1={sY - 6}
              x2={sX + dir * 10}
              y2={sY + 6}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
          {childParticipation === '0..1' && (
            <>
              <circle
                cx={sX + dir * 14}
                cy={sY}
                r={3}
                fill="var(--bg-main)"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={sX + dir * 8}
                y1={sY - 6}
                x2={sX + dir * 8}
                y2={sY + 6}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </>
          )}
        </>
      ) : (
        // Vertical Markers
        <>
          {childParticipation === '1..1' && (
            <line
              x1={sX - 6}
              y1={sY + dir * 10}
              x2={sX + 6}
              y2={sY + dir * 10}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
          {childParticipation === '0..1' && (
            <>
              <circle
                cx={sX}
                cy={sY + dir * 14}
                r={3}
                fill="var(--bg-main)"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={sX - 6}
                y1={sY + dir * 8}
                x2={sX + 6}
                y2={sY + dir * 8}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </>
          )}
        </>
      )}

      {/* Target Endpoint Markers (Child / Many side or One side depending on cardinality) */}
      {!isVertical ? (
        // Horizontal Target Markers
        cardinality === 'one_to_many' ? (
          <>
            {/* Crow's foot fork lines */}
            <line
              x1={tX - dir * 12}
              y1={tY - 6}
              x2={tX}
              y2={tY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <line
              x1={tX - dir * 12}
              y1={tY + 6}
              x2={tX}
              y2={tY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            
            {/* Mandatory bar or optional circle */}
            {parentParticipation === '1..M' ? (
              <line
                x1={tX - dir * 16}
                y1={tY - 6}
                x2={tX - dir * 16}
                y2={tY + 6}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            ) : (
              <circle
                cx={tX - dir * 16}
                cy={tY}
                r={3}
                fill="var(--bg-main)"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            )}
          </>
        ) : (
          <>
            {parentParticipation === '1..1' && (
              <line
                x1={tX - dir * 10}
                y1={tY - 6}
                x2={tX - dir * 10}
                y2={tY + 6}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            )}
            {parentParticipation === '0..1' && (
              <>
                <circle
                  cx={tX - dir * 14}
                  cy={tY}
                  r={3}
                  fill="var(--bg-main)"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={tX - dir * 8}
                  y1={tY - 6}
                  x2={tX - dir * 8}
                  y2={tY + 6}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
              </>
            )}
          </>
        )
      ) : (
        // Vertical Target Markers
        cardinality === 'one_to_many' ? (
          <>
            {/* Crow's foot fork lines (Vertical) */}
            <line
              x1={tX - 6}
              y1={tY - dir * 12}
              x2={tX}
              y2={tY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <line
              x1={tX + 6}
              y1={tY - dir * 12}
              x2={tX}
              y2={tY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            
            {/* Mandatory bar or optional circle */}
            {parentParticipation === '1..M' ? (
              <line
                x1={tX - 6}
                y1={tY - dir * 16}
                x2={tX + 6}
                y2={tY - dir * 16}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            ) : (
              <circle
                cx={tX}
                cy={tY - dir * 16}
                r={3}
                fill="var(--bg-main)"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            )}
          </>
        ) : (
          <>
            {parentParticipation === '1..1' && (
              <line
                x1={tX - 6}
                y1={tY - dir * 10}
                x2={tX + 6}
                y2={tY - dir * 10}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            )}
            {parentParticipation === '0..1' && (
              <>
                <circle
                  cx={tX}
                  cy={tY - dir * 14}
                  r={3}
                  fill="var(--bg-main)"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={tX - 6}
                  y1={tY - dir * 8}
                  x2={tX + 6}
                  y2={tY - dir * 8}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
              </>
            )}
          </>
        )
      )}
    </g>
  );
}
