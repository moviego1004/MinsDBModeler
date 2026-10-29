import type { Point } from '../types.js';
import type { BoundingBox, PortDirection, RouteOptions, RouteResult, DiagramEdge } from './types.js';

/**
 * Calculates a clean, orthogonal (right-angled) route between two bounding boxes
 * with distributed ports, midpoint routing, lane offsets, and obstacle avoidance.
 */
export function calculateOrthogonalRoute(
  source: BoundingBox,
  target: BoundingBox,
  options: RouteOptions = {}
): RouteResult {
  const {
    sourceEdgeIndex = 0,
    totalSourceEdges = 1,
    targetEdgeIndex = 0,
    totalTargetEdges = 1,
    channelOffset = 0,
    preferredSourcePort,
    preferredTargetPort,
    padding = 20,
  } = options;

  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  // Determine direction: prioritize preferred ports or natural layout gap
  let sourceDirection: PortDirection;
  let targetDirection: PortDirection;

  if (preferredSourcePort && preferredTargetPort) {
    sourceDirection = preferredSourcePort;
    targetDirection = preferredTargetPort;
  } else {
    // Check vertical separation vs horizontal separation
    const sBottom = source.y + source.height;
    const tBottom = target.y + target.height;
    const sRight = source.x + source.width;
    const tRight = target.x + target.width;

    const isTargetClearlyBelow = target.y >= sBottom - 10;
    const isTargetClearlyAbove = source.y >= tBottom - 10;
    const isTargetClearlyRight = target.x >= sRight - 10;
    const isTargetClearlyLeft = source.x >= tRight - 10;

    if (isTargetClearlyBelow) {
      sourceDirection = 'bottom';
      targetDirection = 'top';
    } else if (isTargetClearlyAbove) {
      sourceDirection = 'top';
      targetDirection = 'bottom';
    } else if (isTargetClearlyRight) {
      sourceDirection = 'right';
      targetDirection = 'left';
    } else if (isTargetClearlyLeft) {
      sourceDirection = 'left';
      targetDirection = 'right';
    } else {
      // Overlapping or diagonal
      if (Math.abs(dy) >= Math.abs(dx)) {
        sourceDirection = dy >= 0 ? 'bottom' : 'top';
        targetDirection = dy >= 0 ? 'top' : 'bottom';
      } else {
        sourceDirection = dx >= 0 ? 'right' : 'left';
        targetDirection = dx >= 0 ? 'left' : 'right';
      }
    }
  }

  // Calculate distributed ports with safe margins away from corners
  let sourcePort: Point;
  let targetPort: Point;

  const margin = 16; // minimum distance from box corners

  if (sourceDirection === 'bottom' || sourceDirection === 'top') {
    const usableWidth = Math.max(20, source.width - margin * 2);
    const sPortX = source.x + margin + (usableWidth / (totalSourceEdges + 1)) * (sourceEdgeIndex + 1);
    const sPortY = sourceDirection === 'bottom' ? source.y + source.height : source.y;
    sourcePort = { x: sPortX, y: sPortY };
  } else {
    const usableHeight = Math.max(20, source.height - margin * 2);
    const sPortY = source.y + margin + (usableHeight / (totalSourceEdges + 1)) * (sourceEdgeIndex + 1);
    const sPortX = sourceDirection === 'right' ? source.x + source.width : source.x;
    sourcePort = { x: sPortX, y: sPortY };
  }

  if (targetDirection === 'bottom' || targetDirection === 'top') {
    const usableWidth = Math.max(20, target.width - margin * 2);
    const tPortX = target.x + margin + (usableWidth / (totalTargetEdges + 1)) * (targetEdgeIndex + 1);
    const tPortY = targetDirection === 'bottom' ? target.y + target.height : target.y;
    targetPort = { x: tPortX, y: tPortY };
  } else {
    const usableHeight = Math.max(20, target.height - margin * 2);
    const tPortY = target.y + margin + (usableHeight / (totalTargetEdges + 1)) * (targetEdgeIndex + 1);
    const tPortX = targetDirection === 'right' ? target.x + target.width : target.x;
    targetPort = { x: tPortX, y: tPortY };
  }

  // Calculate waypoints with Lane Offset to prevent overlapping parallel segments
  const waypoints: Point[] = [sourcePort];

  const isVerticalFlow =
    (sourceDirection === 'bottom' && targetDirection === 'top') ||
    (sourceDirection === 'top' && targetDirection === 'bottom');

  const isHorizontalFlow =
    (sourceDirection === 'right' && targetDirection === 'left') ||
    (sourceDirection === 'left' && targetDirection === 'right');

  if (isVerticalFlow) {
    const sBottom = source.y + source.height;
    const tTop = target.y;
    const sTop = source.y;
    const tBottom = target.y + target.height;

    const hasDirectVerticalGap =
      (sourceDirection === 'bottom' && sBottom + 10 <= tTop) ||
      (sourceDirection === 'top' && tBottom + 10 <= sTop);

    if (hasDirectVerticalGap) {
      // 3-segment orthogonal path with Lane Offset on midY
      const baseMidY = sourceDirection === 'bottom' ? (sBottom + tTop) / 2 : (sTop + tBottom) / 2;
      const midY = baseMidY + channelOffset;

      waypoints.push({ x: sourcePort.x, y: midY });
      waypoints.push({ x: targetPort.x, y: midY });
    } else {
      // 5-segment bypass path around horizontal bounds
      let outerX: number;
      if (scx <= tcx) {
        outerX = Math.min(source.x, target.x) - padding - Math.abs(channelOffset);
      } else {
        outerX = Math.max(source.x + source.width, target.x + target.width) + padding + Math.abs(channelOffset);
      }

      const sStubY = sourceDirection === 'bottom' ? sourcePort.y + padding : sourcePort.y - padding;
      const tStubY = targetDirection === 'top' ? targetPort.y - padding : targetPort.y + padding;

      waypoints.push({ x: sourcePort.x, y: sStubY });
      waypoints.push({ x: outerX, y: sStubY });
      waypoints.push({ x: outerX, y: tStubY });
      waypoints.push({ x: targetPort.x, y: tStubY });
    }
  } else if (isHorizontalFlow) {
    const sRight = source.x + source.width;
    const tLeft = target.x;
    const sLeft = source.x;
    const tRight = target.x + target.width;

    const hasDirectHorizontalGap =
      (sourceDirection === 'right' && sRight + 10 <= tLeft) ||
      (sourceDirection === 'left' && tRight + 10 <= sLeft);

    if (hasDirectHorizontalGap) {
      // 3-segment orthogonal path with Lane Offset on midX
      const baseMidX = sourceDirection === 'right' ? (sRight + tLeft) / 2 : (sLeft + tRight) / 2;
      const midX = baseMidX + channelOffset;

      waypoints.push({ x: midX, y: sourcePort.y });
      waypoints.push({ x: midX, y: targetPort.y });
    } else {
      // 5-segment bypass path around vertical bounds
      let outerY: number;
      if (scy <= tcy) {
        outerY = Math.min(source.y, target.y) - padding - Math.abs(channelOffset);
      } else {
        outerY = Math.max(source.y + source.height, target.y + target.height) + padding + Math.abs(channelOffset);
      }

      const sStubX = sourceDirection === 'right' ? sourcePort.x + padding : sourcePort.x - padding;
      const tStubX = targetDirection === 'left' ? targetPort.x - padding : targetPort.x + padding;

      waypoints.push({ x: sStubX, y: sourcePort.y });
      waypoints.push({ x: sStubX, y: outerY });
      waypoints.push({ x: tStubX, y: outerY });
      waypoints.push({ x: tStubX, y: targetPort.y });
    }
  } else {
    // L-shaped perpendicular transition (e.g., bottom -> left or right -> top)
    if (sourceDirection === 'bottom' || sourceDirection === 'top') {
      waypoints.push({ x: sourcePort.x, y: targetPort.y });
    } else {
      waypoints.push({ x: targetPort.x, y: sourcePort.y });
    }
  }

  waypoints.push(targetPort);

  // Simplify waypoints (eliminate duplicate points and collinear middle points)
  const cleanedWaypoints = simplifyWaypoints(waypoints);

  return {
    waypoints: cleanedWaypoints,
    sourcePort,
    targetPort,
    sourceDirection,
    targetDirection,
  };
}

/**
 * Calculates collision-free, clean orthogonal routes for all edges across a diagram,
 * matching DA# / enterprise ERD router quality.
 *
 * 1. Port Slotting: Grouped by node side and sorted by opposite entity coordinates to eliminate crossings.
 * 2. Lane Routing: Parallel trunks receive discrete lane offsets to eliminate overlapping collinear lines.
 */
export function calculateDiagramRoutes(
  nodes: (BoundingBox & { id: string })[],
  edges: DiagramEdge[],
  options: { padding?: number; laneSpacing?: number } = {}
): Record<string, RouteResult> {
  const { padding = 20, laneSpacing = 16 } = options;

  const nodeMap = new Map<string, BoundingBox & { id: string }>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Step 1: Pre-determine the best side for each edge
  interface EdgeSidePlan {
    edge: DiagramEdge;
    source: BoundingBox;
    target: BoundingBox;
    sourceSide: PortDirection;
    targetSide: PortDirection;
  }

  const plans: EdgeSidePlan[] = [];

  edges.forEach((edge) => {
    const sNode = nodeMap.get(edge.source);
    const tNode = nodeMap.get(edge.target);
    if (!sNode || !tNode) return;

    const scx = sNode.x + sNode.width / 2;
    const scy = sNode.y + sNode.height / 2;
    const tcx = tNode.x + tNode.width / 2;
    const tcy = tNode.y + tNode.height / 2;

    const dx = tcx - scx;
    const dy = tcy - scy;

    const sBottom = sNode.y + sNode.height;
    const tBottom = tNode.y + tNode.height;
    const sRight = sNode.x + sNode.width;
    const tRight = tNode.x + tNode.width;

    let sourceSide: PortDirection;
    let targetSide: PortDirection;

    if (tNode.y >= sBottom - 10) {
      sourceSide = 'bottom';
      targetSide = 'top';
    } else if (sNode.y >= tBottom - 10) {
      sourceSide = 'top';
      targetSide = 'bottom';
    } else if (tNode.x >= sRight - 10) {
      sourceSide = 'right';
      targetSide = 'left';
    } else if (sNode.x >= tRight - 10) {
      sourceSide = 'left';
      targetSide = 'right';
    } else {
      if (Math.abs(dy) >= Math.abs(dx)) {
        sourceSide = dy >= 0 ? 'bottom' : 'top';
        targetSide = dy >= 0 ? 'top' : 'bottom';
      } else {
        sourceSide = dx >= 0 ? 'right' : 'left';
        targetSide = dx >= 0 ? 'left' : 'right';
      }
    }

    plans.push({
      edge,
      source: sNode,
      target: tNode,
      sourceSide,
      targetSide,
    });
  });

  // Step 2: Group edges by node & side, then sort them to prevent crossings
  // sideKey: `${nodeId}:${side}` -> list of { edgeId, coord: number (x or y of other end) }
  const sideEdgeListMap = new Map<string, { edgeId: string; otherCoord: number }[]>();

  plans.forEach((plan) => {
    const sKey = `${plan.edge.source}:${plan.sourceSide}`;
    const tKey = `${plan.edge.target}:${plan.targetSide}`;

    const tCenterCoord =
      plan.sourceSide === 'top' || plan.sourceSide === 'bottom'
        ? plan.target.x + plan.target.width / 2
        : plan.target.y + plan.target.height / 2;

    const sCenterCoord =
      plan.targetSide === 'top' || plan.targetSide === 'bottom'
        ? plan.source.x + plan.source.width / 2
        : plan.source.y + plan.source.height / 2;

    if (!sideEdgeListMap.has(sKey)) sideEdgeListMap.set(sKey, []);
    sideEdgeListMap.get(sKey)!.push({ edgeId: plan.edge.id, otherCoord: tCenterCoord });

    if (!sideEdgeListMap.has(tKey)) sideEdgeListMap.set(tKey, []);
    sideEdgeListMap.get(tKey)!.push({ edgeId: plan.edge.id, otherCoord: sCenterCoord });
  });

  // Sort each side's edges by otherCoord
  const edgePortIndexMap = new Map<string, { sourceIdx: number; sourceTotal: number; targetIdx: number; targetTotal: number }>();

  sideEdgeListMap.forEach((list) => {
    list.sort((a, b) => a.otherCoord - b.otherCoord);
  });

  plans.forEach((plan) => {
    const sKey = `${plan.edge.source}:${plan.sourceSide}`;
    const tKey = `${plan.edge.target}:${plan.targetSide}`;

    const sList = sideEdgeListMap.get(sKey) || [];
    const tList = sideEdgeListMap.get(tKey) || [];

    const sourceIdx = Math.max(0, sList.findIndex((item) => item.edgeId === plan.edge.id));
    const targetIdx = Math.max(0, tList.findIndex((item) => item.edgeId === plan.edge.id));

    edgePortIndexMap.set(plan.edge.id, {
      sourceIdx,
      sourceTotal: sList.length,
      targetIdx,
      targetTotal: tList.length,
    });
  });

  // Step 3: Lane Allocation for parallel trunks to eliminate collinear overlaps
  // Group edges by connected pair or channel
  const pairEdgesMap = new Map<string, string[]>();

  plans.forEach((plan) => {
    // Normalise pair key regardless of direction
    const pairKey = [plan.edge.source, plan.edge.target].sort().join(':::');
    if (!pairEdgesMap.has(pairKey)) pairEdgesMap.set(pairKey, []);
    pairEdgesMap.get(pairKey)!.push(plan.edge.id);
  });

  const edgeChannelOffsetMap = new Map<string, number>();

  pairEdgesMap.forEach((edgeIds) => {
    const count = edgeIds.length;
    edgeIds.forEach((id, idx) => {
      // Symmetrically spread around center: e.g. for count=2 -> [-8, +8], for count=3 -> [-16, 0, 16]
      const offset = (idx - (count - 1) / 2) * laneSpacing;
      edgeChannelOffsetMap.set(id, offset);
    });
  });

  // Step 4: Compute final orthogonal routes for each edge
  const result: Record<string, RouteResult> = {};

  plans.forEach((plan) => {
    const portInfo = edgePortIndexMap.get(plan.edge.id) || {
      sourceIdx: 0,
      sourceTotal: 1,
      targetIdx: 0,
      targetTotal: 1,
    };
    const channelOffset = edgeChannelOffsetMap.get(plan.edge.id) ?? 0;

    const route = calculateOrthogonalRoute(plan.source, plan.target, {
      sourceEdgeIndex: portInfo.sourceIdx,
      totalSourceEdges: portInfo.sourceTotal,
      targetEdgeIndex: portInfo.targetIdx,
      totalTargetEdges: portInfo.targetTotal,
      channelOffset,
      preferredSourcePort: plan.sourceSide,
      preferredTargetPort: plan.targetSide,
      padding,
    });

    result[plan.edge.id] = route;
  });

  return result;
}

/**
 * Eliminates redundant collinear points and consecutive duplicates.
 */
export function simplifyWaypoints(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    // Skip duplicates
    if (Math.abs(prev.x - curr.x) < 0.1 && Math.abs(prev.y - curr.y) < 0.1) {
      continue;
    }

    // Check collinearity with next point
    if (i < points.length - 1) {
      const next = points[i + 1];
      const isCollinearX = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(curr.x - next.x) < 0.1;
      const isCollinearY = Math.abs(prev.y - curr.y) < 0.1 && Math.abs(curr.y - next.y) < 0.1;

      if (isCollinearX || isCollinearY) {
        continue; // Skip intermediate collinear point
      }
    }

    result.push(curr);
  }

  return result;
}
