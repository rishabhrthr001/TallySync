import express from 'express';
import Item from '../models/Item.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

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
    // Validate unique name per company
    const existing = await Item.findOne({ companyName: req.user.companyName, name: req.body.name });
    if (existing) {
      return res.status(400).json({ error: `An item named "${req.body.name}" already exists in your inventory.` });
    }

    const images: string[] = [];
    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      // Upload raw base64 images to Cloudinary in parallel
      const uploadPromises = req.body.images.map(async (img: any) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
          return await uploadToCloudinary(img, 'photobill_products');
        } else if (typeof img === 'string') {
          return img;
        }
        return null;
      });
      const resolved = await Promise.all(uploadPromises);
      images.push(...resolved.filter((url): url is string => typeof url === 'string'));
    }

    const newItem = new Item({
      ...req.body,
      images,
      userId: req.user.id,
      companyName: req.user.companyName
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error: any) {
    console.error('Failed to create inventory item:', error);
    res.status(400).json({ error: error.message });
  }
});

// Clear all inventory items for the authenticated user's company
router.delete('/clear', authenticateToken, async (req: any, res) => {
  try {
    const result = await Item.deleteMany({ companyName: req.user.companyName });
    res.json({ success: true, deleted: result.deletedCount, message: `Cleared ${result.deletedCount} inventory items.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: any, res) => {
  try {
    // Validate unique name per company if name is changing
    if (req.body.name) {
      const existing = await Item.findOne({
        companyName: req.user.companyName,
        name: req.body.name,
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ error: `An item named "${req.body.name}" already exists in your inventory.` });
      }
    }

    if (req.body.images) {
      const images: string[] = [];
      if (Array.isArray(req.body.images)) {
        const uploadPromises = req.body.images.map(async (img: any) => {
          if (typeof img === 'string' && img.startsWith('data:')) {
            return await uploadToCloudinary(img, 'photobill_products');
          } else if (typeof img === 'string') {
            return img;
          }
          return null;
        });
        const resolved = await Promise.all(uploadPromises);
        images.push(...resolved.filter((url): url is string => typeof url === 'string'));
      }
      req.body.images = images;
    }

    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, companyName: req.user.companyName },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error: any) {
    console.error('Failed to update inventory item:', error);
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

// Sync Request: Enqueue an inventory sync request for the company
router.post('/sync-request', authenticateToken, async (req: any, res) => {
  try {
    const companyName = req.user.role === 'admin' && req.body.companyName ? req.body.companyName : req.user.companyName;
    const updatedUser = await User.findOneAndUpdate(
      { companyName },
      { inventorySyncStatus: 'pending', inventorySyncError: '' },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ error: 'Company not found' });
    res.json({ message: 'Inventory sync request queued successfully', status: 'pending' });
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
      status: user.inventorySyncStatus || 'idle',
      error: user.inventorySyncError || '',
      lastSync: user.lastInventorySync || null
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
    const pendingUsers = await User.find({ inventorySyncStatus: 'pending' }, { companyName: 1, email: 1, _id: 1 });
    res.json(pendingUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Complete: Agent uploads stock items and marks sync as successful (Admin/Agent only)
router.post('/sync-complete', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { companyName, items } = req.body;
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    // Find the company's client user to associate items with
    const clientUser = await User.findOne({ companyName, role: 'client' });
    const targetUserId = clientUser ? clientUser._id : req.user.id;

    // Upsert items in the database
    for (const itemData of items) {
      const { name, unit, stock, rate, gst } = itemData;
      if (!name) continue;

      const derivedStatus = stock > 0 ? 'In Stock' : 'Out of Stock';

      await Item.findOneAndUpdate(
        { companyName, name: name.trim() },
        {
          $set: {
            userId: targetUserId,
            companyName,
            name: name.trim(),
            unit: unit || 'pcs',
            stock: Number(stock) || 0,
            rate: Number(rate) || 0,
            gst: (gst !== undefined && gst !== null) ? Number(gst) : 18,
            status: derivedStatus,
            updatedAt: new Date()
          },
          $setOnInsert: {
            category: 'General',
            sku: '',
            images: []
          }
        },
        { upsert: true, new: true }
      );
    }

    // Mark sync status as success
    await User.findOneAndUpdate(
      { companyName },
      {
        inventorySyncStatus: 'success',
        inventorySyncError: '',
        lastInventorySync: new Date()
      }
    );

    res.json({ success: true, message: `Successfully synchronized ${items.length} items.` });
  } catch (error: any) {
    console.error('Inventory sync-complete error:', error);
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
        inventorySyncStatus: 'failed',
        inventorySyncError: error || 'Unknown error during sync'
      }
    );

    res.json({ success: true, message: 'Sync failure recorded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
