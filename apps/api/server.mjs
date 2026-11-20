/**
 * Local API for the AI Academy FDE Dashboard (Angular app in ../web-ng).
 * Stores each monthly upload as a CSV snapshot in ./local-data (or $LOCAL_DATA_DIR). No dependencies.
 *
 *   GET  /api/snapshots          → JSON list of snapshots, newest first
 *   GET  /api/snapshots/latest   → CSV text of the newest snapshot (204 if none; X-Snapshot-Name header)
 *   GET  /api/snapshots/:name    → CSV text of one snapshot
 *   POST /api/snapshots          → { name, content } writes a new snapshot (never overwrites)
 *   GET  /api/mappings           → JSON of the uploader's remembered value choices (204 if none)
 *   PUT  /api/mappings           → replaces local-data/mappings.json
 *
 * File names: {latest sheet date ddmmyy}-{upload date ddmmyy}-{upload time hhmmss}.csv
 * Usage: node server.mjs   (PORT, default 9010; LOCAL_DATA_DIR, default ./local-data)
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 9010);
const DATA_DIR = path.resolve(process.env.LOCAL_DATA_DIR ?? path.join(HERE, 'local-data'));
const NAME_RE = /^(\d{6})-(\d{6})-(\d{6})\.csv$/;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

/** Sort key from the upload-date and upload-time parts: yymmddhhmmss. */
function uploadSortKey(name) {
  const m = NAME_RE.exec(name);
  if (!m) return '';
  const d = m[2];
  return d.slice(4, 6) + d.slice(2, 4) + d.slice(0, 2) + m[3];
}

function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function listSnapshots() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const out = [];
  for (const name of await fs.readdir(DATA_DIR)) {
    const m = NAME_RE.exec(name);
    if (!m) continue;
    const stat = await fs.stat(path.join(DATA_DIR, name));
    out.push({ name, dataUpTo: m[1], uploadedOn: m[2], uploadedAt: m[3], sizeBytes: stat.size });
  }
  return out.sort((a, b) => uploadSortKey(b.name).localeCompare(uploadSortKey(a.name)));
}

/** Write via a temp file + rename so a crash never leaves a half-written file. */
async function atomicWrite(file, text) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

async function snapshots(req, res, rest) {
  if (req.method === 'GET' && rest === '') return json(res, 200, await listSnapshots());
  if (req.method === 'GET') {
    let name = decodeURIComponent(rest);
    if (name === 'latest') {
      const list = await listSnapshots();
      if (!list.length) return send(res, 204, '', 'text/csv');
      name = list[0].name;
    }
    if (!NAME_RE.test(name)) return json(res, 400, { error: 'Invalid snapshot name' });
    try {
      const csv = await fs.readFile(path.join(DATA_DIR, name), 'utf8');
      res.setHeader('X-Snapshot-Name', name);
      return send(res, 200, csv, 'text/csv');
    } catch {
      return json(res, 404, { error: 'Snapshot not found' });
    }
  }
  if (req.method === 'POST' && rest === '') {
    const body = JSON.parse(await readBody(req));
    if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) return json(res, 400, { error: 'Invalid snapshot name' });
    if (typeof body.content !== 'string') return json(res, 400, { error: 'Missing content' });
    const target = path.join(DATA_DIR, body.name);
    try {
      await fs.access(target);
      return json(res, 409, { error: 'Snapshot already exists' }); // history is never overwritten
    } catch {
      /* does not exist yet: good */
    }
    await atomicWrite(target, body.content);
    return json(res, 201, { name: body.name });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

async function mappings(req, res) {
  const file = path.join(DATA_DIR, 'mappings.json');
  if (req.method === 'GET') {
    try {
      return send(res, 200, await fs.readFile(file, 'utf8'));
    } catch {
      return send(res, 204, '');
    }
  }
  if (req.method === 'PUT') {
    const parsed = JSON.parse(await readBody(req));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(res, 400, { error: 'Expected a JSON object' });
    await atomicWrite(file, JSON.stringify(parsed, null, 2));
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0].replace(/\/+$/, '');
  try {
    if (url === '/api/snapshots' || url.startsWith('/api/snapshots/')) return await snapshots(req, res, url.slice('/api/snapshots'.length).replace(/^\//, ''));
    if (url === '/api/mappings') return await mappings(req, res);
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    return json(res, err instanceof SyntaxError ? 400 : 500, { error: err instanceof Error ? err.message : 'Server error' });
  }
});

server.listen(PORT, () => console.log(`FDE API on http://localhost:${PORT} · data in ${DATA_DIR}`));
