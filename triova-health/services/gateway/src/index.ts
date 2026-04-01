import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../../shared/utils/logger';
import { apiRateLimiter } from '../../shared/middleware/rate-limit.middleware';

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(apiRateLimiter);

const server = http.createServer(app);

// Socket.io for Realtime updates (queue status, alerts, chat)
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, credentials: true }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (User: ${socket.data.user.userId})`);
  
  // Join user-specific room
  socket.join(`user_${socket.data.user.userId}`);
  
  if (socket.data.user.role === 'doctor' && socket.data.user.doctorId) {
    socket.join(`doctor_${socket.data.user.doctorId}`);
  }
  
  if (socket.data.user.role === 'patient' && socket.data.user.patientId) {
    socket.join(`patient_${socket.data.user.patientId}`);
  }

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Proxy generator
const proxyOptions = (target: string) => ({
  target,
  changeOrigin: true,
  pathRewrite: { '^/api/[^/]+': '/api' }, // e.g., /api/auth -> /api
  onProxyReq: (proxyReq: any, req: any) => {
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    // Fix body parsing for proxy
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err: any, req: any, res: any) => {
    logger.error('Proxy Error', err);
    res.status(502).json({ success: false, error: 'Service unavailable' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

// Auth Service (Doesn't rewrite path exactly since auth routes are nested under /api/auth in the service too)
app.use('/api/auth', express.json(), createProxyMiddleware({ 
  target: `http://localhost:${process.env.AUTH_PORT || 3001}`, 
  changeOrigin: true 
}));

// Other Services
app.use('/api/appointments', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.APPOINTMENT_PORT || 3002}`, changeOrigin: true }));
app.use('/api/triage', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.TRIAGE_PORT || 3003}`, changeOrigin: true }));
app.use('/api/medical-records', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.RECORDS_PORT || 3004}`, changeOrigin: true }));
app.use('/api/notifications', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.NOTIFICATION_PORT || 3005}`, changeOrigin: true }));
app.use('/api/analytics', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.ANALYTICS_PORT || 3006}`, changeOrigin: true }));
app.use('/api/wearables', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.ANALYTICS_PORT || 3006}`, changeOrigin: true }));
app.use('/api/patients', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.PATIENT_PORT || 3008}`, changeOrigin: true }));
app.use('/api/doctors', express.json(), createProxyMiddleware({ target: `http://localhost:${process.env.DOCTOR_PORT || 3009}`, changeOrigin: true }));

server.listen(PORT, () => {
  logger.info(`TRIOVA API Gateway running on port ${PORT}`);
});

export const getIO = () => io;
