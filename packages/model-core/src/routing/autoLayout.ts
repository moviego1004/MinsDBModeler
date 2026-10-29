import type { Entity, Relationship, Point } from '../types.js';

export interface LayoutNodeResult {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AutoLayoutOptions {
  nodeWidth?: number;
  attrHeight?: number;
  headerHeight?: number;
  padding?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

/**
 * Computes hierarchical Layered-Tree auto layout for entities and their relationships.
 * Places parent entities on higher layers and child entities on lower layers.
 */
export function calculateLayeredAutoLayout(
  entities: Entity[],
  relationships: Relationship[],
  options: AutoLayoutOptions = {}
): Record<string, LayoutNodeResult> {
  const {
    nodeWidth = 260,
    attrHeight = 24,
    headerHeight = 36,
    padding = 20,
    horizontalSpacing = 60,
    verticalSpacing = 80,
  } = options;

  const entityMap = new Map<string, Entity>();
  entities.forEach((e) => entityMap.set(e.name, e));

  // 1. Calculate individual entity heights based on attributes
  const nodeSizes = new Map<string, { width: number; height: number }>();
  entities.forEach((ent) => {
    const totalAttrHeight = headerHeight + ent.attributes.length * attrHeight + 16;
    nodeSizes.set(ent.name, {
      width: nodeWidth,
      height: Math.max(80, totalAttrHeight),
    });
  });

  // 2. Identify root entities (not subtypes)
  const roots = entities.filter((e) => !e.supertype).map((e) => e.name);

  // 3. Build directed edges between roots for topological ranking
  const rootEdges: [string, string][] = [];
  relationships.forEach((rel) => {
    if (entityMap.has(rel.parent) && entityMap.has(rel.child) && rel.parent !== rel.child) {
      rootEdges.push([rel.parent, rel.child]);
    }
  });

  // 4. Calculate layers (ranks)
  const ranks = new Map<string, number>();
  roots.forEach((r) => ranks.set(r, 0));

  for (let i = 0; i < roots.length; i++) {
    let changed = false;
    rootEdges.forEach(([u, v]) => {
      const rankU = ranks.get(u) || 0;
      const rankV = ranks.get(v) || 0;
      if (rankU + 1 > rankV) {
        ranks.set(v, rankU + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }

  // 5. Group nodes by rank
  const nodesByRank = new Map<number, string[]>();
  roots.forEach((root) => {
    const rank = ranks.get(root) || 0;
    const list = nodesByRank.get(rank) || [];
    list.push(root);
    nodesByRank.set(rank, list);
  });

  // 6. Assign (x, y) coordinates layer by layer
  const layoutResults: Record<string, LayoutNodeResult> = {};
  const sortedRanks = Array.from(nodesByRank.keys()).sort((a, b) => a - b);

  let currentY = padding;

  sortedRanks.forEach((rank) => {
    const layerNodes = nodesByRank.get(rank) || [];
    let currentX = padding;
    let maxLayerHeight = 0;

    layerNodes.forEach((nodeName) => {
      const size = nodeSizes.get(nodeName) || { width: nodeWidth, height: 120 };
      maxLayerHeight = Math.max(maxLayerHeight, size.height);

      layoutResults[nodeName] = {
        id: nodeName,
        x: currentX,
        y: currentY,
        width: size.width,
        height: size.height,
      };

      currentX += size.width + horizontalSpacing;
    });

    currentY += maxLayerHeight + verticalSpacing;
  });

  return layoutResults;
}
