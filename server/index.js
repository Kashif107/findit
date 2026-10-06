import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import { loadModels, modelsReady } from './services/embeddings.js';
import { initNotify } from './services/notify.js';
import { startCron } from './services/cron.js';
import { userFromToken } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());

async function main() {
  if (!process.env.JWT_SECRET_KEY) throw new Error('JWT_SECRET_KEY is not set');
  await connectDB();

  // Models load once, here, before the server starts listening
  if (process.env.SKIP_MODELS === 'true') {
    console.warn('[embeddings] SKIP_MODELS=true: matching is disabled');
  } else {
    await loadModels();
  }

  const app = express();
  app.set('trust proxy', 1); // correct client IPs behind Render/Railway proxies
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)) }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));

  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      modelsLoaded: modelsReady(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    })
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: origins } });
  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      if (!user || user.isBanned) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
  initNotify(io);

  startCron();
  server.listen(PORT, () => console.log(`[server] http://localhost:${PORT}  (client: ${origins.join(', ')})`));
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
