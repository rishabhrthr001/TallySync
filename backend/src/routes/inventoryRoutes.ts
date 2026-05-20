import express from 'express';
import Item from '../models/Item.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const items = await Item.find({ companyName: req.user.companyName });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const newItem = new Item({
      ...req.body,
      userId: req.user.id,
      companyName: req.user.companyName
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, companyName: req.user.companyName },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, companyName: req.user.companyName });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
