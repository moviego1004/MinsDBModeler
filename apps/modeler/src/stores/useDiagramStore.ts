import { create } from 'zustand';

export interface NodeLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface DiagramState {
  zoom: number;
  pan: { x: number; y: number };
  nodeLayouts: Record<string, NodeLayout>;

  // Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeDimensions: (id: string, width: number, height: number) => void;
  setAllNodeLayouts: (layouts: Record<string, NodeLayout>) => void;
  resetView: () => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  nodeLayouts: {},

  setZoom: (zoom: number) => set({ zoom }),
  setPan: (pan: { x: number; y: number }) => set({ pan }),

  updateNodePosition: (id: string, x: number, y: number) =>
    set((state) => ({
      nodeLayouts: {
        ...state.nodeLayouts,
        [id]: {
          ...state.nodeLayouts[id],
          x,
          y,
        },
      },
    })),

  updateNodeDimensions: (id: string, width: number, height: number) =>
    set((state) => ({
      nodeLayouts: {
        ...state.nodeLayouts,
        [id]: {
          ...state.nodeLayouts[id],
          width,
          height,
        },
      },
    })),

  setAllNodeLayouts: (layouts: Record<string, NodeLayout>) =>
    set({ nodeLayouts: layouts }),

  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
}));
