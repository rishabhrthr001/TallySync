// Global polyfills for PDF parsing support in Node environment
// @ts-ignore
if (typeof globalThis.DOMMatrix === 'undefined') { (globalThis as any).DOMMatrix = class {}; }
// @ts-ignore
if (typeof globalThis.ImageData === 'undefined') { (globalThis as any).ImageData = class {}; }
// @ts-ignore
if (typeof globalThis.Path2D === 'undefined') { (globalThis as any).Path2D = class {}; }

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';
import authRoutes from './routes/authRoutes.js';
import entryRoutes from './routes/entryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import recognitionRoutes from './routes/recognitionRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cors({
    origin: [
      'https://photobill-frontend-1020363630918.us-central1.run.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ],
    credentials: true
  }));
  app.use(cookieParser());

  // Global UTF-8 charset and cache-disabling headers for all responses
  app.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // Seed Admin User
  const seedAdmin = async () => {
    try {
      let admin = await User.findOne({ email: 'pankaj@photoBill.com' });
      const hashedPassword = await bcrypt.hash('pankaj@9999', 10);
      
      if (!admin) {
        admin = new User({
          name: 'Pankaj Admin',
          email: 'pankaj@photoBill.com',
          password: hashedPassword,
          role: 'admin',
          companyName: 'PhotoBill Main'
        });
        await admin.save();
        console.log('Admin user seeded: pankaj@photoBill.com / pankaj@9999');
      } else {
        // Force update password to requested one
        admin.password = hashedPassword;
        admin.role = 'admin';
        await admin.save();
        console.log('Admin user password updated to: pankaj@9999');
      }
    } catch (error) {
      console.error('Error seeding admin:', error);
    }
  };
  seedAdmin();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/product-recognition', recognitionRoutes);
  app.use('/api', adminRoutes);

  // Vite/Static Setup
  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: path.join(__dirname, '../../frontend')
      });
      app.use(vite.middlewares);
      console.log('Vite middleware integrated');
    } catch (e) {
      console.warn('Vite middleware failed to load, backend running standalone for API:', e);
    }
  } else {
    const distPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
