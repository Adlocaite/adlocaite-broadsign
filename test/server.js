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
