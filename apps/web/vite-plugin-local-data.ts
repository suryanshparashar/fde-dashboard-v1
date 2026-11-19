/**
 * Dev-server plugin that stores snapshot CSVs in <root>/local-data.
 *
 * It stands in for the future backend and exposes the same endpoints:
 *   GET  /api/snapshots          → JSON list of snapshots, newest first
 *   GET  /api/snapshots/latest   → CSV text of the newest snapshot (204 if none)
 *   GET  /api/snapshots/:name    → CSV text of one snapshot
 *   POST /api/snapshots          → { name, content } writes a new snapshot (never overwrites)
 *   GET  /api/mappings           → JSON of the uploader's remembered value choices (204 if none)
 *   PUT  /api/mappings           → replaces local-data/mappings.json
 *
 * File names: {latest sheet date ddmmyy}-{upload date ddmmyy}-{upload time hhmmss}.csv
 */
import type { Plugin, Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const NAME_RE = /^(\d{6})-(\d{6})-(\d{6})\.csv$/;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export interface SnapshotInfo {
  name: string;
  dataUpTo: string; // ddmmyy
  uploadedOn: string; // ddmmyy
  uploadedAt: string; // hhmmss
  sizeBytes: number;
}

/** Sort key from the upload-date and upload-time parts: yymmddhhmmss. */
function uploadSortKey(name: string): string {
  const m = NAME_RE.exec(name);
  if (!m) return '';
  const d = m[2];
  return d.slice(4, 6) + d.slice(2, 4) + d.slice(0, 2) + m[3];
}

function send(res: ServerResponse, status: number, body: string, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', `${type}; charset=utf-8`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
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

export function localData(options: { dir?: string } = {}): Plugin {
  let dataDir = '';

  async function listSnapshots(): Promise<SnapshotInfo[]> {
    await fs.mkdir(dataDir, { recursive: true });
    const entries = await fs.readdir(dataDir);
    const out: SnapshotInfo[] = [];
    for (const name of entries) {
      const m = NAME_RE.exec(name);
      if (!m) continue;
      const stat = await fs.stat(path.join(dataDir, name));
      out.push({ name, dataUpTo: m[1], uploadedOn: m[2], uploadedAt: m[3], sizeBytes: stat.size });
    }
    return out.sort((a, b) => uploadSortKey(b.name).localeCompare(uploadSortKey(a.name)));
  }

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = (req.url ?? '/').split('?')[0];
    try {
      if (req.method === 'GET' && (url === '/' || url === '')) {
        return send(res, 200, JSON.stringify(await listSnapshots()));
      }
      if (req.method === 'GET') {
        let name = decodeURIComponent(url.replace(/^\//, ''));
        if (name === 'latest') {
          const list = await listSnapshots();
          if (!list.length) return send(res, 204, '', 'text/csv');
          name = list[0].name;
          res.setHeader('X-Snapshot-Name', name);
        }
        if (!NAME_RE.test(name)) return send(res, 400, JSON.stringify({ error: 'Invalid snapshot name' }));
        try {
          const csv = await fs.readFile(path.join(dataDir, name), 'utf8');
          res.setHeader('X-Snapshot-Name', name);
          return send(res, 200, csv, 'text/csv');
        } catch {
          return send(res, 404, JSON.stringify({ error: 'Snapshot not found' }));
        }
      }
      if (req.method === 'POST' && (url === '/' || url === '')) {
        const body = JSON.parse(await readBody(req)) as { name?: unknown; content?: unknown };
        if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) {
          return send(res, 400, JSON.stringify({ error: 'Invalid snapshot name' }));
        }
        if (typeof body.content !== 'string') {
          return send(res, 400, JSON.stringify({ error: 'Missing content' }));
        }
        await fs.mkdir(dataDir, { recursive: true });
        const target = path.join(dataDir, body.name);
        // Never overwrite: history must stay immutable.
        try {
          await fs.access(target);
          return send(res, 409, JSON.stringify({ error: 'Snapshot already exists' }));
        } catch {
          /* does not exist: good */
        }
        const tmp = `${target}.${process.pid}.tmp`;
        await fs.writeFile(tmp, body.content, 'utf8');
        await fs.rename(tmp, target);
        return send(res, 201, JSON.stringify({ name: body.name }));
      }
      next();
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }));
    }
  };

  const mappingsHandler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url !== '/' && url !== '') return next();
    const file = path.join(dataDir, 'mappings.json');
    try {
      if (req.method === 'GET') {
        try {
          return send(res, 200, await fs.readFile(file, 'utf8'));
        } catch {
          return send(res, 204, '');
        }
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        const parsed = JSON.parse(body) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return send(res, 400, JSON.stringify({ error: 'Expected a JSON object' }));
        await fs.mkdir(dataDir, { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(parsed, null, 2), 'utf8');
        await fs.rename(tmp, file);
        return send(res, 200, JSON.stringify({ ok: true }));
      }
      next();
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }));
    }
  };

  return {
    name: 'local-data',
    configResolved(config) {
      dataDir = path.resolve(config.root, options.dir ?? 'local-data');
    },
    configureServer(server) {
      server.middlewares.use('/api/snapshots', handler);
      server.middlewares.use('/api/mappings', mappingsHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/snapshots', handler);
      server.middlewares.use('/api/mappings', mappingsHandler);
    },
  };
}
