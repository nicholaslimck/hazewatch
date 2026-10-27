// Where each dashed band line's label goes on the 24-hour chart. `ys` are the lines' y positions (0 at
// the top), sorted top to bottom. A label sits above its line when there's room; when the line above is
// too close it flips below its own line, if that clears the next line and the chart floor; otherwise it
// is dropped (the dashed line stays). Flipping keeps the label for the band most likely to matter: two
// close lines used to drop the upper one's label, which was usually the band the air was in.
export function placeLabels(ys: number[], gap: number, height: number): ('above' | 'below' | null)[] {
  let free = -Infinity; // everything above this y is taken by a placed label
  return ys.map((py, i) => {
    const next = i + 1 < ys.length ? ys[i + 1] : height;
    if (py - gap >= free) { free = py; return 'above'; }
    if (py >= free && py + gap <= next) { free = py + gap; return 'below'; }
    return null;
  });
}
