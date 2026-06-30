import type { EdgeProps } from '@xyflow/react';

export default function CustomBarkerEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps & { data?: any }) {
  const xm = (sourceX + targetX) / 2;

  // Extract Barker properties from data (with sensible defaults)
  const cardinality = data?.cardinality || 'one_to_many';
  const parentParticipation = data?.parent_participation || '0..M';
  const childParticipation = data?.child_participation || '1..1';
  const identifying = data?.identifying ?? false;

  // Determine segment styles
  // Parent side segment (Source) - optionality corresponds to child_participation (child to parent)
  const isSourceOptional = childParticipation.startsWith('0');
  // Child side segment (Target) - optionality corresponds to parent_participation (parent to child)
  const isTargetOptional = parentParticipation.startsWith('0');

  // Line style
  const strokeColor = selected ? 'var(--accent-color)' : '#94a3b8';
  const strokeWidth = selected ? 3 : 2;

  // Direction modifier
  const dir = targetX >= sourceX ? 1 : -1;

  return (
    <g className="react-flow__edge-path-group">
      {/* 1. Source Segment (Horizontal) */}
      <line
        x1={sourceX}
        y1={sourceY}
        x2={xm}
        y2={sourceY}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isSourceOptional ? '4 3' : undefined}
      />

      {/* 2. Middle Segment (Vertical) */}
      <line
        x1={xm}
        y1={sourceY}
        x2={xm}
        y2={targetY}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={identifying ? undefined : '4 3'}
      />

      {/* 3. Target Segment (Horizontal) */}
      <line
        x1={xm}
        y1={targetY}
        x2={targetX}
        y2={targetY}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isTargetOptional ? '4 3' : undefined}
      />

      {/* Source Endpoint Markers (Parent / One side) */}
      {childParticipation === '1..1' && (
        <line
          x1={sourceX + dir * 10}
          y1={sourceY - 6}
          x2={sourceX + dir * 10}
          y2={sourceY + 6}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
      {childParticipation === '0..1' && (
        <>
          <circle
            cx={sourceX + dir * 14}
            cy={sourceY}
            r={3}
            fill="var(--bg-main)"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <line
            x1={sourceX + dir * 8}
            y1={sourceY - 6}
            x2={sourceX + dir * 8}
            y2={sourceY + 6}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </>
      )}

      {/* Target Endpoint Markers (Child / Many side or One side depending on cardinality) */}
      {cardinality === 'one_to_many' ? (
        <>
          {/* Crow's foot fork lines */}
          <line
            x1={targetX - dir * 12}
            y1={targetY - 6}
            x2={targetX}
            y2={targetY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <line
            x1={targetX - dir * 12}
            y1={targetY + 6}
            x2={targetX}
            y2={targetY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          
          {/* Mandatory bar or optional circle */}
          {parentParticipation === '1..M' ? (
            <line
              x1={targetX - dir * 16}
              y1={targetY - 6}
              x2={targetX - dir * 16}
              y2={targetY + 6}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          ) : (
            <circle
              cx={targetX - dir * 16}
              cy={targetY}
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
              x1={targetX - dir * 10}
              y1={targetY - 6}
              x2={targetX - dir * 10}
              y2={targetY + 6}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
          {parentParticipation === '0..1' && (
            <>
              <circle
                cx={targetX - dir * 14}
                cy={targetY}
                r={3}
                fill="var(--bg-main)"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <line
                x1={targetX - dir * 8}
                y1={targetY - 6}
                x2={targetX - dir * 8}
                y2={targetY + 6}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </>
          )}
        </>
      )}
    </g>
  );
}
