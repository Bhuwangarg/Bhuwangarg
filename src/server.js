// Zero-dependency HTTP server: a tiny router on top of node:http, an API-key
// guard for /api/*, JSON helpers, and static serving for the dashboard.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import * as store from './store.js';
import * as challanService from './services/challanService.js';
import * as reports from './services/reportService.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function authorized(req, url) {
  if (!config.apiKey) return true; // auth disabled
  const headerKey = req.headers['x-api-key'];
  const queryKey = url.searchParams.get('apiKey');
  return headerKey === config.apiKey || queryKey === config.apiKey;
}

function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(publicDir, rel));
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  const method = req.method;

  // ---- Buses ----
  if (pathname === '/api/buses' && method === 'GET') {
    return sendJson(res, 200, { buses: store.listBuses() });
  }
  if (pathname === '/api/buses' && method === 'POST') {
    const body = await readBody(req);
    try {
      const bus = store.addBus({ number: body.number, name: body.name });
      // Pull this bus's challans right away so the dashboard isn't empty.
      challanService.refreshBus(bus.number).catch(() => {});
      return sendJson(res, 201, { bus });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }
  const busMatch = pathname.match(/^\/api\/buses\/([^/]+)$/);
  if (busMatch && method === 'DELETE') {
    const ok = store.removeBus(decodeURIComponent(busMatch[1]));
    return sendJson(res, ok ? 200 : 404, { removed: ok });
  }

  // ---- Refresh (automation trigger) ----
  if (pathname === '/api/refresh' && method === 'POST') {
    const result = await challanService.refreshAll();
    return sendJson(res, 200, result);
  }
  const refreshOne = pathname.match(/^\/api\/refresh\/([^/]+)$/);
  if (refreshOne && method === 'POST') {
    const result = await challanService.refreshBus(decodeURIComponent(refreshOne[1]));
    return sendJson(res, result.ok ? 200 : 502, result);
  }

  // ---- Challans (raw list with filters) ----
  if (pathname === '/api/challans' && method === 'GET') {
    const filter = {
      bus: searchParams.get('bus') || undefined,
      month: searchParams.get('month') || undefined,
      status: searchParams.get('status') || undefined,
    };
    return sendJson(res, 200, { challans: store.listChallans(filter) });
  }

  // ---- Reports ----
  if (pathname === '/api/reports/summary' && method === 'GET') {
    return sendJson(res, 200, reports.summary());
  }
  if (pathname === '/api/reports/fleet' && method === 'GET') {
    return sendJson(res, 200, { buses: reports.fleetByBus() });
  }
  if (pathname === '/api/reports/monthly' && method === 'GET') {
    const months = Number(searchParams.get('months')) || 6;
    const bus = searchParams.get('bus') || undefined;
    return sendJson(res, 200, { months: reports.monthlyReport({ bus, months }) });
  }
  const busReport = pathname.match(/^\/api\/reports\/bus\/([^/]+)$/);
  if (busReport && method === 'GET') {
    const report = reports.busReport(decodeURIComponent(busReport[1]));
    return sendJson(res, report ? 200 : 404, report || { error: 'Bus not found' });
  }

  return sendJson(res, 404, { error: 'Unknown endpoint' });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      });
      return res.end();
    }

    if (url.pathname === '/health') {
      return sendJson(res, 200, { status: 'ok', time: new Date().toISOString() });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!authorized(req, url)) {
        return sendJson(res, 401, { error: 'Unauthorized: missing or invalid x-api-key' });
      }
      try {
        return await handleApi(req, res, url);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    return serveStatic(res, url.pathname);
  });
}
