import type { Point } from '../types.js';

export interface BoundingBox {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PortDirection = 'top' | 'bottom' | 'left' | 'right';

export interface RouteOptions {
  sourceEdgeIndex?: number;
  totalSourceEdges?: number;
  targetEdgeIndex?: number;
  totalTargetEdges?: number;
  edgeId?: string;
  preferredSourcePort?: PortDirection;
  preferredTargetPort?: PortDirection;
  obstacles?: BoundingBox[];
  padding?: number;
}

export interface RouteResult {
  waypoints: Point[];
  sourcePort: Point;
  targetPort: Point;
  sourceDirection: PortDirection;
  targetDirection: PortDirection;
}

export interface BarkerSymbolDetails {
  crowFootLines?: Point[][]; // Array of 2-point lines for 3 prongs
  circle?: { cx: number; cy: number; radius: number };
  barLine?: Point[]; // Optional mandatory bar
}
