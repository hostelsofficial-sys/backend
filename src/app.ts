// app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import verificationRoutes from './modules/verification/verification.routes';
import hostelsRoutes from './modules/hostels/hostels.routes';
import reservationsRoutes from './modules/reservations/reservations.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import feesRoutes from './modules/fees/fees.routes';
import reportsRoutes from './modules/reports/reports.routes';
import chatRoutes from './modules/chat/chat.routes';

// ✅ NEW: import auth middleware and UsersService
import { authenticate, notTerminated } from './middleware/auth.middleware';
import { UsersService } from './modules/users/users.service';

const app = express();
const usersService = new UsersService();

// --- START: Recommended Configuration Changes ---

// 1. Explicit CORS Configuration
const corsOptions = {
  // CRUCIAL: Must match your frontend's running URL/port
  origin: ['http://localhost:5173', 'https://hostelshub-ebon.vercel.app', '*'],
  // Allows sending of cookies/auth headers
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type, Authorization',
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions)); // Apply the explicit CORS options
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Added this for robustness

// 2. Request Logging Middleware (Debugging)
// This will log every incoming request to the server terminal
app.use((req, res, next) => {
  console.log(
    `[INCOMING] ${req.method} ${req.originalUrl} | Body size: ${
      req.body ? Object.keys(req.body).length : 0
    }`
  );
  next();
});

// --- END: Recommended Configuration Changes ---

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ NEW: Hard delete own account (student or manager)
app.delete(
  '/api/users/delete',
  authenticate,
  notTerminated,
  async (req: any, res) => {
    try {
      // req.user is set by authenticate middleware
      const userId = req.user.userId;
      const result = await usersService.deleteMyAccount(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Delete account error:', error);
      res
        .status(400)
        .json({ success: false, message: error.message || 'Delete failed' });
    }
  }
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/hostels', hostelsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // It's good practice to ensure the error is always logged server-side
    console.error('--- UNHANDLED ERROR START ---');
    console.error(err.stack);
    console.error('--- UNHANDLED ERROR END ---');

    // You can refine this to send a more generic message for production
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
);

export default app;
