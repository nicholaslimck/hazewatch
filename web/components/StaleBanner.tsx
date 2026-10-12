// One line over a drained sky: why the reading on screen can't be trusted as current. When the
// server is unreachable the line itself is the retry control, like the offline card.
export function StaleBanner({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return onRetry
    ? <button type="button" className="banner" onClick={onRetry}>{text} Tap to retry.</button>
    : <p className="banner">{text}</p>;
}
