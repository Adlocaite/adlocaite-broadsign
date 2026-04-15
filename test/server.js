#!/usr/bin/env node

/**
 * Simple HTTP server for testing the Broadsign package
 * Can be used for both manual testing and CI/CD
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '127.0.0.1';

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Serve from project root
  const projectRoot = path.join(__dirname, '..');

  // Handle URLs
  let requestPath = req.url.split('?')[0]; // Remove query params
  if (requestPath === '/') requestPath = '/test/index.html';
  else if (requestPath.endsWith('/')) requestPath += 'index.html';

  // ── /package-sim ──────────────────────────────────────────────
  // Serves package/index.html with BroadSignObject injected BEFORE
  // any scripts run. This simulates the real Broadsign Control Player
  // where BroadSignObject properties are available during PREBUFFER.
  if (requestPath === '/package-sim') {
    servePackageSim(req, res, projectRoot);
    return;
  }

  let filePath = path.join(projectRoot, requestPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(projectRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // If directory, try index.html
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        serveFile(filePath, res);
      });
      return;
    }

    if (!stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {

  // Get MIME type
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
}

/**
 * Serve package/index.html with BroadSignObject injected before scripts.
 *
 * Simulates the real Broadsign Control Player environment:
 * - BroadSignObject is a global with all properties as STRINGS
 * - Available during PREBUFFER state (before BroadSignPlay)
 * - URL also contains com.broadsign.suite.bsp.* params (like real source URL)
 *
 * Query params → BroadSignObject properties (all strings):
 *   frame_id, display_unit_id, player_id, ad_copy_id, campaign_id,
 *   display_unit_address, display_unit_lat_long, display_unit_location_code,
 *   display_unit_resolution, frame_resolution, expected_slot_duration_ms,
 *   dwell_time_duration_ms, impressions_per_hour, expected_impressions
 */
function servePackageSim(req, res, projectRoot) {
  const fullUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const params = fullUrl.searchParams;

  // Read the real package HTML
  const packagePath = path.join(projectRoot, 'package', 'index.html');
  let html;
  try {
    html = fs.readFileSync(packagePath, 'utf8');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Failed to read package/index.html: ' + err.message);
    return;
  }

  // Build BroadSignObject from query params (all values are strings, like real Broadsign)
  const bsObject = {
    frame_id:                    params.get('frame_id') || '',
    display_unit_id:             params.get('display_unit_id') || '',
    player_id:                   params.get('player_id') || '',
    ad_copy_id:                  params.get('ad_copy_id') || '',
    campaign_id:                 params.get('campaign_id') || '',
    display_unit_address:        params.get('display_unit_address') || '',
    display_unit_lat_long:       params.get('display_unit_lat_long') || '',
    display_unit_location_code:  params.get('display_unit_location_code') || '',
    display_unit_resolution:     params.get('display_unit_resolution') || '1920x1080',
    frame_resolution:            params.get('frame_resolution') || '1920x1080',
    expected_slot_duration_ms:   params.get('expected_slot_duration_ms') || '10000',
    dwell_time_duration_ms:      params.get('dwell_time_duration_ms') || '60000',
    impressions_per_hour:        params.get('impressions_per_hour') || '0.000000',
    expected_impressions:        params.get('expected_impressions') || '0.000000',
  };

  // Injection: base href so relative script paths resolve to /package/,
  // plus BroadSignObject as a global BEFORE any package scripts run.
  const injection = `
  <base href="/package/">
  <script>
    // ── BroadSignObject (simulated by test server) ──────────────
    // In the real Broadsign Control Player, this global is available
    // during PREBUFFER state, before BroadSignPlay() fires.
    window.BroadSignObject = ${JSON.stringify(bsObject)};
    window.BroadSignObject.requestFocus = function() {
      console.log('[BroadSignObject] requestFocus() called');
    };
    window.__BROADSIGN_SIM_INJECTED_AT = performance.now();
  </script>`;

  // Inject right after <head> so it runs before config.js and all other scripts
  const modifiedHtml = html.replace(/<head>/i, '<head>' + injection);

  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(modifiedHtml);
}

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Broadsign Test Server Running`);
  console.log(`   URL: http://${HOST}:${PORT}`);
  console.log(`   Test Interface: http://${HOST}:${PORT}/test/`);
  console.log(`   Package: http://${HOST}:${PORT}/package/`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
