import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { getUserSubscriptionInfo, getTodayBillCount, isPankajSuperAdmin } from '../middleware/subscriptionMiddleware.js';

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

  const isSuper = isPankajSuperAdmin(user);
  if (isSuper && !user.isSuperAdmin) {
    user.isSuperAdmin = true;
    await user.save();
  }

  const todayCount = await getTodayBillCount(user._id.toString(), user.companyName);
  const subInfo = getUserSubscriptionInfo(user, todayCount);

  const token = jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      name: user.name,
      companyName: user.companyName,
      isSuperAdmin: isSuper
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
      companyName: user.companyName,
      isSuperAdmin: isSuper,
      subscription: subInfo
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

router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) {
      return res.json(req.user);
    }

    const isSuper = isPankajSuperAdmin(userDoc);
    const todayCount = await getTodayBillCount(userDoc._id.toString(), userDoc.companyName);
    const subInfo = getUserSubscriptionInfo(userDoc, todayCount);

    res.json({
      id: userDoc._id,
      email: userDoc.email,
      role: userDoc.role,
      name: userDoc.name,
      companyName: userDoc.companyName,
      isSuperAdmin: isSuper,
      subscription: subInfo
    });
  } catch (err) {
    res.json(req.user);
  }
});

export default router;
