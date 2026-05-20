import express from 'express';
import Ledger from '../models/Ledger.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const ledgers = await Ledger.find({ companyName: req.user.companyName });
    res.json(ledgers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const newLedger = new Ledger({
      ...req.body,
      userId: req.user.id,
      companyName: req.user.companyName
    });
    await newLedger.save();
    res.status(201).json(newLedger);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
