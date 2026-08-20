import express from 'express';
import Entry from '../models/Entry.js';
import Item from '../models/Item.js';
import Ledger from '../models/Ledger.js';
import User from '../models/User.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { checkDailyBillLimit, checkProFeatureAccess } from '../middleware/subscriptionMiddleware.js';
import multer from 'multer';
import { extractInvoiceDetails, extractBankStatementDetails } from '../services/geminiService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = promisify(exec);

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
  companyName?: string,
  password?: string
) {
  let finalMime = mimetype;
  if (!finalMime) {
    if (/\.pdf$/i.test(originalname)) finalMime = 'application/pdf';
    else if (/\.png$/i.test(originalname)) finalMime = 'image/png';
    else if (/\.(jpg|jpeg)$/i.test(originalname)) finalMime = 'image/jpeg';
    else finalMime = 'application/octet-stream';
  }

  let fileBuffer = buffer;
  const cleanPassword = (password || '').trim();
  if (cleanPassword && (finalMime === 'application/pdf' || /\.pdf$/i.test(originalname))) {
    fileBuffer = await decryptPdf(fileBuffer, cleanPassword);
    finalMime = 'application/pdf';
  }

  const data = await extractInvoiceDetails(fileBuffer, finalMime, docType);
  
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

// POST upload-pdf route
router.post('/upload-pdf', authenticateToken, checkProFeatureAccess, upload.single('pdf'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const docType: 'sales' | 'purchase' = req.body.docType === 'sales' ? 'sales' : 'purchase';
    const password = req.body.password;
    const { extractedEntry } = await parseAndExtractInvoice(req.file.buffer, req.file.originalname, req.file.mimetype, docType, req.user.companyName, password);
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
    const password = req.body.password;
    const { extractedEntry } = await parseAndExtractInvoice(file.buffer, file.originalname, file.mimetype, docType, req.user.companyName, password);
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
router.post('/', authenticateToken, checkDailyBillLimit, async (req: any, res) => {
  const { type, partyName, invoiceNumber, date, items, taxableAmount, taxAmount, totalAmount, notes, transporterDetails, idempotencyKey, gstType } = req.body;
  
  try {
    // Check for idempotency
    if (idempotencyKey) {
      const existing = await Entry.findOne({ idempotencyKey, companyName: req.user.companyName });
      if (existing) return res.status(409).json({ error: 'Duplicate invoice detected', entry: existing });
    }

    const safeItems = Array.isArray(items) ? items : [];

    const newEntry = new Entry({
      userId: req.user.id,
      companyName: req.user.companyName,
      type,
      partyName,
      partyGstin: req.body.partyGstin || '',
      invoiceNumber,
      date,
      items: safeItems,
      taxableAmount: Number(taxableAmount) || 0,
      taxAmount: Number(taxAmount) || 0,
      totalAmount: Number(totalAmount) || 0,
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

    // 2. Update Stock for each item (if any items present)
    for (const lineItem of safeItems) {
      if (!lineItem || !lineItem.name || !lineItem.name.trim()) continue;
      const stockMultiplier = type === 'sales' ? -1 : 1; // Sales decreases stock, Purchase increases it
      await Item.findOneAndUpdate(
        { companyName: req.user.companyName, name: lineItem.name },
        { 
          $inc: { stock: (Number(lineItem.quantity) || 0) * stockMultiplier }, 
          $set: { rate: Number(lineItem.rate) || 0, updatedAt: new Date(), userId: req.user.id } 
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
router.post('/:id/retry', authenticateToken, async (req: any, res) => {
  try {
    let query: any = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.companyName = req.user.companyName;
    }
    const entry = await Entry.findOneAndUpdate(
      query,
      { $set: { status: 'pending', syncError: '' } },
      { new: true }
    );
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Entry re-queued for Tally sync', entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

    // Aggregate Tally metrics from ledgers and user summary
    const [ledgers, user] = await Promise.all([
      Ledger.find({ companyName: req.user.companyName }),
      User.findOne({ companyName: req.user.companyName })
    ]);

    let ledgerOpeningSum = 0;
    let ledgerClosingSum = 0;
    let ledgerDebitSum = 0;
    let ledgerCreditSum = 0;

    ledgers.forEach(l => {
      ledgerOpeningSum += (l.openingBalance || 0);
      ledgerClosingSum += (l.closingBalance || l.balance || 0);
      ledgerDebitSum += (l.debitTotal || 0);
      ledgerCreditSum += (l.creditTotal || 0);
    });

    const tallySummary = {
      openingBalance: user?.tallySummary?.openingBalance || ledgerOpeningSum,
      closingBalance: user?.tallySummary?.closingBalance || ledgerClosingSum,
      totalDebit: user?.tallySummary?.totalDebit || ledgerDebitSum,
      totalCredit: user?.tallySummary?.totalCredit || ledgerCreditSum,
      lastSyncedAt: user?.tallySummary?.lastSyncedAt || user?.lastLedgerSync || null
    };

    res.json({
      ...stats,
      tallySummary
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update printed status
router.patch('/:id/print-status', authenticateToken, async (req: any, res) => {
  try {
    let query: any = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.companyName = req.user.companyName;
    }
    const entry = await Entry.findOne(query);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    entry.printed = true;
    entry.printedAt = new Date();
    await entry.save();
    res.json({ message: 'Printed status updated successfully', entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Robust multi-strategy helper to decrypt password-protected PDFs (qpdf / pdftocairo / Ghostscript)
async function decryptPdf(buffer: Buffer, password?: string): Promise<Buffer> {
  const cleanPassword = (password || '').trim();
  if (!cleanPassword) {
    return buffer;
  }
  
  const tempDir = os.tmpdir();
  const timestamp = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const inputPath = path.join(tempDir, `enc_in_${timestamp}.pdf`);
  const outputPath = path.join(tempDir, `dec_out_${timestamp}.pdf`);
  
  try {
    await fs.promises.writeFile(inputPath, buffer);
    const escapedPassword = cleanPassword.replace(/"/g, '\\"');
    
    let decrypted = false;

    // Strategy 1: qpdf (Gold standard: supports RC4, AES-128, AES-256 encrypted bank PDFs)
    try {
      const customQpdfPath = path.join(process.cwd(), 'bin', 'qpdf-12.4.0-msvc64', 'bin', 'qpdf.exe');
      const qpdfExe = fs.existsSync(customQpdfPath) ? `"${customQpdfPath}"` : 'qpdf';
      const qpdfCmd = `${qpdfExe} --password="${escapedPassword}" --decrypt "${inputPath}" "${outputPath}"`;
      try {
        await execPromise(qpdfCmd);
      } catch (qpdfErr: any) {
        // Exit code 3 in qpdf means minor PDF syntax warnings, but file is decrypted successfully
        if (qpdfErr.code !== 3) {
          throw qpdfErr;
        }
      }
      if (fs.existsSync(outputPath)) {
        const stat = await fs.promises.stat(outputPath);
        if (stat.size > 100) {
          decrypted = true;
        }
      }
    } catch (e: any) {
      console.warn('[PDF Decrypt] qpdf attempt failed, trying fallback...', e.message);
    }

    // Strategy 2: pdftocairo (Poppler)
    if (!decrypted) {
      try {
        const popplerCmd = `pdftocairo -pdf -upw "${escapedPassword}" "${inputPath}" "${outputPath}"`;
        await execPromise(popplerCmd);
        if (fs.existsSync(outputPath)) {
          const stat = await fs.promises.stat(outputPath);
          if (stat.size > 100) {
            decrypted = true;
          }
        }
      } catch (e: any) {
        console.warn('[PDF Decrypt] pdftocairo attempt failed, trying Ghostscript...', e.message);
      }
    }

    // Strategy 3: Ghostscript (gs)
    if (!decrypted) {
      try {
        const gsCmd = `gs -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOutputFile="${outputPath}" -sPDFPassword="${escapedPassword}" "${inputPath}"`;
        await execPromise(gsCmd);
        if (fs.existsSync(outputPath)) {
          const stat = await fs.promises.stat(outputPath);
          if (stat.size > 100) {
            decrypted = true;
          }
        }
      } catch (e: any) {
        console.warn('[PDF Decrypt] Ghostscript attempt failed...', e.message);
      }
    }

    if (!decrypted || !fs.existsSync(outputPath)) {
      throw new Error('Invalid PDF password or decryption failed. Please verify the password.');
    }

    const decryptedBuffer = await fs.promises.readFile(outputPath);
    console.log(`[PDF Decrypt] Successfully decrypted PDF with password (${decryptedBuffer.length} bytes)`);
    return decryptedBuffer;
  } catch (error: any) {
    console.error('PDF decryption error:', error.message || error);
    throw new Error('Invalid PDF password or decryption failed. Please verify the password.');
  } finally {
    // Cleanup temporary files
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }
}

// Route to accept bank statement (PDF, etc.) and return parsed transactions without saving them yet
router.post('/upload-bank-statement', authenticateToken, checkProFeatureAccess, upload.single('pdf'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let finalMime = req.file.mimetype;
    if (!finalMime) {
      if (/\.pdf$/i.test(req.file.originalname)) finalMime = 'application/pdf';
      else finalMime = 'application/octet-stream';
    }

    const password = req.body.password ? req.body.password.trim() : '';
    let fileBuffer = req.file.buffer;

    if (password && (finalMime === 'application/pdf' || /\.pdf$/i.test(req.file.originalname))) {
      try {
        fileBuffer = await decryptPdf(fileBuffer, password);
        finalMime = 'application/pdf';
      } catch (decryptErr: any) {
        return res.status(400).json({ error: decryptErr.message });
      }
    }

    // Call gemini service to extract transactions
    let data;
    try {
      data = await extractBankStatementDetails(fileBuffer, finalMime);
    } catch (parseErr: any) {
      console.error('[Bank Statement Upload] Extraction error:', parseErr);
      const errStr = (parseErr.message || '').toLowerCase();
      if ((errStr.includes('encrypt') || errStr.includes('password')) && !password) {
        return res.status(400).json({ error: 'This PDF appears to be password-protected. Please enter the PDF password and try again.' });
      }
      return res.status(500).json({ error: `Bank statement parsing failed: ${parseErr.message || 'Unable to process document'}` });
    }
    const rawTransactions = data.transactions || [];
    const detectedBank = (data.bankName || 'Bank Account').trim();

    const formattedTransactions = rawTransactions.map((txn: any) => {
      const lowercaseType = (txn.voucherType || 'Payment').toLowerCase();
      let party = txn.partyName || '';
      if (!party) {
        if (lowercaseType === 'payment') {
          party = 'Bank Expenses';
        } else if (lowercaseType === 'receipt') {
          party = 'Bank Receipts';
        } else {
          party = 'Bank Adjustments';
        }
      }
      return {
        date: txn.date,
        type: lowercaseType,
        partyName: party,
        invoiceNumber: txn.referenceNumber || `TXN-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        totalAmount: txn.amount,
        notes: txn.narration || '',
        confidence: txn.confidence || 1.0,
        reason: txn.reason || '',
        bankLedger: (txn.bankLedger || detectedBank).trim()
      };
    });

    res.json({ 
      success: true, 
      count: formattedTransactions.length, 
      bankName: detectedBank,
      accountNumber: data.accountNumber || '',
      ifsc: data.ifsc || '',
      openingBalance: data.openingBalance || 0,
      closingBalance: data.closingBalance || 0,
      statementPeriod: data.statementPeriod || null,
      data: formattedTransactions 
    });
  } catch (error: any) {
    console.error('Bank statement parsing error DETAIL:', error);
    res.status(500).json({ error: `Failed to parse bank statement: ${error.message}` });
  }
});

// Bulk insert reviewed bank statement transactions or other vouchers
router.post('/bulk', authenticateToken, checkDailyBillLimit, async (req: any, res) => {
  const { transactions, bankName } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Invalid transactions array' });
  }

  const createdEntries = [];

  try {
    for (const txn of transactions) {
      const lowercaseType = txn.type ? txn.type.toLowerCase() : 'payment';
      const refNum = txn.invoiceNumber || `TXN-${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      const idempotencyKey = `${req.user.companyName}-${refNum}-${txn.totalAmount}-${txn.date}`;

      // Check if entry already exists (prevent duplicate entries)
      const existing = await Entry.findOne({ idempotencyKey, companyName: req.user.companyName });
      if (existing) {
        createdEntries.push(existing);
        continue;
      }

      const assignedBankLedger = (txn.bankLedger || bankName || 'Bank Account').trim();

      const newEntry = new Entry({
        userId: req.user.id,
        companyName: req.user.companyName,
        type: lowercaseType,
        partyName: txn.partyName || 'Bank Adjustments',
        partyGstin: '',
        invoiceNumber: refNum,
        date: txn.date,
        items: [],
        taxableAmount: txn.totalAmount,
        taxAmount: 0,
        totalAmount: txn.totalAmount,
        gstType: 'cgst-sgst',
        status: 'pending',
        bankLedger: assignedBankLedger,
        notes: txn.notes || 'Bulk imported bank transaction',
        idempotencyKey
      });

      await newEntry.save();
      createdEntries.push(newEntry);

      // Update/Create Ledger
      const multiplier = (lowercaseType === 'sales' || lowercaseType === 'receipt') ? 1 : -1;
      await Ledger.findOneAndUpdate(
        { companyName: req.user.companyName, partyName: newEntry.partyName },
        { 
          $inc: { balance: newEntry.totalAmount * multiplier }, 
          $set: { 
            updatedAt: new Date(), 
            userId: req.user.id
          } 
        },
        { upsert: true }
      );
    }

    res.json({ success: true, count: createdEntries.length, data: createdEntries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk insert reconciled purchase entries from GSTR-2A/2B comparison
router.post('/reconciled-bulk', authenticateToken, checkDailyBillLimit, async (req: any, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid entries array' });
  }

  const createdEntries = [];

  try {
    for (const e of entries) {
      const refNum = e.invoiceNumber || `PUR-${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      const dateStr = e.date || new Date().toISOString().split('T')[0];
      const totalAmt = Number(e.totalAmount || 0);
      const taxableAmt = Number(e.taxableAmount || totalAmt);
      const taxAmt = Number(e.taxAmount || 0);
      
      const idempotencyKey = `${req.user.companyName}-${refNum}-${totalAmt}-${dateStr}`;

      // Check if entry already exists (prevent duplicate entries)
      const existing = await Entry.findOne({ idempotencyKey, companyName: req.user.companyName });
      if (existing) {
        createdEntries.push(existing);
        continue;
      }

      // Default item
      const gstRate = taxableAmt > 0 && taxAmt > 0 ? Math.round((taxAmt / taxableAmt) * 100) : 18;
      const defaultItem = {
        name: `Supply of Goods / Services (Purchase)`,
        quantity: 1,
        rate: taxableAmt,
        amount: taxableAmt,
        gst: gstRate,
        hsn: '9983',
        unit: 'NOS'
      };

      const newEntry = new Entry({
        userId: req.user.id,
        companyName: req.user.companyName,
        type: 'purchase',
        partyName: e.partyName || 'Cash Purchase',
        partyGstin: e.partyGstin || '',
        invoiceNumber: refNum,
        date: dateStr,
        items: [defaultItem],
        taxableAmount: taxableAmt,
        taxAmount: taxAmt,
        totalAmount: totalAmt,
        gstType: e.gstType || 'cgst-sgst',
        status: 'pending',
        notes: e.notes || 'Auto-imported from GSTR-2A/2B Reconciliation',
        idempotencyKey
      });

      await newEntry.save();
      createdEntries.push(newEntry);

      // Update/Create Ledger
      await Ledger.findOneAndUpdate(
        { companyName: req.user.companyName, partyName: newEntry.partyName },
        { 
          $inc: { balance: -newEntry.totalAmount }, 
          $set: { 
            updatedAt: new Date(), 
            userId: req.user.id
          } 
        },
        { upsert: true }
      );
    }

    res.json({ success: true, count: createdEntries.length, data: createdEntries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update mismatched purchase entries from GSTR-2A/2B comparison
router.post('/reconciled-update', authenticateToken, async (req: any, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Invalid updates array' });
  }

  const updatedEntries = [];

  try {
    for (const update of updates) {
      const entry = await Entry.findOne({ _id: update.entryId, companyName: req.user.companyName });
      if (!entry) continue;

      const oldAmount = entry.totalAmount || 0;
      const newAmount = Number(update.totalAmount || 0);

      // Update entry fields
      entry.totalAmount = newAmount;
      entry.taxableAmount = Number(update.taxableAmount || newAmount);
      entry.taxAmount = Number(update.taxAmount || 0);
      entry.date = update.date || entry.date;
      if (update.partyGstin) entry.partyGstin = update.partyGstin;
      if (update.partyName) entry.partyName = update.partyName;
      entry.status = 'pending'; // Re-queue for Tally sync
      entry.notes = `${entry.notes || ''}\n[Updated from GSTR Reconciliation on ${new Date().toISOString().split('T')[0]}]`;

      // Update items rate/amount to match new taxableAmount
      if (entry.items && entry.items.length > 0) {
        entry.items[0].rate = entry.taxableAmount;
        entry.items[0].amount = entry.taxableAmount;
      }

      await entry.save();
      updatedEntries.push(entry);

      // Adjust Ledger balance
      const diff = oldAmount - newAmount;
      if (diff !== 0) {
        await Ledger.findOneAndUpdate(
          { companyName: req.user.companyName, partyName: entry.partyName },
          { 
            $inc: { balance: diff }, 
            $set: { 
              updatedAt: new Date(), 
              userId: req.user.id
            } 
          },
          { upsert: true }
        );
      }
    }

    res.json({ success: true, count: updatedEntries.length, data: updatedEntries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk retry entries for Tally sync (used by GST 2A/2B pages)
router.post('/bulk-retry', authenticateToken, async (req: any, res) => {
  const { entryIds, withItems } = req.body;
  
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({ error: 'No entry IDs provided' });
  }

  try {
    let query: any = { _id: { $in: entryIds } };
    if (req.user.role !== 'admin') {
      query.companyName = req.user.companyName;
    }

    const updateFields: any = { 
      status: 'pending', 
      syncError: '' 
    };

    // If withItems is explicitly false, clear items so agent uses accounting voucher mode
    if (withItems === false) {
      updateFields.items = [];
    }

    const result = await Entry.updateMany(query, { $set: updateFields });

    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} entries re-queued for Tally sync${withItems === false ? ' (without items)' : ' (with items)'}` 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
