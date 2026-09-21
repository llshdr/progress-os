// In-memory, owner-scoped data. Never persisted to disk or shared with a server.
type Snapshot<T> = { data: T | null; error: string | null; revision: number };
export const emptyResource = { data: null, error: null, revision: 0 };
export class ClientResource<T> {
  snapshot: Snapshot<T> = emptyResource;
  updatedAt = 0;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  read = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: Snapshot<T>) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  invalidate = () => {
    this.generation++;
    this.pending = null;
    this.updatedAt = 0;
    this.publish({
      ...this.snapshot,
      error: null,
      revision: this.snapshot.revision + 1,
    });
  };
  clear() {
    this.generation++;
    this.pending = null;
    this.updatedAt = 0;
    this.publish({ ...emptyResource, revision: this.snapshot.revision + 1 });
  }
  load(loader: () => Promise<T>, maxAge = 60_000) {
    if (this.pending) return this.pending;
    if (this.updatedAt && Date.now() - this.updatedAt < maxAge)
      return Promise.resolve();
    const generation = this.generation;
    this.pending = Promise.resolve()
      .then(loader)
      .then((data) => {
        if (generation !== this.generation) return;
        this.updatedAt = Date.now();
        this.publish({ ...this.snapshot, data, error: null });
      })
      .catch((error) => {
        if (generation !== this.generation) return;
        this.publish({
          ...this.snapshot,
          error:
            error instanceof Error
              ? error.message
              : "Couldn't load this. Please retry.",
        });
      })
      .finally(() => {
        if (generation === this.generation) this.pending = null;
      });
    return this.pending;
  }
}
const resources = new Map<string, ClientResource<unknown>>();
export function userResource<T>(owner: string, key: string): ClientResource<T> {
  const id = `${owner}:${key}`;
  let entry = resources.get(id);
  if (!entry) {
    entry = new ClientResource();
    resources.set(id, entry);
  }
  return entry as ClientResource<T>;
}
export function invalidateResources(staleOnly = false) {
  resources.forEach((entry) => {
    if (!staleOnly || Date.now() - entry.updatedAt >= 60_000)
      entry.invalidate();
  });
}
export function clearResources() {
  resources.forEach((entry) => entry.clear());
  resources.clear();
}
