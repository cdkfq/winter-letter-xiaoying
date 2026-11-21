// Downloads are independent of audio permission. Verified complete files and
// individual ranges survive retries and reloads; no music streams during a show.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class MusicLoader {
  constructor(config, notify) {
    this.config = config; this.notify = notify; this.parts = new Map(); this.pending = null;
    this.receivedBytes = 0; this.totalBytes = config.sources[0].bytes;
    this.errors = []; this.requests = 0; this.retries = 0; this.cachedParts = 0;
    this.source = null; this.sourceIndex = 0; this.state = 'idle';
  }
  progress(state = this.state) { this.state = state; this.notify?.(state); }
  record(error, details = {}) {
    this.errors.push({ message: error.message, at: new Date().toISOString(), ...details });
    if (this.errors.length > 24) this.errors.shift();
  }
  async verify(data, source) {
    if (data.byteLength !== source.bytes) throw new Error('Incomplete music file');
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
      if (hash !== source.sha256) throw new Error('Music integrity check failed');
    }
  }
  async load() {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => { this.pending = null; });
    return this.pending;
  }
  async run() {
    try { this.cache = await caches.open('winter-letter-music-v4'); } catch { this.cache = null; }
    // A previously selected compatible source remains first on subsequent retries.
    const order = this.config.sources.map((source, index) => ({ source, index }));
    if (this.sourceIndex) order.reverse();
    for (const { source, index } of order) {
      this.source = source; this.sourceIndex = index; this.totalBytes = source.bytes;
      this.receivedBytes = 0; this.progress('loading');
      try {
        const data = await this.download(source); this.progress('ready');
        return { data, source };
      } catch (error) { this.record(error, { phase: 'source', source: source.src }); }
    }
    this.progress(navigator.onLine ? 'error' : 'offline');
    throw new Error(navigator.onLine ? 'Music download interrupted; saved parts are kept' : 'Waiting for the network');
  }
  async readCache(key) {
    try { return await (await this.cache?.match(key))?.arrayBuffer(); } catch { return null; }
  }
  async saveCache(key, data, mime = 'application/octet-stream') {
    try { await this.cache?.put(key, new Response(data.slice(0), { headers: { 'Content-Type': mime } })); } catch {}
  }
  async download(source) {
    const url = new URL(source.src, location.href).href;
    const whole = await this.readCache(url);
    if (whole) {
      try { await this.verify(whole, source); this.receivedBytes = whole.byteLength; return whole; }
      catch (error) { this.record(error, { phase: 'cache' }); try { await this.cache.delete(url); } catch {} }
    }
    const size = this.config.blockSize, all = [], missing = [];
    for (let start = 0; start < source.bytes; start += size) {
      const end = Math.min(source.bytes - 1, start + size - 1);
      const key = url + `?part=${start}-${end}&sha=${source.sha256.slice(0, 12)}`;
      let data = this.parts.get(key) ?? await this.readCache(key);
      if (data?.byteLength !== end - start + 1) data = null;
      const part = { start, end, key, data }; all.push(part);
      if (data) { this.parts.set(key, data); this.receivedBytes += data.byteLength; ++this.cachedParts; }
      else missing.push(part);
    }
    this.progress('loading');
    let next = 0, complete = null, probeFailure = null;
    const remember = async (part, data) => {
      part.data = data; this.parts.set(part.key, data); await this.saveCache(part.key, data);
      this.receivedBytes += data.byteLength; this.progress('loading');
    };
    // Negotiate Range once: a server replying with a full 200 must not cause
    // several parallel copies of the same recording on a slow connection.
    if (missing.length) {
      const first = missing[next++];
      try {
        const response = await this.request(url, first.start, first.end, source);
        if (response.full) { complete = response.data; this.receivedBytes = source.bytes; this.progress(); }
        else await remember(first, response.data);
      } catch (error) { probeFailure = error; }
    }
    const worker = async () => {
      while (next < missing.length && !complete) {
        const part = missing[next++];
        const response = await this.request(url, part.start, part.end, source);
        if (response.full) { complete = response.data; this.receivedBytes = source.bytes; this.progress(); break; }
        await remember(part, response.data);
      }
    };
    const results = complete || probeFailure ? [] : await Promise.allSettled(Array.from({ length: this.config.parallel }, worker));
    const failure = probeFailure ? { reason: probeFailure } : results.find(result => result.status === 'rejected');
    let data = complete;
    if (!data && failure) {
      // A plain GET works on proxies that reject Range headers or inconsistent 206s.
      // Keep every good range even if this alternate request also fails.
      this.record(failure.reason, { phase: 'ranges' }); this.progress('retrying');
      data = (await this.request(url, null, null, source, 2)).data;
    }
    if (!data) {
      const joined = new Uint8Array(source.bytes);
      for (const part of all) { if (!part.data) throw new Error('Missing music range'); joined.set(new Uint8Array(part.data), part.start); }
      data = joined.buffer;
    }
    try { await this.verify(data, source); }
    catch (error) {
      // Corrupted caches must be discarded instead of trapping every later retry.
      for (const part of all) { this.parts.delete(part.key); try { await this.cache?.delete(part.key); } catch {} }
      throw error;
    }
    await this.saveCache(url, data, source.mime);
    this.receivedBytes = data.byteLength; this.progress('loading'); return data;
  }
  async request(url, start, end, source, attempts = this.config.retries) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) { ++this.retries; this.progress('retrying'); await wait(Math.min(2400, 350 * 2 ** attempt)); }
      const controller = new AbortController(); let idleTimer;
      const arm = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort('No music data received'), this.config.downloadTimeoutMs); };
      const totalTimer = setTimeout(() => controller.abort('Music request took too long'), this.config.totalTimeoutMs);
      try {
        arm(); ++this.requests;
        const response = await fetch(url, { headers: start === null ? {} : { Range: `bytes=${start}-${end}` }, cache: 'default', signal: controller.signal });
        if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
        const full = response.status === 200;
        const wanted = full ? source.bytes : end - start + 1;
        if (!full && (response.status !== 206 || response.headers.get('Content-Range') !== `bytes ${start}-${end}/${source.bytes}`)) throw new Error('Unexpected music range response');
        let data;
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []; let length = 0;
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            chunks.push(value); length += value.length; arm();
            if (length > wanted) { await reader.cancel(); throw new Error('Music response is larger than expected'); }
          }
          const merged = new Uint8Array(length); let offset = 0;
          for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
          data = merged.buffer;
        } else data = await response.arrayBuffer();
        if (data.byteLength !== wanted) throw new Error('Music response ended early');
        return { data, full };
      } catch (error) { lastError = error instanceof Error ? error : new Error(String(error)); this.record(lastError, { start, end, attempt: attempt + 1, online: navigator.onLine }); }
      finally { clearTimeout(idleTimer); clearTimeout(totalTimer); }
    }
    throw lastError;
  }
  snapshot() { return { state: this.state, receivedBytes: this.receivedBytes, totalBytes: this.totalBytes,
    requests: this.requests, retries: this.retries, cachedParts: this.cachedParts, source: this.source?.src,
    errors: this.errors.slice() }; }
}
