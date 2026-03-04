// DiceMaterial.ts — Material + Vertex Colors para dados 3D

import * as THREE from 'three';
import type { DieColor } from '../core/types';

const CELL = 128;
const ATLAS_W = CELL * 6;
const ATLAS_H = CELL;

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function buildAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d')!;

  for (let face = 1; face <= 6; face++) {
    const x0 = (face - 1) * CELL;

    // Near-white background so vertexColor shows the die's actual color:
    //   vertex_color × #ebebeb ≈ vertex_color  (near-1 multiplier)
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(x0, 0, CELL, CELL);

    // Subtle rounded-rect border
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0 + 5, 5, CELL - 10, CELL - 10);

    // Dark pips — stay dark regardless of die color
    const pipR = face === 1 ? 14 : 10;
    for (const [px, py] of PIPS[face]) {
      const cx = x0 + px * CELL;
      const cy = py * CELL;
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cx, cy, pipR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}

export function createDiceMaterial(): THREE.MeshStandardMaterial {
  const canvas = buildAtlas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.45,
    metalness: 0.05,
  });
}

export const DIE_COLOR_MAP: Record<DieColor, THREE.Color> = {
  white:  new THREE.Color(0.95, 0.95, 0.95),
  red:    new THREE.Color(0.92, 0.22, 0.22),
  blue:   new THREE.Color(0.22, 0.35, 0.95),
  green:  new THREE.Color(0.15, 0.85, 0.25),
  yellow: new THREE.Color(0.95, 0.88, 0.10),
  orange: new THREE.Color(0.95, 0.48, 0.08),
  purple: new THREE.Color(0.60, 0.15, 0.90),
  black:  new THREE.Color(0.12, 0.12, 0.14),
};