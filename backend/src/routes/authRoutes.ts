import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { getUserSubscriptionInfo, getTodayBillCount, isPankajSuperAdmin } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-tally-key-123';

// Nodemailer transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'https://photobill-frontend-1020363630918.us-central1.run.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
      from: `"PhotoBill" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 PhotoBill – Reset Your Password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 24px;text-align:center">
            <h1 style="color:white;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.5px">PhotoBill</h1>
            <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:4px 0 0;font-weight:600;text-transform:uppercase;letter-spacing:2px">Password Reset</p>
          </div>
          <div style="padding:32px 24px">
            <p style="color:#1e293b;font-size:15px;font-weight:700;margin:0 0 8px">Hi ${user.name || 'there'},</p>
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 24px">We received a request to reset your PhotoBill password. Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-align:center;padding:14px 24px;border-radius:12px;font-weight:900;font-size:13px;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase">Reset My Password</a>
            <p style="color:#94a3b8;font-size:11px;margin:20px 0 0;line-height:1.6">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
            <p style="color:#cbd5e1;font-size:10px;text-align:center;margin:0">© PhotoBill Secure Accounting Gateway</p>
          </div>
        </div>
      `
    });

    res.json({ message: 'If this email is registered, a reset link has been sent.' });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const user = await User.findOne({
      email,
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.plainPassword = newPassword;
    user.resetToken = null as any;
    user.resetTokenExpiry = null as any;
    await user.save();

    res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});



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
  const cleanEmail = (email || '').trim();
  const user = await User.findOne({ email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
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
