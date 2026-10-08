// The reading's own "updated HH:MM" sits two lines below in the hero, so quoting the same time here
// made the first screen say it twice. The notice now carries only the caveat.
export function StaleBanner() {
  return <p className="banner" role="status">Data may be out of date</p>;
}
