// Shared PREVIEW state. Authentication and agency-scoped publication are required
// before this store can be used for live server data.
export class StateStore {
  constructor() { this.revision = 0; this.state = null; this.source = ''; this.listeners = new Set(); }
  snapshot() { return { revision: this.revision, state: this.state, source: this.source }; }
  commit(expectedRevision, state, source = '') {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== this.revision)
      return { ok: false, status: 409, ...this.snapshot() };
    if (!state || !Array.isArray(state.agencies) || !Array.isArray(state.cameras)
      || !Array.isArray(state.recordings) || !Array.isArray(state.activity)
      || !state.evidence || typeof state.evidence !== 'object' || Array.isArray(state.evidence)
      || !state.settings || typeof state.settings !== 'object' || Array.isArray(state.settings))
      return { ok: false, status: 400, error: 'Invalid dashboard state.' };
    if (Buffer.byteLength(JSON.stringify(state)) > 131072)
      return { ok: false, status: 413, error: 'Preview state exceeds 128 KiB.' };
    this.state = structuredClone(state);
    this.source = String(source).slice(0, 80);
    this.revision++;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
    return { ok: true, ...snapshot };
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
