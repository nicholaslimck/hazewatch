import type { Region } from '../shared/types.ts';
import { regionName } from '../shared/format.ts';

// The tab/window title: the reading first, because a tab strip truncates from the right and the number is
// what the glance wants. Falls back to the bare name until a region and reading are known.
export function pageTitle(region: Region | null, scaleName: string, value: number | undefined): string {
  if (region === null || value === undefined) return 'HazeWatch';
  return `${regionName(region)} ${scaleName} ${Math.round(value)} — HazeWatch`;
}
