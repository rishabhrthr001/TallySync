import express from 'express';
import Ledger from '../models/Ledger.js';
import User from '../models/User.js';
import Voucher from '../models/Voucher.js';
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

// Sync Request: Enqueue a ledger sync request for the company
router.post('/sync-request', authenticateToken, async (req: any, res) => {
  try {
    const companyName = req.user.role === 'admin' && req.body.companyName ? req.body.companyName : req.user.companyName;
    const updatedUser = await User.findOneAndUpdate(
      { companyName },
      { ledgerSyncStatus: 'pending', ledgerSyncError: '' },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ error: 'Company not found' });
    res.json({ message: 'Ledger sync request queued successfully', status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Status: Get the current sync status for the company
router.get('/sync-status', authenticateToken, async (req: any, res) => {
  try {
    const companyName = req.user.role === 'admin' && req.query.companyName ? req.query.companyName : req.user.companyName;
    const user = await User.findOne({ companyName });
    if (!user) return res.status(404).json({ error: 'Company not found' });
    res.json({
      status: user.ledgerSyncStatus || 'idle',
      error: user.ledgerSyncError || '',
      lastSync: user.lastLedgerSync || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Requests: Agent endpoint to get all pending sync requests (Admin/Agent only)
router.get('/sync-requests', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const pendingUsers = await User.find({ ledgerSyncStatus: 'pending' }, { companyName: 1, email: 1, _id: 1 });
    res.json(pendingUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Complete: Agent uploads ledgers/parties and marks sync as successful (Admin/Agent only)
router.post('/sync-complete', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { companyName, ledgers } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    if (!Array.isArray(ledgers)) {
      return res.status(400).json({ error: 'ledgers array is required' });
    }

    // Find the company's client user to associate ledgers with
    const clientUser = await User.findOne({ companyName, role: 'client' });
    const targetUserId = clientUser ? clientUser._id : req.user.id;

    // Upsert ledgers in the database
    for (const ledgerData of ledgers) {
      const { partyName, gstin, balance } = ledgerData;
      if (!partyName) continue;

      await Ledger.findOneAndUpdate(
        { companyName, partyName: partyName.trim() },
        {
          $set: {
            userId: targetUserId,
            companyName,
            partyName: partyName.trim(),
            gstin: gstin ? gstin.trim().toUpperCase() : '',
            balance: Number(balance) || 0,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    // Mark sync status as success
    await User.findOneAndUpdate(
      { companyName },
      {
        ledgerSyncStatus: 'success',
        ledgerSyncError: '',
        lastLedgerSync: new Date()
      }
    );

    res.json({ success: true, message: `Successfully synchronized ${ledgers.length} ledgers.` });
  } catch (error: any) {
    console.error('Ledger sync-complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Fail: Agent reports sync failure (Admin/Agent only)
router.post('/sync-fail', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { companyName, error } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    await User.findOneAndUpdate(
      { companyName },
      {
        ledgerSyncStatus: 'failed',
        ledgerSyncError: error || 'Unknown error during sync'
      }
    );

    res.json({ success: true, message: 'Sync failure recorded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Complete: Agent uploads ledgers/parties and marks sync as successful (Admin/Agent only)
// Clear all ledgers for the authenticated user's company and reset sync status
router.delete('/clear', authenticateToken, async (req: any, res) => {
  try {
    const result = await Ledger.deleteMany({ companyName: req.user.companyName });
    await Voucher.deleteMany({ companyName: req.user.companyName });
    await User.findOneAndUpdate(
      { companyName: req.user.companyName },
      { ledgerSyncStatus: 'idle', ledgerSyncError: '', lastLedgerSync: null }
    );
    res.json({ success: true, deleted: result.deletedCount, message: `Cleared ${result.deletedCount} ledgers and statements.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Vouchers: Agent uploads transactions list for a company (Admin/Agent only)
router.post('/sync-transactions', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { companyName, transactions } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'transactions array is required' });
    }

    const clientUser = await User.findOne({ companyName, role: 'client' });
    const targetUserId = clientUser ? clientUser._id : req.user.id;

    for (const txn of transactions) {
      const { partyName, voucherNumber, voucherType, date, amount, narration, reference, guid } = txn;
      if (!partyName || !guid) continue;

      await Voucher.findOneAndUpdate(
        { guid },
        {
          $set: {
            userId: targetUserId,
            companyName,
            partyName: partyName.trim(),
            voucherNumber: String(voucherNumber).trim(),
            voucherType: String(voucherType).trim(),
            date: String(date).trim(),
            amount: Number(amount) || 0,
            narration: narration ? String(narration).trim() : '',
            reference: reference ? String(reference).trim() : '',
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: `Successfully synchronized ${transactions.length} vouchers.` });
  } catch (error: any) {
    console.error('Voucher sync-transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET Statement of Vouchers for a ledger
router.get('/:partyName/transactions', authenticateToken, async (req: any, res) => {
  try {
    const companyName = req.user.companyName;
    const { partyName } = req.params;
    const vouchers = await Voucher.find({ companyName, partyName }).sort({ date: 1, voucherNumber: 1 });
    res.json(vouchers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
