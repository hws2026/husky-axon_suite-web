import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { StateStore } from './state-store.mjs';

// Explicitly loopback-only: full sample snapshots have NO production permissions.
if (!process.argv.includes('--demo')) {
  console.error('This is a local sample-data sync service. Start with --demo. Do not use live evidence.');
  process.exit(1);
}
const port = Number(process.env.HUSKY_SYNC_PORT || 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port.');
const store = new StateStore();
const assets = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'],
  ['/app.js', 'app.js'], ['/policy.js', 'policy.js'], ['/media-contract.js', 'media-contract.js'],
  ['/sync-client.js', 'sync-client.js'], ['/equipment.js', 'equipment.js'], ['/watermark.js', 'watermark.js']
]);
const contentTypes = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' };
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  // Host and Origin checks stop other websites from writing to the local demo.
  if (!allowedHosts.includes(req.headers.host)) return json(res, 403, { error: 'Loopback only.' });
  if (req.headers.origin && !allowedHosts.some(host => req.headers.origin === `http://${host}`))
    return json(res, 403, { error: 'Origin not allowed.' });
  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${port}`); } catch { return json(res, 400, { error: 'Invalid URL.' }); }
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, store.snapshot());
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1000\n\n');
      const send = snapshot => {
        if (!res.write(`id: ${snapshot.revision}\ndata: ${JSON.stringify(snapshot)}\n\n`)) res.destroy();
      };
      send(store.snapshot());
      const unsubscribe = store.subscribe(send);
      const heartbeat = setInterval(() => { if (!res.write(': heartbeat\n\n')) res.destroy(); }, 10000);
      res.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
      return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/state') {
      let size = 0, chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 140000) return json(res, 413, { error: 'Request too large.' });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
      const result = store.commit(body.baseRevision, body.state, body.clientId);
      return json(res, result.ok ? 200 : result.status, result);
    }
    if (req.method === 'GET' && assets.has(url.pathname)) {
      const asset = assets.get(url.pathname);
      const file = fileURLToPath(new URL(`../${asset}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': contentTypes[asset.split('.').pop()], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(await readFile(file));
      return;
    }
    json(res, 404, { error: 'Not found.' });
  } catch { if (!res.headersSent) json(res, 500, { error: 'Sync request failed.' }); else res.destroy(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Sample-data dashboard sync: http://127.0.0.1:${port}`));
