// Transport for shared preview state. Website: SSE push. FiveM: server bridge.
class HuskyDashboardSync {
  constructor({ inGame, getState, applyState, onStatus, onConflict, isEditing }) {
    Object.assign(this, { inGame, getState, applyState, onStatus, onConflict, isEditing });
    this.clientId = 'preview-' + Math.random().toString(36).slice(2);
    this.revision = 0; this.enabled = false; this.dirty = false; this.writing = false;
    this.pending = null; this.initialized = false;
  }
  async request(method, body) {
    const response = await fetch(this.inGame ? `https://${GetParentResourceName()}/${method === 'GET' ? 'syncRead' : 'syncWrite'}` : '/api/state', {
      method: this.inGame ? 'POST' : method,
      headers: { 'Content-Type': 'application/json' },
      ...(method !== 'GET' || this.inGame ? { body: JSON.stringify(body || {}) } : {}),
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json();
    if (!response.ok && response.status !== 409) throw new Error(result.error || 'Sync unavailable');
    return result;
  }
  async connect() {
    try {
      const snapshot = await this.request('GET');
      if (snapshot.ok === false) throw new Error(snapshot.error || 'Sync unavailable');
      if (snapshot.disabled) { this.onStatus('Local preview · sync disabled'); return; }
      this.enabled = true;
      this.receive(snapshot, true);
      if (!snapshot.state) { this.dirty = true; await this.flush(); }
      if (!this.inGame) {
        this.events = new EventSource('/api/events');
        this.events.onmessage = event => { try { this.receive(JSON.parse(event.data)); } catch { this.onStatus('Invalid sync update'); } };
        this.events.onerror = () => this.onStatus('Reconnecting · preview sync');
        this.events.onopen = () => this.onStatus('Connected · shared preview');
      }
      this.onStatus('Connected · shared preview');
    } catch { this.onStatus('Offline · changes remain local'); }
  }
  receive(snapshot, force = false) {
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) return;
    if (!force && snapshot.revision <= this.revision && this.initialized) return;
    if (snapshot.source === this.clientId && !force) {
      this.revision = snapshot.revision; this.initialized = true; return;
    }
    if (!force && (this.dirty || this.writing || this.isEditing())) {
      this.pending = snapshot; this.onStatus('Update waiting · finish your edit'); return;
    }
    if (snapshot.state) this.applyState(snapshot.state);
    this.revision = snapshot.revision; this.initialized = true;
    this.onStatus('Connected · revision ' + this.revision);
  }
  changed() {
    if (!this.enabled) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 60);
  }
  async flush() {
    if (!this.enabled || !this.dirty || this.writing) return;
    this.writing = true; this.dirty = false;
    try {
      const result = await this.request('PUT', { baseRevision: this.revision, state: this.getState(), clientId: this.clientId });
      if (result.ok === false) {
        this.dirty = false; this.pending = null;
        if (result.status === 409 || result.revision !== undefined) {
          this.receive(result, true); this.onConflict();
        } else { this.onStatus('Sync rejected · changes remain local'); }
      } else {
        this.revision = result.revision;
        this.onStatus('Synced · revision ' + this.revision);
      }
    } catch { this.dirty = false; this.onStatus('Offline · changes not synced'); }
    finally {
      this.writing = false;
      if (this.pending) { const latest = this.pending; this.pending = null; this.receive(latest); }
      if (this.dirty) this.flush();
    }
  }
  applyPending() {
    if (!this.pending || this.dirty || this.writing || this.isEditing()) return;
    const latest = this.pending; this.pending = null; this.receive(latest);
  }
}
