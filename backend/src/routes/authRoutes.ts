import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-tally-key-123';

router.post('/signup', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password, role, gstin, phone, address, companyName } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'client';
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: userRole,
      companyName: companyName || '',
      gstin: gstin || '',
      phone: phone || '',
      address: address || '',
      createdAt: new Date().toISOString()
    });
    await newUser.save();
    res.status(201).json({ id: newUser._id, name, email, role: userRole, companyName: newUser.companyName });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      name: user.name,
      companyName: user.companyName 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ 
    token, 
    user: { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      name: user.name,
      companyName: user.companyName 
    } 
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticateToken, (req: any, res) => {
  res.json(req.user);
});

export default router;
