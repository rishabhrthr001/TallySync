import express from 'express';
import Entry from '../models/Entry.js';
import Item from '../models/Item.js';
import Ledger from '../models/Ledger.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import multer from 'multer';
import { LiteParse } from '@llamaindex/liteparse';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();


// Shared helper function for document OCR parsing
async function parseAndExtractInvoice(buffer: Buffer, originalname: string) {
  const parser = new LiteParse({ ocrEnabled: true });
  const result = await parser.parse(buffer);
  const text = result.text;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. IMPROVED INVOICE NUMBER
  let invoiceNumber = '';
  const invPatterns = [
    /(?:Invoice No|INV|Invoice Number|Bill No|SI\s*No|Ref[:\s]|Document No)[:\s#-]*([A-Za-z0-9/-]+)/i,
     /^[A-Z]{2,3}[\d-]{4,11}$/
  ];
  for (const p of invPatterns) {
     const match = text.match(p);
     if (match && match[1]) {
       invoiceNumber = match[1].trim();
       break;
     }
  }
  
  const isImage = /\.(jpg|jpeg|png)$/i.test(originalname);
  const prefix = isImage ? 'IMG' : 'PDF';
  if (!invoiceNumber) invoiceNumber = `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;

  // 2. STICKY DATE EXTRACTION
  let dateMatch = '';
  const datePatterns = [
     /(?:Date|Invoice Date|Inv Date|Period|Dated)[:\s#-]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
     /(\d{1,2}[\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]+\d{4})/i
  ];
  for (const p of datePatterns) {
     const match = text.match(p);
     if (match && match[1]) {
       dateMatch = match[1].trim();
       break;
     }
  }
  if (!dateMatch) dateMatch = new Date().toISOString().split('T')[0];

  // 3. PARTY NAME
  let partyName = '';
  const partyPatterns = [
     /(?:M\/s|Messers|Buyer|To|Billed To|Customer|Consignee|Sold To)[:\s-]+([A-Z\s\.&,]{3,50})(?:\r?\n|$)/i,
     /(?:Party Name|Seller|Vendor)[:\s-]+([A-Z\s\.&,]{3,50})(?:\r?\n|$)/i
  ];
  for (const p of partyPatterns) {
     const match = text.match(p);
     if (match && match[1]) {
       partyName = match[1].trim();
       break;
     }
  }
  if (!partyName || partyName.toLowerCase().includes('tax invoice')) {
     const skipKeywords = ['tax', 'invoice', 'original', 'duplicate', 'bill'];
     const candidateLines = lines.slice(0, 10).filter(l => 
        !skipKeywords.some(k => l.toLowerCase().includes(k)) && l.length > 5
     );
     if (candidateLines.length > 1) partyName = candidateLines[1];
  }
  if (!partyName) partyName = 'Unknown Party';

  // 3.5 GSTIN EXTRACTION
  let partyGstin = '';
  const gstinMatch = text.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/);
  if (gstinMatch) {
     partyGstin = gstinMatch[0];
  }

  // Determine GST Type based on GSTIN (27 is Maharashtra, local)
  let gstType = 'cgst-sgst';
  if (partyGstin && !partyGstin.startsWith('27')) {
     gstType = 'igst';
  }

  // 4. AMOUNT EXTRACTIONS (Taxable, Tax/GST, Grand Total)
  const taxableMatch = text.match(/(?:Sub Total|Taxable Value|Taxable Amount|Assessable Value|Total Taxable Value|Before Tax)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);
  let taxableAmount = taxableMatch ? parseFloat(taxableMatch[1].replace(/,/g, '')) : 0;

  const totalMatch = text.match(/(?:Total Amount|Grand Total|Total|Payable|Net Due|Amount Due|Total Payable)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);
  let totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;

  let taxAmount = 0;
  const cgstMatch = text.match(/(?:CGST|Central Tax)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);
  const sgstMatch = text.match(/(?:SGST|State Tax)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);
  const igstMatch = text.match(/(?:IGST|Integrated Tax)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);
  const totalTaxMatch = text.match(/(?:Total Tax|Tax Amount|GST Amount|Total GST)[\s:#-]*[^\d]*\s*([\d,]+\.?\d*)/i);

  if (cgstMatch && sgstMatch) {
    const cgst = parseFloat(cgstMatch[1].replace(/,/g, ''));
    const sgst = parseFloat(sgstMatch[1].replace(/,/g, ''));
    if (!isNaN(cgst) && !isNaN(sgst)) {
      taxAmount = cgst + sgst;
    }
  } else if (igstMatch) {
    const igst = parseFloat(igstMatch[1].replace(/,/g, ''));
    if (!isNaN(igst)) {
      taxAmount = igst;
    }
  } else if (totalTaxMatch) {
    const totalTax = parseFloat(totalTaxMatch[1].replace(/,/g, ''));
    if (!isNaN(totalTax)) {
      taxAmount = totalTax;
    }
  }

  // Harmonize total, taxable, and tax amounts
  if (totalAmount > 0 && taxAmount > 0 && taxableAmount === 0) {
    taxableAmount = totalAmount - taxAmount;
  } else if (taxableAmount > 0 && taxAmount > 0 && totalAmount === 0) {
    totalAmount = taxableAmount + taxAmount;
  } else if (totalAmount > 0 && taxableAmount > 0 && taxAmount === 0) {
    taxAmount = totalAmount - taxableAmount;
  } else if (totalAmount > 0 && taxAmount === 0 && taxableAmount === 0) {
    taxableAmount = totalAmount / 1.18;
    taxAmount = totalAmount - taxableAmount;
  }

  taxableAmount = Number(taxableAmount.toFixed(2));
  taxAmount = Number(taxAmount.toFixed(2));
  totalAmount = Number(totalAmount.toFixed(2));

  const items = [
     { name: 'Extracted Total (Verify in Modal)', quantity: 1, rate: taxableAmount }
  ];

  return {
    extractedEntry: {
      type: 'purchase', 
      partyName,
      partyGstin,
      invoiceNumber,
      date: dateMatch,
      items,
      taxableAmount,
      taxAmount,
      totalAmount,
      gstType,
      notes: `Automatically parsed from ${prefix}`
    },
    rawText: text.substring(0, 2000)
  };
}

// GET all entries for user/admin
router.post('/upload-pdf', authenticateToken, upload.single('pdf'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { extractedEntry, rawText } = await parseAndExtractInvoice(req.file.buffer, req.file.originalname);
    res.json({ success: true, data: extractedEntry, rawText }); 
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
    const { extractedEntry, rawText } = await parseAndExtractInvoice(file.buffer, file.originalname);
    res.json({ success: true, data: extractedEntry, rawText }); 
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
