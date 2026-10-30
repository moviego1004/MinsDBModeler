import { approximateTextWidth } from '@barker-modeler/model-core';
import type { TextMeasurer } from '@barker-modeler/model-core';

// Konva's default font family; the layout engine must measure with the same font the canvas draws with.
const FONT_FAMILY = 'Arial';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

/** Exact text width via an offscreen canvas, falling back to the engine's approximation. */
export const canvasTextMeasurer: TextMeasurer = (text, fontSize, bold) => {
  if (ctx === undefined) {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!ctx) return approximateTextWidth(text, fontSize, bold);
  const key = `${bold ? 'b' : 'n'}${fontSize}|${text}`;
  let w = cache.get(key);
  if (w === undefined) {
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${FONT_FAMILY}`;
    w = ctx.measureText(text).width;
    if (cache.size > 5000) cache.clear();
    cache.set(key, w);
  }
  return w;
};
