// ============================================================
// Server Entry — Kadi Teri v3
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { registerHandlers } from './socket';
import { cleanupStaleRooms } from './rooms/room';

const PORT = process.env.PORT ?? 3001;

/**
 * In production the built client is served from this same process, so the
 * game lives on one origin and the socket needs no cross-origin setup.
 * In development Vite serves the client and proxies the socket here.
 */
const CLIENT_DIR = process.env.CLIENT_DIR
  ? path.resolve(process.env.CLIENT_DIR)
  : path.resolve(__dirname, '../../client/dist');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '3.0.0', servingClient: fs.existsSync(CLIENT_DIR) });
});

if (fs.existsSync(CLIENT_DIR)) {
  // Hashed assets can be cached hard. The shell and the service worker
  // must not be, or people get stuck on an old build.
  app.use(express.static(CLIENT_DIR, {
    setHeaders(res, filePath) {
      const name = path.basename(filePath);
      if (name === 'index.html' || name === 'sw.js' || name === 'registerSW.js') {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // Deep links such as /join/A7KD92 are client routes, so hand back the shell.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path === '/health') return next();
    res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  });

  console.log(`Serving the client from ${CLIENT_DIR}`);
} else {
  console.log('No client build found. Run the Vite dev server for the UI.');
}

const http = createServer(app);
const io = new Server(http, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

registerHandlers(io);
setInterval(cleanupStaleRooms, 30 * 60 * 1000);

http.listen(PORT, () => {
  console.log(`\nKadi Teri v3 server listening on port ${PORT}\n`);
});
