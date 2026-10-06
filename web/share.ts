import type { Region } from '../shared/types.ts';
import type { ScaleSpec } from '../shared/scale.ts';
import { fmtDay, fmtTime, regionName } from './format.ts';

type CardOpts = { spec: ScaleSpec; region: Region; value: number; ts: string };

export const shareText = (spec: ScaleSpec, region: Region, value: number) =>
  `${regionName(region)} ${spec.name} ${value}, ${spec.band(value).label.toLowerCase()}. ${spec.verdict(value)[1]}`;

// ts is +08:00, so its first 10 chars are the SGT date.
export const shareFilename = (region: Region, ts: string) => `hazecheck-${region}-${ts.slice(0, 10)}.png`;

export const shareMode = (nav: { canShare?: (d: ShareData) => boolean }, file: File): 'files' | 'download' =>
  nav.canShare?.({ files: [file] }) ? 'files' : 'download';

export const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export async function drawCard({ spec, region, value, ts }: CardOpts): Promise<Blob> {
  await document.fonts.ready;
  const band = spec.band(value);
  const [line1, line2] = spec.verdict(value);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const g = canvas.getContext('2d')!;
  g.fillStyle = band.color;
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = band.onColor;
  g.textBaseline = 'alphabetic';
  const font = (px: number, w: number) => { g.font = `${w} ${px}px 'Bricolage Grotesque Variable', system-ui, sans-serif`; };
  // Shrinks the font until the line fits the card's 904px text column.
  const text = (s: string, y: number, w: number, start: number) => {
    const px = fitFont((px) => { font(px, w); return g.measureText(s).width; }, start, 904, 40);
    font(px, w);
    g.fillText(s, 88, y);
  };
  text(regionName(region), 160, 600, 56);
  text(`${spec.name} ${value}`, 400, 600, 200);
  text(line1, 560, 400, 72); text(line2, 650, 400, 72);
  text(`${band.label} · ${fmtTime(ts)}, ${fmtDay(ts.slice(0, 10))}`, 780, 400, 40);
  text('HazeCheck', 1080 - 88, 600, 36);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

// Largest px (stepping down by 2 from start) at which widthAt(px) <= max, never below floor.
export function fitFont(widthAt: (px: number) => number, start: number, max: number, floor: number): number {
  let px = start;
  while (px > floor && widthAt(px) > max) px = Math.max(floor, px - 2);
  return px;
}

export const makeCardFile = async (o: CardOpts) =>
  new File([await drawCard(o)], shareFilename(o.region, o.ts), { type: 'image/png' });

// No await before navigator.share: keeps the tap's user gesture alive on iOS Safari.
export async function shareFile(file: File, text: string, publicUrl: string | null): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (shareMode(navigator, file) === 'files') {
    try {
      await navigator.share({ files: [file], text, ...(publicUrl ? { url: publicUrl } : {}) });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
