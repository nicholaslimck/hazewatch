import { CARD, drawCard as paintCard, shareFilename } from '../shared/card.ts';
import type { CardCtx, CardOpts } from '../shared/card.ts';

// The layout lives in shared/card.ts so the bot draws the same card (server/card.ts). Re-exported to
// keep the existing importers (App.tsx, share.test.ts) working.
export { fitFont, shareFilename, shareText } from '../shared/card.ts';

export const shareMode = (nav: { canShare?: (d: ShareData) => boolean }, file: File): 'files' | 'download' =>
  nav.canShare?.({ files: [file] }) ? 'files' : 'download';

export const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export async function drawCard(o: CardOpts): Promise<Blob> {
  await document.fonts.ready; // before the first measureText, or the card is laid out in a fallback face
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CARD;
  paintCard(canvas.getContext('2d')! as unknown as CardCtx, o);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export const makeCardFile = async (o: CardOpts) =>
  new File([await drawCard(o)], shareFilename(o.region, o.ts), { type: 'image/png' });

// Link goes in the text: iOS drops the files when url is passed too.
// No await before navigator.share: keeps the tap's user gesture alive on iOS Safari.
export async function shareFile(file: File, text: string, link: string | null): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (shareMode(navigator, file) === 'files') {
    try {
      await navigator.share({ files: [file], text: link ? `${text} ${link}` : text });
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
