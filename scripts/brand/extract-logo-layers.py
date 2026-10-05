"""Cut the NightLight logos into animatable layers.

The motion templates animate the real logo artwork, not a redraw of it. This
script splits both logo files in scripts/brand/source into separate layers
(every letter, the bolt, the neon rules / ring frame and the electric arcs),
keys the black background to transparency and writes:

  public/brand/logo/<logo>-<layer>.webp   trimmed RGBA layer
  public/brand/logo/<logo>-thumb.webp     small full logo for editor thumbnails
  remotion/brand-logo.ts                  layer positions on the logo canvas

Every pixel belongs to exactly one layer, so stacking the layers at their
offsets reproduces the original logo. Re-run after replacing a source file:

  pip install pillow numpy scipy
  python3 scripts/brand/extract-logo-layers.py

Component ids below are the connected components of the bright shapes at the
given threshold; if a source file changes, re-check them with a label preview.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts/brand/source'
OUT = ROOT / 'public/brand/logo'
TS_OUT = ROOT / 'remotion/brand-logo.ts'


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def box(xx, yy, x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def emblem_arcs(gid, names, xx, yy, lum):
    # Arcs sit outside the ring; each lives in a known region around it.
    outside = np.hypot(xx - 625, yy - 620) > 452
    region = (box(xx, yy, 785, 90, 880, 215)
              | (box(xx, yy, 965, 70, 1145, 290) & (yy < 290 - (xx - 1000) * 0.27 - 14))
              | box(xx, yy, 60, 680, 196, 768)
              | box(xx, yy, 1030, 690, 1130, 905)
              | box(xx, yy, 228, 975, 400, 1135))
    return (gid > 0) & outside & region


def wordmark_arcs(gid, names, xx, yy, lum):
    idx = lambda n: names.index(n) + 1
    core = gid > 0
    solid = nd.binary_dilation(nd.binary_opening(core, structure=disk(6)), structure=disk(4))
    # Tapered tips of the N tail and the bolt belong to the shape, not the arcs.
    tips = (box(xx, yy, 95, 630, 185, 725) | box(xx, yy, 1690, 270, 1765, 335) | box(xx, yy, 1530, 530, 1590, 585)) & core
    solid |= nd.binary_dilation(tips, structure=disk(3))
    loose = np.isin(gid, [idx('n'), idx('bolt')]) & ~solid
    # Dim arc strands that never reached the core threshold.
    far = nd.distance_transform_edt(~solid) > 18
    dim = (lum > 32) & ~core & far & ((xx < 470) | (xx > 1480))
    rule_line = 380 - (xx - 440) * 0.1068
    top = (gid == idx('rule-top')) & (xx > 1400) & (yy < rule_line - 12)
    arcs = loose | top | dim
    labels, count = nd.label(nd.binary_dilation(arcs, structure=disk(2)))
    sizes = nd.sum(arcs, labels, range(1, count + 1))
    return np.isin(labels, [i + 1 for i, size in enumerate(sizes) if size >= 150]) & arcs


LOGOS = {
    'emblem': dict(threshold=160, arcs=emblem_arcs, groups={
        'n1': [35], 'i1': [42], 'g1': [41], 'h1': [30], 't1': [21],
        'l2': [54], 'i2': [55], 'g2': [53], 'h2': [51], 't2': [48],
        'bolt': [31], 'frame': [7, 13, 52],
    }),
    'wordmark': dict(threshold=70, arcs=wordmark_arcs, groups={
        'n': [41], 'i': [92], 'g': [77], 'h': [70], 't': [60],
        'l': [59], 'i2': [57], 'g2': [49], 'h2': [45], 't2': [42],
        'bolt': [43], 'rule-top': [7], 'rule-bottom': [105],
    }),
}


def rgba(rgb, alpha):
    """Unpremultiply against black so the layer composites back to the original."""
    color = np.where(alpha[..., None] > 0, rgb / np.maximum(alpha, 1e-3)[..., None], 0)
    return np.dstack([np.clip(color, 0, 255), alpha * 255]).astype(np.uint8)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, cfg in LOGOS.items():
        rgb = np.asarray(Image.open(SOURCE / f'{name}.webp').convert('RGB')).astype(np.float32)
        lum = rgb.max(axis=2)
        labels, _ = nd.label(lum > cfg['threshold'])
        names = list(cfg['groups']) + ['arcs']
        gid = np.zeros(labels.shape, np.int16)
        for index, ids in enumerate(cfg['groups'].values()):
            gid[np.isin(labels, ids)] = index + 1
        yy, xx = np.indices(labels.shape)
        gid[cfg['arcs'](gid, names, xx, yy, lum)] = len(names)
        # Glow belongs to the layer of the nearest bright pixel.
        _, (iy, ix) = nd.distance_transform_edt(gid == 0, return_indices=True)
        owner = gid[iy, ix]

        alpha = np.clip((lum - 4) / 251, 0, 1)
        ys, xs = np.nonzero(alpha > 0.03)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgb, alpha, owner = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1], owner[y0:y1, x0:x1]
        thumb = Image.fromarray(rgba(rgb, alpha), 'RGBA')
        thumb.thumbnail((360, 360), Image.LANCZOS)
        thumb.save(OUT / f'{name}-thumb.webp', quality=90, method=6)

        layers = {}
        for index, layer in enumerate(names):
            layer_alpha = alpha * (owner == index + 1)
            ly, lx = np.nonzero(layer_alpha > 0.02)
            bx0, by0, bx1, by1 = int(lx.min()), int(ly.min()), int(lx.max() + 1), int(ly.max() + 1)
            image = rgba(rgb, layer_alpha)[by0:by1, bx0:bx1]
            Image.fromarray(image, 'RGBA').save(OUT / f'{name}-{layer}.webp', quality=92, method=6)
            layers[layer] = [bx0, by0, bx1 - bx0, by1 - by0]
        manifest[name] = {'width': int(x1 - x0), 'height': int(y1 - y0), 'layers': layers}

    lines = []
    for name, spec in manifest.items():
        lines.append(f"  '{name}': {{")
        lines.append(f"    width: {spec['width']},")
        lines.append(f"    height: {spec['height']},")
        lines.append('    layers: {')
        for layer, rect in spec['layers'].items():
            lines.append(f"      '{layer}': [{', '.join(map(str, rect))}],")
        lines.append('    },')
        lines.append('  },')
    body = '{\n' + '\n'.join(lines) + '\n}'
    TS_OUT.write_text(
        '// Generated by scripts/brand/extract-logo-layers.py. Do not edit by hand.\n'
        '// Layer rectangles are [x, y, width, height] on each logo canvas; the files\n'
        '// live in public/brand/logo.\n\n'
        f'export const BRAND_LOGOS = {body} as const\n\n'
        'export type BrandLogo = keyof typeof BRAND_LOGOS\n'
    )


if __name__ == '__main__':
    main()
