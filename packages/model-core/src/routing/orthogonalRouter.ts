import type { Point } from '../types.js';
import type { BoundingBox, PortDirection, RouteOptions, RouteResult } from './types.js';

/**
 * Calculates a clean, orthogonal (right-angled) route between two bounding boxes
 * with distributed ports, midpoint routing, and obstacle avoidance.
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
    padding = 16,
  } = options;

  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  // Primary orientation check
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  let sourcePort: Point;
  let targetPort: Point;
  let sourceDirection: PortDirection;
  let targetDirection: PortDirection;

  if (isHorizontal) {
    const sPortY = source.y + (source.height / (totalSourceEdges + 1)) * (sourceEdgeIndex + 1);
    const tPortY = target.y + (target.height / (totalTargetEdges + 1)) * (targetEdgeIndex + 1);

    if (dx >= 0) {
      sourcePort = { x: source.x + source.width, y: sPortY };
      sourceDirection = 'right';
      targetPort = { x: target.x, y: tPortY };
      targetDirection = 'left';
    } else {
      sourcePort = { x: source.x, y: sPortY };
      sourceDirection = 'left';
      targetPort = { x: target.x + target.width, y: tPortY };
      targetDirection = 'right';
    }
  } else {
    const sPortX = source.x + (source.width / (totalSourceEdges + 1)) * (sourceEdgeIndex + 1);
    const tPortX = target.x + (target.width / (totalTargetEdges + 1)) * (targetEdgeIndex + 1);

    if (dy >= 0) {
      sourcePort = { x: sPortX, y: source.y + source.height };
      sourceDirection = 'bottom';
      targetPort = { x: tPortX, y: target.y };
      targetDirection = 'top';
    } else {
      sourcePort = { x: sPortX, y: source.y };
      sourceDirection = 'top';
      targetPort = { x: tPortX, y: target.y + target.height };
      targetDirection = 'bottom';
    }
  }

  // Calculate waypoints
  const waypoints: Point[] = [sourcePort];

  if (isHorizontal) {
    const sRight = source.x + source.width;
    const tLeft = target.x;
    const tRight = target.x + target.width;
    const sLeft = source.x;

    if (sourceDirection === 'right' && sRight + padding * 2 <= tLeft) {
      // Source left of Target with sufficient gap
      const midX = (sRight + tLeft) / 2;
      waypoints.push({ x: midX, y: sourcePort.y });
      waypoints.push({ x: midX, y: targetPort.y });
    } else if (sourceDirection === 'left' && tRight + padding * 2 <= sLeft) {
      // Target left of Source with sufficient gap
      const midX = (sLeft + tRight) / 2;
      waypoints.push({ x: midX, y: sourcePort.y });
      waypoints.push({ x: midX, y: targetPort.y });
    } else {
      // Overlap or narrow horizontal clearance: route around bounds (5-segment)
      let outerY: number;
      if (scy < tcy) {
        outerY = Math.min(source.y, target.y) - padding;
      } else {
        outerY = Math.max(source.y + source.height, target.y + target.height) + padding;
      }

      const sStubX = sourceDirection === 'right' ? sourcePort.x + padding : sourcePort.x - padding;
      const tStubX = targetDirection === 'left' ? targetPort.x - padding : targetPort.x + padding;

      waypoints.push({ x: sStubX, y: sourcePort.y });
      waypoints.push({ x: sStubX, y: outerY });
      waypoints.push({ x: tStubX, y: outerY });
      waypoints.push({ x: tStubX, y: targetPort.y });
    }
  } else {
    // Vertical orientation
    const sBottom = source.y + source.height;
    const tTop = target.y;
    const tBottom = target.y + target.height;
    const sTop = source.y;

    if (sourceDirection === 'bottom' && sBottom + padding * 2 <= tTop) {
      // Source above Target with sufficient gap
      const midY = (sBottom + tTop) / 2;
      waypoints.push({ x: sourcePort.x, y: midY });
      waypoints.push({ x: targetPort.x, y: midY });
    } else if (sourceDirection === 'top' && tBottom + padding * 2 <= sTop) {
      // Target above Source with sufficient gap
      const midY = (sTop + tBottom) / 2;
      waypoints.push({ x: sourcePort.x, y: midY });
      waypoints.push({ x: targetPort.x, y: midY });
    } else {
      // Overlap or narrow vertical clearance: route around bounds (5-segment)
      let outerX: number;
      if (scx < tcx) {
        outerX = Math.min(source.x, target.x) - padding;
      } else {
        outerX = Math.max(source.x + source.width, target.x + target.width) + padding;
      }

      const sStubY = sourceDirection === 'bottom' ? sourcePort.y + padding : sourcePort.y - padding;
      const tStubY = targetDirection === 'top' ? targetPort.y - padding : targetPort.y + padding;

      waypoints.push({ x: sourcePort.x, y: sStubY });
      waypoints.push({ x: outerX, y: sStubY });
      waypoints.push({ x: outerX, y: tStubY });
      waypoints.push({ x: targetPort.x, y: tStubY });
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
        continue; // Skip the intermediate collinear point
      }
    }

    result.push(curr);
  }

  return result;
}
