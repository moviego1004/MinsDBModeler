import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Circle } from 'react-konva';
import type { Attribute, Point } from '@barker-modeler/model-core';
import { 
  calculateOrthogonalRoute, 
  calculateBarkerEndpointSymbols 
} from '@barker-modeler/model-core';

// Helper to fetch CSS variables for Canvas compatibility
const getCssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

interface KonvaModelerCanvasProps {
  nodes: any[];
  edges: any[];
  onNodesChange?: (changes: any) => void;
  onEdgesChange?: (changes: any) => void;
  onNodeDragStop?: (event: any, node: any, latestNodes: any[]) => void;
  onSelectionChange?: (selection: { nodes: any[]; edges: any[] }) => void;
  onNodeDoubleClick?: (event: any, node: any) => void;
  onPaneDoubleClick?: (event: any) => void;
  selectedEntityName?: string | null;
  selectedRelationshipId?: string | null;
  viewMode?: 'logical' | 'physical';
}

export default function KonvaModelerCanvas({
  nodes,
  edges,
  onNodesChange,
  onNodeDragStop,
  onSelectionChange,
  onNodeDoubleClick,
  onPaneDoubleClick,
  selectedEntityName,
  selectedRelationshipId,
  viewMode = 'logical',
}: KonvaModelerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [theme, setTheme] = useState({
    bg: '#f8fafc',
    border: '#cbd5e1',
    text: '#0f172a',
    textMuted: '#64748b',
    primary: '#2563eb',
    warning: '#d97706',
    accent: '#059669',
    entityBg: '#ffffff',
    entityBorder: '#94a3b8',
    entityHeaderBg: '#f1f5f9',
    subtypeBg: 'rgba(241, 245, 249, 0.6)',
    subtypeBorder: '#cbd5e1',
    groupBg: 'rgba(51, 65, 85, 0.1)',
    subtypeSetBg: 'rgba(234, 179, 8, 0.05)',
  });

  // Track dimensions dynamically with a safe ResizeObserver to prevent loops and support all UI state changes (Split/Canvas View)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let prevWidth = container.clientWidth || 800;
    let prevHeight = container.clientHeight || 600;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      
      const entry = entries[0];
      const newWidth = entry.contentRect.width || 800;
      const newHeight = entry.contentRect.height || 600;

      // Ignore tiny changes less than 3px to avoid infinite oscillation loops
      if (Math.abs(newWidth - prevWidth) >= 3 || Math.abs(newHeight - prevHeight) >= 3) {
        prevWidth = newWidth;
        prevHeight = newHeight;

        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
          setDimensions({
            width: newWidth,
            height: newHeight
          });
        });
      }
    });

    observer.observe(container);

    setDimensions({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Update theme colors when CSS variables change (e.g. Light/Dark Mode)
  useEffect(() => {
    const updateTheme = () => {
      setTheme({
        bg: getCssVar('--bg-main', '#f8fafc'),
        border: getCssVar('--border-color', '#cbd5e1'),
        text: getCssVar('--text-main', '#0f172a'),
        textMuted: getCssVar('--text-muted', '#64748b'),
        primary: getCssVar('--accent-color', '#2563eb'),
        warning: getCssVar('--warning', '#d97706'),
        accent: getCssVar('--success', '#059669'),
        entityBg: getCssVar('--entity-bg', '#ffffff'),
        entityBorder: getCssVar('--entity-border', '#94a3b8'),
        entityHeaderBg: getCssVar('--entity-header-bg', '#f1f5f9'),
        subtypeBg: getCssVar('--subtype-bg', 'rgba(241, 245, 249, 0.6)'),
        subtypeBorder: getCssVar('--subtype-border', '#cbd5e1'),
        groupBg: 'rgba(51, 65, 85, 0.1)',
        subtypeSetBg: 'rgba(234, 179, 8, 0.05)',
      });
    };
    updateTheme();
    
    // Listen to theme mutations if any class change on body/html
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  // Handle Zoom and Pan using wheel
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const speed = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * speed : oldScale / speed;
    
    // Zoom limits
    if (newScale < 0.15 || newScale > 4) return;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
  };

  const handleStageClick = (e: any) => {
    console.log("🔴 [Konva Canvas] Stage Clicked. Target:", e.target === stageRef.current ? "Stage Background" : "Child Element");
    // If clicking directly on stage, clear selection
    if (e.target === stageRef.current) {
      onSelectionChange?.({ nodes: [], edges: [] });
    }
  };

  const handleStageDblClick = (e: any) => {
    console.log("🔴 [Konva Canvas] Stage Double Clicked");
    if (e.target === stageRef.current) {
      onPaneDoubleClick?.(e.evt);
    }
  };

  const handleStageDragStart = (e: any) => {
    console.log("🔴 [Konva Canvas] Stage Drag Start target:", e.target?.constructor?.name);
    const stage = stageRef.current;
    if (stage && e.target !== stage) {
      console.log("🔴 [Konva Canvas] Stage Drag STOPPED because target is child");
      stage.stopDrag(); // Prevent stage dragging when a child node/resizer is dragged
    }
  };

  const handleNodeClick = (node: any, e: any) => {
    console.log("🔴 [Konva Canvas] Node Clicked. ID:", node.id);
    e.cancelBubble = true; // Stop event bubbling to stage
    onSelectionChange?.({ nodes: [node], edges: [] });
  };

  const handleNodeDblClick = (node: any, e: any) => {
    console.log("🔴 [Konva Canvas] Node Double Clicked. ID:", node.id);
    e.cancelBubble = true;
    onNodeDoubleClick?.(e.evt, node);
  };

  const handleEdgeClick = (edgeId: string, e: any) => {
    console.log("🔴 [Konva Canvas] Edge Clicked. ID:", edgeId);
    e.cancelBubble = true; // Stop event bubbling to stage
    const selectedEdge = edges.find((ed) => ed.id === edgeId);
    if (selectedEdge) {
      onSelectionChange?.({ nodes: [], edges: [selectedEdge] });
    }
  };

  // Node Drag Handlers
  const handleDragEnd = (node: any, e: any) => {
    const newX = e.target.x();
    const newY = e.target.y();
    console.log("🔴 [Konva Canvas] Node Drag End. ID:", node.id, "coords:", newX, newY);

    // Trigger position update via onNodesChange (matching React Flow changes spec)
    if (onNodesChange) {
      onNodesChange([
        {
          id: node.id,
          type: 'position',
          position: { x: newX, y: newY },
        },
      ]);
    }

    // Trigger drag stop callback
    if (onNodeDragStop) {
      const updatedNodes = nodes.map((n) =>
        n.id === node.id ? { ...n, position: { x: newX, y: newY } } : n
      );
      onNodeDragStop(e.evt, { ...node, position: { x: newX, y: newY } }, updatedNodes);
    }
  };

  // Render node contents based on node types
  const renderNode = (node: any) => {
    if (!node || !node.position) return null;
    const isSelected = selectedEntityName === node.data?.name || node.selected;
    const width = isNaN(node.width) || !node.width ? 250 : node.width;
    const height = isNaN(node.height) || !node.height ? 120 : node.height;
    const posX = node.position.x ?? 0;
    const posY = node.position.y ?? 0;
    const type = node.type || 'entityNode';
    const isPhysical = viewMode === 'physical' || node.data?.isPhysical;

    if (type === 'supertypeGroup') {
      // Custom Group Node (Supertype)
      const attributes: any[] = node.data?.attributes || [];
      return (
        <Group
          key={node.id}
          x={posX}
          y={posY}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onClick={(e) => handleNodeClick(node, e)}
          onDblClick={(e) => handleNodeDblClick(node, e)}
          onDragEnd={(e) => handleDragEnd(node, e)}
        >
          <Rect
            width={width}
            height={height}
            fill={theme.groupBg}
            stroke={isSelected ? theme.primary : theme.border}
            strokeWidth={isSelected ? 2 : 1}
            cornerRadius={8}
          />
          {/* Header */}
          <Rect
            width={width}
            height={36}
            fill={theme.entityHeaderBg}
            cornerRadius={[8, 8, 0, 0]}
          />
          <Text
            text={node.data.label || node.data.name}
            x={12}
            y={12}
            fontSize={13}
            fontStyle="bold"
            fill={theme.text}
          />
          <Text
            text="SUPERTYPE"
            x={width - 80}
            y={12}
            fontSize={10}
            fontStyle="bold"
            fill={theme.primary}
            align="right"
            width={70}
          />
          
          {/* Bottom line for header */}
          <Line
            points={[0, 36, width, 36]}
            stroke={theme.border}
            strokeWidth={1}
          />

          {/* Attributes List */}
          <Group y={42}>
            {attributes.map((attr, idx) => {
              const yPos = idx * 22;
              const isPK = attr.identifier;
              const isRequired = attr.required;
              const isFK = attr.fk;

              let marker = 'o';
              let markerColor = theme.textMuted;
              if (isPK) {
                marker = '#';
                markerColor = theme.primary;
              } else if (isRequired) {
                marker = '*';
                markerColor = theme.warning;
              }

              return (
                <Group key={idx} y={yPos} x={12}>
                  {/* Marker Symbol */}
                  <Text
                    text={marker}
                    x={0}
                    y={2}
                    fontSize={11}
                    fontStyle="bold"
                    fill={markerColor}
                  />
                  {/* Attribute Name */}
                  <Text
                    text={attr.name}
                    x={15}
                    y={2}
                    fontSize={11}
                    fill={theme.text}
                    width={width - 120}
                    ellipsis
                  />
                  {/* Domain / Datatype */}
                  {attr.domain && (
                    <Text
                      text={`${attr.domain}${isFK ? ' (FK)' : ''}`}
                      x={width - 110}
                      y={2}
                      fontSize={9}
                      fill={theme.textMuted}
                      align="right"
                      width={80}
                      ellipsis
                    />
                  )}
                </Group>
              );
            })}
          </Group>
        </Group>
      );
    }

    if (type === 'subtypeSetGroup') {
      // Subtype Set Group
      return (
        <Group
          key={node.id}
          x={posX}
          y={posY}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onClick={(e) => handleNodeClick(node, e)}
          onDblClick={(e) => handleNodeDblClick(node, e)}
          onDragEnd={(e) => handleDragEnd(node, e)}
        >
          <Rect
            width={width}
            height={height}
            fill={theme.subtypeSetBg}
            stroke={theme.warning}
            strokeWidth={1.5}
            dash={[6, 4]}
            cornerRadius={8}
          />
          <Text
            text={node.data.label}
            x={10}
            y={10}
            fontSize={10}
            fontStyle="bold"
            fill={theme.warning}
          />
        </Group>
      );
    }

    // Entity Node (default)
    const attributes: Attribute[] = node.data.attributes || [];
    const isSubtype = node.data.type === 'subtype';
    
    return (
      <Group
        key={node.id}
        x={posX}
        y={posY}
        draggable
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onClick={(e) => handleNodeClick(node, e)}
        onDblClick={(e) => handleNodeDblClick(node, e)}
        onDragEnd={(e) => handleDragEnd(node, e)}
      >
        {/* Main Entity Body */}
        <Rect
          width={width}
          height={height}
          fill={theme.entityBg}
          stroke={isSelected ? theme.primary : isSubtype ? theme.textMuted : theme.entityBorder}
          strokeWidth={isSelected ? 2 : 1}
          dash={isSubtype ? [5, 4] : undefined}
          cornerRadius={6}
        />
        {/* Header bar */}
        <Rect
          width={width}
          height={32}
          fill={theme.entityHeaderBg}
          cornerRadius={[6, 6, 0, 0]}
        />
        {/* Bottom line for header */}
        <Line
          points={[0, 32, width, 32]}
          stroke={isSubtype ? theme.textMuted : theme.entityBorder}
          strokeWidth={1}
          dash={isSubtype ? [5, 4] : undefined}
        />
        {/* Title */}
        <Text
          text={node.data.name}
          x={12}
          y={10}
          fontSize={12}
          fontStyle="bold"
          fill={theme.text}
          width={width - 80}
          ellipsis
        />
        {/* Entity Type Label */}
        <Text
          text={isPhysical ? 'TABLE' : node.data.type?.toUpperCase() || 'ENTITY'}
          x={width - 75}
          y={11}
          fontSize={9}
          fontStyle="bold"
          fill={isSubtype ? theme.warning : theme.textMuted}
          align="right"
          width={65}
        />

        {/* Attributes List */}
        <Group y={36}>
          {attributes.length > 0 ? (
            attributes.map((attr, idx) => {
              const yPos = idx * 22;
              if (yPos + 22 > height - 36) return null; // Simple clip
              
              const isPK = attr.identifier;
              const isRequired = attr.required;
              const isFK = attr.fk;

              let marker = 'o';
              let markerColor = theme.textMuted;
              if (isPK) {
                marker = '#';
                markerColor = theme.primary;
              } else if (isRequired) {
                marker = '*';
                markerColor = theme.warning;
              }

              return (
                <Group key={idx} y={yPos} x={12}>
                  {/* Marker Symbol */}
                  <Text
                    text={marker}
                    x={0}
                    y={2}
                    fontSize={11}
                    fontStyle="bold"
                    fill={markerColor}
                  />
                  {/* Attribute Name */}
                  <Text
                    text={attr.name}
                    x={15}
                    y={2}
                    fontSize={11}
                    fill={theme.text}
                    width={width - 120}
                    ellipsis
                  />
                  {/* Domain / Datatype */}
                  {attr.domain && (
                    <Text
                      text={`${attr.domain}${isFK ? ' (FK)' : ''}`}
                      x={width - 110}
                      y={2}
                      fontSize={9}
                      fill={theme.textMuted}
                      align="right"
                      width={80}
                      ellipsis
                    />
                  )}
                </Group>
              );
            })
          ) : (
            <Text
              text="+ Add attribute"
              x={12}
              y={8}
              fontSize={11}
              fontStyle="italic"
              fill={theme.textMuted}
            />
          )}
        </Group>

        {/* Node Resize Handle (if selected) */}
        {isSelected && (
          <Rect
            x={width - 8}
            y={height - 8}
            width={8}
            height={8}
            fill={theme.primary}
            cursor="se-resize"
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              // Custom resize logic
              const newWidth = Math.max(150, e.target.x() + 8);
              const newHeight = Math.max(60, e.target.y() + 8);
              e.target.x(newWidth - 8);
              e.target.y(newHeight - 8);
              
              if (onNodesChange) {
                onNodesChange([
                  {
                    id: node.id,
                    type: 'dimensions',
                    dimensions: { width: newWidth, height: newHeight },
                  },
                ]);
              }
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const newWidth = Math.max(150, e.target.x() + 8);
              const newHeight = Math.max(60, e.target.y() + 8);
              
              if (onNodesChange) {
                onNodesChange([
                  {
                    id: node.id,
                    type: 'dimensions',
                    dimensions: { width: newWidth, height: newHeight },
                  },
                ]);
              }

              if (onNodeDragStop) {
                const updatedNodes = nodes.map((n) =>
                  n.id === node.id ? { ...n, width: newWidth, height: newHeight } : n
                );
                onNodeDragStop(e.evt, { ...node, width: newWidth, height: newHeight }, updatedNodes);
              }
            }}
          />
        )}
      </Group>
    );
  };

  // Render Relationship Edges (Custom Barker routing in Canvas)
  const renderEdge = (edge: any) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return null;

    const sWidth = isNaN(sourceNode.width) || !sourceNode.width ? 250 : sourceNode.width;
    const sHeight = isNaN(sourceNode.height) || !sourceNode.height ? 120 : sourceNode.height;
    const tWidth = isNaN(targetNode.width) || !targetNode.width ? 250 : targetNode.width;
    const tHeight = isNaN(targetNode.height) || !targetNode.height ? 120 : targetNode.height;

    const sx = sourceNode.position.x ?? 0;
    const sy = sourceNode.position.y ?? 0;
    const tx = targetNode.position.x ?? 0;
    const ty = targetNode.position.y ?? 0;

    if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return null;

    // Calculate connected edges and index to distribute ports evenly
    const sourceEdges = edges.filter((e) => e.source === edge.source || e.target === edge.source);
    const sIdx = sourceEdges.findIndex((e) => e.id === edge.id);
    const sCount = sourceEdges.length || 1;

    const targetEdges = edges.filter((e) => e.source === edge.target || e.target === edge.target);
    const tIdx = targetEdges.findIndex((e) => e.id === edge.id);
    const tCount = targetEdges.length || 1;

    const card = (edge.data?.cardinality || 'one_to_many').toString().toLowerCase();
    const parentPart = (edge.data?.parent_participation || '0..M').toString().toUpperCase();
    const childParticipation = (edge.data?.child_participation || '1..1').toString();
    
    // Determine if target side is Many (Barker Crow's Foot)
    const isMany = card === 'one_to_many' || card === '1:m' || card === 'many_to_one' || parentPart.includes('M') || parentPart.includes('*');
    const isSourceOptional = parentPart.startsWith('0');
    const isTargetOptional = childParticipation.startsWith('0');

    const isSelected = selectedRelationshipId === edge.id || edge.selected;
    const strokeColor = isSelected ? theme.primary : theme.textMuted;
    const strokeWidth = isSelected ? 2.5 : 1.5;

    // Calculate clean orthogonal route with obstacle avoidance and distributed ports
    const route = calculateOrthogonalRoute(
      { x: sx, y: sy, width: sWidth, height: sHeight },
      { x: tx, y: ty, width: tWidth, height: tHeight },
      {
        sourceEdgeIndex: sIdx,
        totalSourceEdges: sCount,
        targetEdgeIndex: tIdx,
        totalTargetEdges: tCount,
        padding: 20,
      }
    );

    const waypoints = route.waypoints;
    const flatPoints = waypoints.flatMap((p: Point) => [p.x, p.y]);

    // Split waypoints into Source-half and Target-half for solid vs dashed participation styling
    const midIdx = Math.floor(waypoints.length / 2);
    const sourceHalfPoints = waypoints.slice(0, midIdx + 1).flatMap((p: Point) => [p.x, p.y]);
    const targetHalfPoints = waypoints.slice(midIdx).flatMap((p: Point) => [p.x, p.y]);

    // Calculate Barker Endpoints Symbols
    const targetSymbols = calculateBarkerEndpointSymbols(
      route.targetPort,
      waypoints[waypoints.length - 2] || route.sourcePort,
      { isMany, isOptional: isTargetOptional }
    );

    const sourceSymbols = calculateBarkerEndpointSymbols(
      route.sourcePort,
      waypoints[1] || route.targetPort,
      { isMany: false, isOptional: isSourceOptional }
    );

    return (
      <Group key={edge.id}>
        {/* Transparent Hitbox for easier relationship selection */}
        <Line
          points={flatPoints}
          stroke="transparent"
          strokeWidth={14}
          onClick={(e) => handleEdgeClick(edge.id, e)}
          cursor="pointer"
        />

        {/* Source-half (Solid if Mandatory, Dashed if Optional) */}
        <Line
          points={sourceHalfPoints}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={isSourceOptional ? [5, 4] : undefined}
          listening={false}
        />

        {/* Target-half (Solid if Mandatory, Dashed if Optional) */}
        <Line
          points={targetHalfPoints}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={isTargetOptional ? [5, 4] : undefined}
          listening={false}
        />

        {/* Source Side Markers (Optional circle) */}
        {sourceSymbols.circle && (
          <Circle
            cx={sourceSymbols.circle.cx}
            cy={sourceSymbols.circle.cy}
            r={sourceSymbols.circle.radius}
            fill={theme.bg}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        )}

        {/* Target Side Crow's Foot Lines (Many side) */}
        {targetSymbols.crowFootLines?.map((prong: Point[], i: number) => (
          <Line
            key={`cf-${i}`}
            points={[prong[0].x, prong[0].y, prong[1].x, prong[1].y]}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        ))}

        {/* Target Side Markers (Optional circle) */}
        {targetSymbols.circle && (
          <Circle
            cx={targetSymbols.circle.cx}
            cy={targetSymbols.circle.cy}
            r={targetSymbols.circle.radius}
            fill={theme.bg}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        )}
      </Group>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.bg,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onDblClick={handleStageDblClick}
        onDragStart={handleStageDragStart}
        draggable
      >
        <Layer>
          {/* Render Relationships (Edges) first so they lay behind Nodes */}
          {edges.map(renderEdge)}

          {/* Render Entity and Group Nodes */}
          {nodes.map(renderNode)}
        </Layer>
      </Stage>
    </div>
  );
}
