import type { Point } from '../types.js';
import type { BarkerSymbolDetails } from './types.js';

export interface BarkerSymbolOptions {
  isMany: boolean;
  isOptional: boolean;
  prongLength?: number;
  prongSpread?: number;
  circleRadius?: number;
  circleOffset?: number;
}

/**
 * Calculates exact coordinates for Barker notation Crow's foot and Optional circle.
 */
export function calculateBarkerEndpointSymbols(
  endpoint: Point,
  prevPoint: Point,
  options: BarkerSymbolOptions
): BarkerSymbolDetails {
  const {
    isMany,
    isOptional,
    prongLength = 12,
    prongSpread = 9,
    circleRadius = 3.5,
    circleOffset = 18,
  } = options;

  const result: BarkerSymbolDetails = {};

  // Direction vector pointing AWAY from endpoint (towards prevPoint)
  const dx = prevPoint.x - endpoint.x;
  const dy = prevPoint.y - endpoint.y;
  const len = Math.hypot(dx, dy);

  if (len < 0.1) return result;

  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular vector
  const px = -uy;
  const py = ux;

  // 1. Crow's Foot (Many)
  if (isMany) {
    const basePoint = {
      x: endpoint.x + ux * prongLength,
      y: endpoint.y + uy * prongLength,
    };
    const leftPoint = {
      x: basePoint.x + px * prongSpread,
      y: basePoint.y + py * prongSpread,
    };
    const rightPoint = {
      x: basePoint.x - px * prongSpread,
      y: basePoint.y - py * prongSpread,
    };

    result.crowFootLines = [
      [endpoint, leftPoint],
      [endpoint, basePoint],
      [endpoint, rightPoint],
    ];
  }

  // 2. Optionality Circle
  if (isOptional) {
    // If Many is present, push circle slightly further back so it doesn't collide with prongs
    const actualOffset = isMany ? circleOffset + prongLength * 0.4 : circleOffset;
    result.circle = {
      cx: endpoint.x + ux * actualOffset,
      cy: endpoint.y + uy * actualOffset,
      radius: circleRadius,
    };
  }

  return result;
}
