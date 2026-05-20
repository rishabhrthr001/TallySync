import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  const users = await User.find({}, { password: 0 });
  res.json(users);
});

router.post('/admin/clients', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, email, password, gstin, phone, address, companyName } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password || 'client123', 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'client',
      companyName,
      gstin,
      phone,
      address,
      createdAt: new Date().toISOString()
    });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/admin/clients/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, gstin, phone, address, companyName, password } = req.body;
  try {
    const updateData: any = { name, email, gstin, phone, address, companyName };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/admin/clients/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
