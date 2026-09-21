// Keep return context on the actual browser entry, including filters and dates.
// A global "previous page" goes stale as soon as a user goes back or opens a tab.
type Entry = { href: string; parents: string[] };
const KEY = "lapisReturn";
export function localHref(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f]/.test(value) &&
    value.split(/[?#]/)[0] !== "/auth"
  );
}
const here = () => location.pathname + location.search + location.hash;
function current(): Entry | null {
  const entry = window.history.state?.[KEY] as Entry | undefined;
  return entry && localHref(entry.href) && Array.isArray(entry.parents)
    ? entry
    : null;
}
export function returnHref(fallback: string) {
  const entry = current();
  const parent = entry?.parents.at(-1);
  return parent && localHref(parent) && window.history.length > 1
    ? parent
    : fallback;
}
export function canReturn() {
  const entry = current();
  return Boolean(
    entry?.parents.length &&
    localHref(entry.parents.at(-1)) &&
    window.history.length > 1,
  );
}
export function trackNavigation() {
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  // Retain valid entry context on reload; an address-bar visit starts fresh.
  replace.call(
    window.history,
    {
      ...window.history.state,
      [KEY]: current() ?? { href: here(), parents: [] },
    },
    "",
  );
  function stateFor(
    state: unknown,
    url: string | URL | null | undefined,
    isPush: boolean,
  ) {
    const next = new URL(url?.toString() || location.href, location.href);
    const href = next.pathname + next.search + next.hash;
    const previous = current();
    const parents =
      isPush && localHref(here())
        ? [...(previous?.parents ?? []), here()].slice(-50)
        : (previous?.parents ?? []);
    return {
      ...(state as object),
      [KEY]: { href, parents: localHref(href) ? parents : [] },
    };
  }
  const pushTracked: History["pushState"] = function (
    this: History,
    state,
    title,
    url,
  ) {
    push.call(this, stateFor(state, url, true), title, url);
  };
  const replaceTracked: History["replaceState"] = function (
    this: History,
    state,
    title,
    url,
  ) {
    replace.call(this, stateFor(state, url, false), title, url);
  };
  window.history.pushState = pushTracked;
  window.history.replaceState = replaceTracked;
  return () => {
    if (window.history.pushState === pushTracked)
      window.history.pushState = push;
    if (window.history.replaceState === replaceTracked)
      window.history.replaceState = replace;
  };
}
