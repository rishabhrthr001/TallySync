import express from 'express';
import Entry from '../models/Entry.js';
import Item from '../models/Item.js';
import Ledger from '../models/Ledger.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import multer from 'multer';
import { extractInvoiceDetails } from '../services/geminiService.js';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();


function normalizeStr(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^[0-9]+[\s\.\-]+/, '') // Remove leading numbers like "1-", "2.", "01 "
    .replace(/(\d+)([a-z]+)/gi, '$1 $2') // Separate numbers and letters e.g. 50kg -> 50 kg
    .replace(/([a-z]+)(\d+)/gi, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')     // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ')            // Collapse extra spaces
    .trim();
}

function findBestInventoryMatch(extractedName: string, inventoryList: any[]) {
  const normExtracted = normalizeStr(extractedName);
  if (!normExtracted) return null;

  const extractedTokens = new Set(normExtracted.split(' ').filter(t => t.length > 0));
  let bestItem: any = null;
  let highestScore = 0;

  for (const dbItem of inventoryList) {
    const dbName = dbItem.name || '';
    const normDb = normalizeStr(dbName);
    if (!normDb) continue;

    // 1. Exact normalized match
    if (normExtracted === normDb) {
      return { item: dbItem, confidence: 1.0 };
    }

    const dbTokens = new Set(normDb.split(' ').filter(t => t.length > 0));
    
    // 2. Jaccard token set similarity
    let intersection = 0;
    for (const token of dbTokens) {
      if (extractedTokens.has(token)) intersection++;
    }
    const union = new Set([...extractedTokens, ...dbTokens]).size;
    const jaccardScore = union > 0 ? intersection / union : 0;

    // 3. Containment check score
    let containmentScore = 0;
    if (normExtracted.includes(normDb) || normDb.includes(normExtracted)) {
      containmentScore = 0.85;
    }

    const finalScore = Math.max(jaccardScore, containmentScore);
    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestItem = dbItem;
    }
  }

  if (highestScore >= 0.45 && bestItem) {
    return { item: bestItem, confidence: Number(highestScore.toFixed(2)) };
  }
  return null;
}

// Shared helper function for document OCR parsing using Gemini
async function parseAndExtractInvoice(
  buffer: Buffer, 
  originalname: string, 
  mimetype: string, 
  docType: 'sales' | 'purchase' = 'purchase',
  companyName?: string
) {
  let finalMime = mimetype;
  if (!finalMime) {
    if (/\.pdf$/i.test(originalname)) finalMime = 'application/pdf';
    else if (/\.png$/i.test(originalname)) finalMime = 'image/png';
    else if (/\.(jpg|jpeg)$/i.test(originalname)) finalMime = 'image/jpeg';
    else finalMime = 'application/octet-stream';
  }

  const data = await extractInvoiceDetails(buffer, finalMime, docType);
  
  // Fetch existing inventory for fuzzy matching
  let inventoryList: any[] = [];
  if (companyName) {
    inventoryList = await Item.find({ companyName });
  }

  // Format and fuzzy match items
  const items = (data.items || []).map(i => {
    let rawName = i.name || 'Extracted Item';
    let quantity = Number(i.quantity) || 1;
    let lineAmount = Number(i.amount) || 0;
    let rate = Number(i.rate) || 0;
    let unit = i.unit || 'BAGS';

    // Regex check for bag counts in rawName (e.g. "(2140 Bags)", "2140 BAGS")
    const bagMatch = rawName.match(/\b(\d{2,6})\s*bags?\b/i) || rawName.match(/\(\s*(\d{2,6})\s*(?:bags?)?\s*\)/i);
    if (bagMatch && bagMatch[1]) {
      const parsedBags = parseInt(bagMatch[1], 10);
      if (parsedBags > 10 && parsedBags !== quantity) {
        quantity = parsedBags;
        unit = 'BAGS';
        if (lineAmount > 0) {
          rate = Number((lineAmount / quantity).toFixed(2));
        }
      }
      // Strip "(2140 Bags)" from rawName so fuzzy matching operates on clean item text
      rawName = rawName
        .replace(/\(\s*\d{2,6}\s*(?:bags?)?\s*\)/gi, '')
        .replace(/\b\d{2,6}\s*bags?\b/gi, '')
        .trim();
    }

    const matchResult = findBestInventoryMatch(rawName, inventoryList);

    // If rate * quantity does not equal lineAmount (e.g. rate was given per Metric Ton instead of per Bag), recalculate rate per bag
    if (lineAmount > 0 && quantity > 0) {
      const calcAmount = quantity * rate;
      if (rate === 0 || Math.abs(calcAmount - lineAmount) > 5) {
        rate = Number((lineAmount / quantity).toFixed(2));
      }
    } else if (rate > 0 && quantity > 0 && lineAmount === 0) {
      lineAmount = Number((quantity * rate).toFixed(2));
    }

    return {
      name: matchResult ? matchResult.item.name : rawName,
      originalExtractedName: rawName,
      hsn: i.hsn || '',
      quantity,
      unit: matchResult?.item?.unit || unit || 'BAGS',
      rate: rate || matchResult?.item?.rate || 0,
      amount: lineAmount,
      gst: Number(i.gst) || matchResult?.item?.gst || 18,
      cgst: Number(i.cgst) || 0,
      sgst: Number(i.sgst) || 0,
      igst: Number(i.igst) || 0,
      matched: !!matchResult,
      confidence: matchResult?.confidence || 0,
      matchedInventoryName: matchResult?.item?.name || null
    };
  });

  if (items.length === 0) {
    items.push({
      name: 'Extracted Total (Verify in Modal)',
      originalExtractedName: 'Extracted Total',
      hsn: '',
      quantity: 1,
      unit: 'pcs',
      rate: data.taxableAmount || data.totalAmount || 0,
      amount: data.taxableAmount || data.totalAmount || 0,
      gst: 18,
      cgst: 0,
      sgst: 0,
      igst: 0,
      matched: false,
      confidence: 0,
      matchedInventoryName: null
    });
  }

  // Intrastate vs Interstate GST check
  let finalGstType: 'cgst-sgst' | 'igst' = data.gstType || 'cgst-sgst';
  if (data.partyGstin && data.partyGstin.length >= 2) {
    const pState = data.partyGstin.substring(0, 2);
    if (pState === '08' || pState === '27') {
      finalGstType = 'cgst-sgst';
    }
  }

  return {
    extractedEntry: {
      type: docType, 
      partyName: data.partyName || 'Unknown Party',
      partyGstin: data.partyGstin || '',
      invoiceNumber: data.invoiceNumber || `DOC-${Math.floor(Math.random() * 9000) + 1000}`,
      date: data.date || new Date().toISOString().split('T')[0],
      items,
      taxableAmount: data.taxableAmount || 0,
      taxAmount: data.taxAmount || 0,
      totalAmount: data.totalAmount || 0,
      gstType: finalGstType,
      notes: data.notes || `Automatically parsed ${docType} bill using Gemini 1.5 Pro`
    }
  };
}

// GET all entries for user/admin
router.post('/upload-pdf', authenticateToken, upload.single('pdf'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const docType: 'sales' | 'purchase' = req.body.docType === 'sales' ? 'sales' : 'purchase';
    const { extractedEntry } = await parseAndExtractInvoice(req.file.buffer, req.file.originalname, req.file.mimetype, docType, req.user.companyName);
    res.json({ success: true, data: extractedEntry }); 
  } catch (error: any) {
    console.error('PDF parsing error DETAIL:', error);
    res.status(500).json({ error: `Failed to parse PDF: ${error.message}` });
  }
});

// Generic route to accept any document format (PDF, PNG, JPG, JPEG)
router.post('/upload-document', authenticateToken, upload.any(), async (req: any, res) => {
  try {
    const file = req.files?.[0] as Express.Multer.File;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const docType: 'sales' | 'purchase' = req.body.docType === 'sales' ? 'sales' : 'purchase';
    const { extractedEntry } = await parseAndExtractInvoice(file.buffer, file.originalname, file.mimetype, docType, req.user.companyName);
    res.json({ success: true, data: extractedEntry }); 
  } catch (error: any) {
    console.error('Document parsing error DETAIL:', error);
    res.status(500).json({ error: `Failed to parse document: ${error.message}` });
  }
});


router.get('/', authenticateToken, async (req: any, res) => {
  try {
    let entries: any[];
    if (req.user.role === 'admin') {
      entries = await Entry.find({}).sort({ createdAt: -1 }).populate('userId', 'name companyName');
      entries = entries.map(e => {
        const obj = e.toObject();
        return {
          ...obj,
          userName: (e.userId as any)?.name || 'Unknown',
          // Use entry's companyName if available, fallback to user's, then 'Unknown'
          companyName: obj.companyName || (e.userId as any)?.companyName || 'Unknown'
        };
      });
    } else {
      entries = await Entry.find({ companyName: req.user.companyName }).sort({ createdAt: -1 });
    }
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Specialized endpoint for the Local Agent to fetch pending entries
router.get('/sync-queue', authenticateToken, async (req: any, res) => {
  try {
    // Only fetch pending entries for the specific company, unless user is admin
    let query: any = { status: 'pending' };
    if (req.user.role !== 'admin') {
      query.companyName = req.user.companyName;
    }
    
    const queue = await Entry.find(query).sort({ createdAt: 1 }); // Process oldest first
    
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST new entry with line items, stock updates, and ledger tracking
router.post('/', authenticateToken, async (req: any, res) => {
  const { type, partyName, invoiceNumber, date, items, taxableAmount, taxAmount, totalAmount, notes, transporterDetails, idempotencyKey, gstType } = req.body;
  
  try {
    // Check for idempotency
    if (idempotencyKey) {
      const existing = await Entry.findOne({ idempotencyKey, companyName: req.user.companyName });
      if (existing) return res.status(409).json({ error: 'Duplicate invoice detected', entry: existing });
    }

    const newEntry = new Entry({
      userId: req.user.id,
      companyName: req.user.companyName,
      type,
      partyName,
      partyGstin: req.body.partyGstin || '',
      invoiceNumber,
      date,
      items,
      taxableAmount,
      taxAmount,
      totalAmount,
      gstType: gstType || 'cgst-sgst',
      notes,
      transporterDetails,
      idempotencyKey,
      status: 'pending' // Default status for Tally agent to pick up
    });

    await newEntry.save();

    // BACKGROUND: Update Stock and Ledger (can be async OR inside transaction)
    // For simplicity, we update sequentially here.
    
    // 1. Update/Create Ledger
    const multiplier = type === 'sales' ? 1 : -1; // Sales increases balance (receivable), Purchase decreases it (payable)
    await Ledger.findOneAndUpdate(
      { companyName: req.user.companyName, partyName },
      { 
        $inc: { balance: totalAmount * multiplier }, 
        $set: { 
          updatedAt: new Date(), 
          userId: req.user.id,
          ...(req.body.partyGstin ? { gstin: req.body.partyGstin } : {})
        } 
      },
      { upsert: true }
    );

    // 2. Update Stock for each item
    for (const lineItem of items) {
      const stockMultiplier = type === 'sales' ? -1 : 1; // Sales decreases stock, Purchase increases it
      await Item.findOneAndUpdate(
        { companyName: req.user.companyName, name: lineItem.name },
        { 
          $inc: { stock: lineItem.quantity * stockMultiplier }, 
          $set: { rate: lineItem.rate, updatedAt: new Date(), userId: req.user.id } 
        },
        { upsert: true }
      );
    }

    res.status(201).json(newEntry);
  } catch (error: any) {
    if (error.code === 11000) return res.status(400).json({ error: 'Invoice number or idempotency key already exists' });
    res.status(400).json({ error: error.message });
  }
});

// Admin patch for status
router.patch('/:id/status', authenticateToken, isAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'success', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await Entry.findByIdAndUpdate(req.params.id, { status });
  res.json({ message: 'Status updated' });
});

// Agent patch for sync status (allows regular users/agents to update their own entries)
router.patch('/:id/sync-status', authenticateToken, async (req: any, res) => {
  const { status, error } = req.body;
  
  if (!['success', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid sync status' });
  }

  try {
    let query: any = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.companyName = req.user.companyName;
    }
    const entry = await Entry.findOne(query);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    entry.status = status;
    if (error) entry.syncError = error;
    await entry.save();

    res.json({ message: `Status updated to ${status}`, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retry logic
router.post('/:id/retry', authenticateToken, isAdmin, async (req, res) => {
  await Entry.findByIdAndUpdate(req.params.id, { status: 'pending' });
  res.json({ message: 'Entry queued for retry' });
});

// Dashboard stats endpoint
router.get('/dashboard-stats', authenticateToken, async (req: any, res) => {
  try {
    const entries = await Entry.find({ companyName: req.user.companyName });
    
    const stats = {
      totalSales: 0,
      totalPurchase: 0,
      pendingCount: 0,
      failedCount: 0,
      monthlySales: Array(12).fill(0),
      monthlyPurchase: Array(12).fill(0)
    };

    entries.forEach(e => {
      const date = new Date(e.date);
      const month = date.getMonth();
      
      if (e.type === 'sales') {
        stats.totalSales += e.totalAmount;
        if (month >= 0 && month < 12) stats.monthlySales[month] += e.totalAmount;
      } else {
        stats.totalPurchase += e.totalAmount;
        if (month >= 0 && month < 12) stats.monthlyPurchase[month] += e.totalAmount;
      }

      if (e.status === 'pending') stats.pendingCount++;
      if (e.status === 'failed') stats.failedCount++;
    });

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
