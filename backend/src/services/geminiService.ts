import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Initialize the Google Gen AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Safe JSON parser for Gemini responses that might contain markdown fences or leading/trailing text
 */
export function parseGeminiJson<T>(rawText: string): T {
  let cleaned = (rawText || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = 0;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  let endIdx = cleaned.length;
  if (lastBrace !== -1 && lastBracket !== -1) {
    endIdx = Math.max(lastBrace, lastBracket) + 1;
  } else if (lastBrace !== -1) {
    endIdx = lastBrace + 1;
  } else if (lastBracket !== -1) {
    endIdx = lastBracket + 1;
  }

  if (startIdx > 0 || endIdx < cleaned.length) {
    cleaned = cleaned.substring(startIdx, endIdx).trim();
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Extracts tabular text directly from a decrypted PDF using poppler's pdftotext
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const tempDir = os.tmpdir();
  const timestamp = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const inputPath = path.join(tempDir, `txt_in_${timestamp}.pdf`);
  const outputPath = path.join(tempDir, `txt_out_${timestamp}.txt`);

  try {
    await fs.promises.writeFile(inputPath, buffer);
    // pdftotext -layout preserves columns and tabular structure for bank statements
    const customPdftotextPath = path.join(process.cwd(), 'bin', 'poppler', 'poppler-26.02.0', 'Library', 'bin', 'pdftotext.exe');
    const pdftotextExe = fs.existsSync(customPdftotextPath) ? `"${customPdftotextPath}"` : 'pdftotext';
    const cmd = `${pdftotextExe} -layout "${inputPath}" "${outputPath}"`;
    await execPromise(cmd);
    if (fs.existsSync(outputPath)) {
      const text = await fs.promises.readFile(outputPath, 'utf-8');
      return text.trim();
    }
  } catch (e: any) {
    console.warn('[pdftotext] Direct text extraction skipped/failed:', e.message);
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }
  return '';
}

export interface ExtractedProductInfo {
  productName: string;
  brand: string;
  sku: string;
  category: string;
  distinctiveFeatures: string;
}

// Strict JSON schema constraints for product details extraction
const productExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    productName: { 
      type: SchemaType.STRING, 
      description: 'The identified name of the product or item in the image (including product type, pack size, or flavor, e.g. iPhone 12, Matte Coated Paper A4).' 
    },
    brand: { 
      type: SchemaType.STRING, 
      description: 'The brand name of the product if visible.' 
    },
    sku: { 
      type: SchemaType.STRING, 
      description: 'The SKU, product code, catalog code, or barcode sequence visible on the package (or empty if none found).' 
    },
    category: { 
      type: SchemaType.STRING, 
      description: 'General category classification (e.g. Electronics, Food, Bike Parts, Office Supplies, etc.).' 
    },
    distinctiveFeatures: { 
      type: SchemaType.STRING, 
      description: 'Color, packaging type, count, quantity, or specific attributes.' 
    }
  },
  required: ['productName', 'brand', 'category']
};

// Strict JSON schema constraints for inventory-first matching
const inventoryMatchingSchema = {
  type: SchemaType.OBJECT,
  properties: {
    detectedProduct: {
      type: SchemaType.OBJECT,
      properties: {
        productName: { type: SchemaType.STRING, description: 'Visual name of the product seen in the photo (e.g. Wireless Earbuds Charging Case, iPhone, Fertilizer Bag).' },
        brand: { type: SchemaType.STRING, description: 'Brand if visible.' },
        category: { type: SchemaType.STRING, description: 'General category.' },
        distinctiveFeatures: { type: SchemaType.STRING, description: 'Color, packaging type, shape, or distinctive attributes.' }
      },
      required: ['productName']
    },
    matches: {
      type: SchemaType.ARRAY,
      description: 'List of matching inventory items from the provided catalog, ordered by highest match confidence.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'The exact _id of the matched inventory item from the catalog.' },
          confidence: { type: SchemaType.NUMBER, description: 'Match confidence percentage (0 to 100). E.g. 90-98 for direct visual match, 70-89 for related variant/category match.' },
          reason: { type: SchemaType.STRING, description: 'Brief explanation why this inventory item matches.' }
        },
        required: ['id', 'confidence']
      }
    }
  },
  required: ['detectedProduct', 'matches']
};

export interface InventoryMatchingResult {
  detectedProduct: {
    productName: string;
    brand?: string;
    category?: string;
    distinctiveFeatures?: string;
  };
  matches: Array<{
    id: string;
    confidence: number;
    reason?: string;
  }>;
}

/**
 * Compares a captured product image directly against the company's full inventory catalog using Gemini Vision AI.
 */
export async function matchProductWithInventoryCatalog(
  base64Image: string,
  inventoryCatalog: Array<{ _id: string; name: string; category?: string; sku?: string; rate?: number }>
): Promise<InventoryMatchingResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    // Parse base64 string to inlineData structure
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const base64Data = matches ? matches[2] : base64Image;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const catalogSnippet = JSON.stringify(
      inventoryCatalog.map(item => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category || 'General',
        sku: item.sku || ''
      })),
      null,
      2
    );

    const prompt = `You are an expert AI product recognition and inventory matching assistant for a retail and billing system.

TASK:
1. Examine the product image carefully and identify what product/item is shown (name, brand, category, visual features).
2. Match the product in the image against the COMPANY INVENTORY CATALOG provided below:
   - Identify which inventory items visually, semantically, or functionally represent this product (e.g. if the image shows earphone cases/earbuds and an inventory item is named "Airpods" or "OnePlus Case" or similar audio/mobile accessories, match them with high confidence).
   - If an item in the catalog is the same product or a visual counterpart, assign a high confidence match score (e.g. 75% to 98%).
   - Only return inventory items from the catalog that match with a confidence score > 50%.
   - If none of the items in the catalog match this product with > 50% confidence, return an empty "matches" array.

COMPANY INVENTORY CATALOG (${inventoryCatalog.length} items):
${catalogSnippet}

Return the extracted product details and any matched inventory items strictly following the JSON schema.`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            imagePart
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: inventoryMatchingSchema as any
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Gemini Vision returned empty content.');
    }

    return JSON.parse(responseText) as InventoryMatchingResult;
  } catch (error: any) {
    console.error('Gemini inventory catalog matching error:', error);
    // Fallback to basic extraction if catalog matching fails
    const basic = await extractProductDetails(base64Image);
    return {
      detectedProduct: basic,
      matches: []
    };
  }
}

/**
 * Extracts structured product details from a base64 encoded image using Gemini Vision.
 */
export async function extractProductDetails(base64Image: string): Promise<ExtractedProductInfo> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    // Parse base64 string to inlineData structure
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const base64Data = matches ? matches[2] : base64Image;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const prompt = 'Analyze the product in this image. Identify and extract its name, brand, SKU/product code, category, and visual features.';

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            imagePart
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: productExtractionSchema as any
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Gemini Vision returned empty content.');
    }

    return JSON.parse(responseText) as ExtractedProductInfo;
  } catch (error: any) {
    console.error('Gemini Vision product extraction error:', error);
    throw new Error(`Gemini Vision product extraction failed: ${error.message || error}`);
  }
}

// Strict JSON schema constraints for invoice/bill details extraction
const invoiceExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    partyName: { 
      type: SchemaType.STRING, 
      description: 'The name of the party. For PURCHASE bills, this MUST be the Supplier/Vendor/Seller name (e.g., JJMBSS 2025-26). For SALES bills, this MUST be the Buyer/Customer name.' 
    },
    partyGstin: { 
      type: SchemaType.STRING, 
      description: 'The 15-character GSTIN of the party. For PURCHASE bills, this MUST be the Supplier/Vendor GSTIN. For SALES bills, this MUST be the Buyer/Customer GSTIN.' 
    },
    invoiceNumber: { 
      type: SchemaType.STRING, 
      description: 'The invoice number or bill reference number.' 
    },
    date: { 
      type: SchemaType.STRING, 
      description: 'The invoice date in YYYY-MM-DD format.' 
    },
    items: {
      type: SchemaType.ARRAY,
      description: 'Line items / products listed in the bill.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: 'Clean item name or description. Strip leading indices like "1-", serial numbers, batch lines like "Batch: Primary Batch", and formatting artifacts. Preserve product variants.' },
          hsn: { type: SchemaType.STRING, description: 'HSN/SAC code if listed.' },
          quantity: { type: SchemaType.NUMBER, description: 'Quantity of the item.' },
          unit: { type: SchemaType.STRING, description: 'Unit of measure (e.g. PCS, KG, BAG, BOX, MTR, NOS).' },
          rate: { type: SchemaType.NUMBER, description: 'Rate or unit price.' },
          amount: { type: SchemaType.NUMBER, description: 'Total taxable line amount (quantity * rate).' },
          gst: { type: SchemaType.NUMBER, description: 'GST rate percentage (e.g., 5, 12, 18, 28).' },
          cgst: { type: SchemaType.NUMBER, description: 'CGST amount for this line item.' },
          sgst: { type: SchemaType.NUMBER, description: 'SGST amount for this line item.' },
          igst: { type: SchemaType.NUMBER, description: 'IGST amount for this line item.' }
        },
        required: ['name', 'quantity', 'rate', 'amount']
      }
    },
    taxableAmount: { 
      type: SchemaType.NUMBER, 
      description: 'Total taxable amount before GST.' 
    },
    taxAmount: { 
      type: SchemaType.NUMBER, 
      description: 'Total GST tax amount.' 
    },
    totalAmount: { 
      type: SchemaType.NUMBER, 
      description: 'Grand total amount of the invoice.' 
    },
    gstType: { 
      type: SchemaType.STRING, 
      description: 'GST Treatment: "cgst-sgst" for intrastate (party GSTIN starting with 27 or same state) or "igst" for interstate.' 
    },
    notes: { 
      type: SchemaType.STRING, 
      description: 'Any narration, terms, or summary notes.' 
    }
  },
  required: ['partyName', 'invoiceNumber', 'date', 'taxableAmount', 'taxAmount', 'totalAmount', 'gstType']
};

export interface ExtractedInvoiceInfo {
  partyName: string;
  partyGstin?: string;
  invoiceNumber: string;
  date: string;
  items: Array<{
    name: string;
    hsn?: string;
    quantity: number;
    unit?: string;
    rate: number;
    amount: number;
    gst?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  }>;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType: 'cgst-sgst' | 'igst';
  notes?: string;
}

/**
 * Extracts structured invoice details from a PDF or image file buffer using Gemini Flash.
 */
export async function extractInvoiceDetails(buffer: Buffer, mimeType: string, docType: 'sales' | 'purchase' = 'purchase'): Promise<ExtractedInvoiceInfo> {
  const isPurchase = docType === 'purchase';

  const prompt = `You are a high-speed accounting parser. Extract invoice details from this ${docType.toUpperCase()} document and return strictly valid JSON matching this schema:
{
  "partyName": "${isPurchase ? 'Supplier / Vendor Name' : 'Buyer / Customer Name'}",
  "partyGstin": "GSTIN if present",
  "invoiceNumber": "Invoice/Bill Number",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "name": "Clean item name without serial prefix or batch lines",
      "hsn": "HSN code",
      "quantity": 1,
      "unit": "BAGS/PCS/KG/NOS",
      "rate": 100,
      "amount": 100,
      "gst": 18
    }
  ],
  "taxableAmount": 0,
  "taxAmount": 0,
  "totalAmount": 0,
  "gstType": "cgst-sgst" or "igst",
  "notes": "Optional notes"
}

Important Rules:
- If MT (Metric Ton) is listed but Bags (e.g. "(2140 Bags)") is in description, extract quantity as 2140 and unit as BAGS.
- Strip leading numbering like "1-", "2.", batch metadata like "Batch: Primary Batch".
- Format date as YYYY-MM-DD.
- Return ONLY valid JSON.`;

  const docPart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType: mimeType || 'application/pdf'
    }
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, docPart] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 65536,
        temperature: 0.1
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Empty response from model');
    }

    return parseGeminiJson<ExtractedInvoiceInfo>(responseText);
  } catch (error: any) {
    console.warn('Primary flash model failed, trying fallback...', error.message || error);
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const fallbackResult = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, docPart] }],
        generationConfig: { 
          responseMimeType: 'application/json',
          maxOutputTokens: 65536,
          temperature: 0.1
        }
      });
      return parseGeminiJson<ExtractedInvoiceInfo>(fallbackResult.response.text());
    } catch (fallbackError: any) {
      throw new Error(`Invoice parsing failed: ${fallbackError.message || error.message || error}`);
    }
  }
}

// Strict JSON schema constraints for bank statement details extraction
const bankStatementExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    bankName: {
      type: SchemaType.STRING,
      description: 'The identified Bank name from the statement header or logo (e.g. ICICI Bank, HDFC Bank, State Bank of India, Axis Bank, Kotak Mahindra Bank, Punjab National Bank, Bank of Baroda, Canara Bank, IndusInd Bank, Federal Bank, Yes Bank).'
    },
    accountType: {
      type: SchemaType.STRING,
      description: 'The type of bank account identified from the statement (e.g. "Savings Account", "Current Account", "Overdraft Account", "Cash Credit").'
    },
    accountNumber: {
      type: SchemaType.STRING,
      description: 'The bank account number shown on the statement (or masked account number like XXXX1234 if partially masked).'
    },
    ifsc: {
      type: SchemaType.STRING,
      description: 'The IFSC code if mentioned in the header.'
    },
    openingBalance: {
      type: SchemaType.NUMBER,
      description: 'Opening balance of the statement period if visible.'
    },
    closingBalance: {
      type: SchemaType.NUMBER,
      description: 'Closing balance of the statement period if visible.'
    },
    statementPeriod: {
      type: SchemaType.OBJECT,
      properties: {
        from: { type: SchemaType.STRING, description: 'Start date in YYYY-MM-DD format.' },
        to: { type: SchemaType.STRING, description: 'End date in YYYY-MM-DD format.' }
      }
    },
    transactions: {
      type: SchemaType.ARRAY,
      description: 'The list of transactions extracted from the bank statement.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: 'Transaction date in YYYY-MM-DD format.' },
          voucherType: { type: SchemaType.STRING, description: 'Type of voucher: Payment, Receipt, Contra, or Journal.' },
          partyName: { type: SchemaType.STRING, description: 'Name of the party/ledger extracted from the narration. E.g. NEFT ABC INDUSTRIES -> ABC INDUSTRIES. If not clear, set as null.' },
          partyLedger: { type: SchemaType.STRING, description: 'Suggested party ledger name or null.' },
          amount: { type: SchemaType.NUMBER, description: 'Voucher amount (debit amount if Payment, credit amount if Receipt).' },
          bankLedger: { type: SchemaType.STRING, description: 'Name of the bank account ledger (e.g. ICICI Bank, HDFC Bank, SBI Bank) matching the detected bankName.' },
          narration: { type: SchemaType.STRING, description: 'Cleaned transaction narration.' },
          referenceNumber: { type: SchemaType.STRING, description: 'Reference/UTR/Cheque number of transaction if available.' },
          confidence: { type: SchemaType.NUMBER, description: 'Confidence score from 0.0 to 1.0.' },
          reason: { type: SchemaType.STRING, description: 'Short reason for selecting this voucher type.' }
        },
        required: ['date', 'voucherType', 'amount', 'narration', 'confidence', 'reason']
      }
    }
  },
  required: ['bankName', 'transactions']
};

function normalizeDate(rawDate: any): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const d = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmy = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // DD-Mon-YYYY (e.g. 21-Apr-2026 or 21-Apr-26)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const dmon = d.match(/^(\d{1,2})[\/\-\.\s]+([A-Za-z]{3,9})[\/\-\.\s]+(\d{2,4})$/);
  if (dmon) {
    const day = dmon[1].padStart(2, '0');
    const mStr = dmon[2].substring(0, 3).toLowerCase();
    const month = monthMap[mStr] || '01';
    let year = dmon[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  return d;
}

function cleanAmount(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.\-]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function isHeaderOrSummaryRow(txn: any): boolean {
  if (!txn) return true;
  const narr = (txn.narration || '').toLowerCase().trim();
  const party = (txn.partyName || '').toLowerCase().trim();
  const combined = `${narr} ${party}`;
  
  if (
    combined.includes('opening balance') || 
    combined.includes('closing balance') ||
    combined.includes('brought forward') ||
    combined.includes('carried forward') ||
    combined.includes('b/f') ||
    combined.includes('c/f') ||
    combined.includes('total debits') ||
    combined.includes('total credits') ||
    combined.includes('statement summary')
  ) {
    return true;
  }
  return false;
}

export interface ExtractedBankTransaction {
  date: string;
  voucherType: 'Payment' | 'Receipt' | 'Contra' | 'Journal';
  partyName: string | null;
  partyLedger: string | null;
  amount: number;
  bankLedger: string | null;
  narration: string;
  referenceNumber: string | null;
  confidence: number;
  reason: string;
}

export interface ExtractedBankStatementInfo {
  bankName: string;
  accountType?: string;
  accountNumber?: string;
  ifsc?: string;
  openingBalance?: number;
  closingBalance?: number;
  statementPeriod?: {
    from?: string;
    to?: string;
  };
  transactions: ExtractedBankTransaction[];
}

/**
 * Extracts structured transaction details from a bank statement PDF/image using Gemini with multi-page precision.
 */
export async function extractBankStatementDetails(buffer: Buffer, mimeType: string): Promise<ExtractedBankStatementInfo> {
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf');
  let extractedText = '';
  if (isPdf) {
    try {
      extractedText = await extractTextFromPdf(buffer);
      console.log(`[Bank Statement] Extracted ${extractedText.length} characters of structured text from PDF.`);
    } catch (e: any) {
      console.warn('[Bank Statement] Text extraction warning:', e.message);
    }
  }

  // Model selection with fallback
  const callGeminiJson = async (prompt: string, maxTokens = 65536): Promise<any> => {
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
    let lastErr: any = null;

    for (const mName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: mName });
        const res = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: maxTokens,
            temperature: 0.1
          }
        });
        const text = res.response.text();
        if (text) {
          return parseGeminiJson<any>(text);
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Gemini] Model ${mName} attempt note:`, err.message || err);
        // Short pause if rate limit
        if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    throw lastErr || new Error('All Gemini models failed to generate response');
  };

  // If text extraction produced pages, process with multi-page precision
  if (extractedText && extractedText.length > 100) {
    const rawPages = extractedText.split('\f').map(p => p.trim()).filter(p => p.length > 30);
    const pages = rawPages.length > 0 ? rawPages : [extractedText];
    console.log(`[Bank Statement] Processing statement containing ${pages.length} page(s)...`);

    // Step 1: Extract Statement Header / Summary Info from Page 1 (or entire text)
    let headerInfo: any = {
      bankName: 'Bank Account',
      accountType: 'Current Account',
      accountNumber: '',
      ifsc: '',
      openingBalance: 0,
      closingBalance: 0,
      statementPeriod: null
    };

    try {
      const headerPrompt = `Analyze this bank statement text and extract the statement header information.
Return JSON with:
{
  "bankName": "Exact Bank Name (e.g. HDFC Bank, ICICI Bank, State Bank of India, Axis Bank, Kotak Mahindra Bank, Bank of Baroda, Punjab National Bank, Canara Bank, IndusInd Bank, Federal Bank)",
  "accountType": "Savings Account" or "Current Account" or "Overdraft Account" or "Cash Credit",
  "accountNumber": "Account Number or masked number",
  "ifsc": "IFSC code if present",
  "openingBalance": 0.0,
  "closingBalance": 0.0,
  "statementPeriod": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }
}

--- STATEMENT HEADER TEXT ---
${pages[0].slice(0, 3000)}`;

      const parsedHeader = await callGeminiJson(headerPrompt, 2048);
      headerInfo = { ...headerInfo, ...parsedHeader };
    } catch (headErr: any) {
      console.warn('[Bank Statement] Header extraction warning, continuing with defaults:', headErr.message);
    }

    const detectedBank = (headerInfo.bankName || 'Bank Account').trim();
    const detectedAccountType = (headerInfo.accountType || 'Current Account').trim();

    // Step 2: Chunk pages (up to 4 pages per batch) to maximize extraction speed & prevent quota exhaustion
    const CHUNK_SIZE = 4;
    const allTransactions: ExtractedBankTransaction[] = [];

    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      const chunkPages = pages.slice(i, i + CHUNK_SIZE);
      const pageRangeStr = `Pages ${i + 1} to ${i + chunkPages.length}`;
      const chunkText = chunkPages.map((p, idx) => `=== PAGE ${i + idx + 1} ===\n${p}`).join('\n\n');

      console.log(`[Bank Statement] Extracting transactions from ${pageRangeStr}...`);

      const pagePrompt = `You are an expert Indian bank statement table extractor.
Extract EVERY SINGLE transaction row present in the statement text below for ${pageRangeStr}.

CRITICAL INSTRUCTIONS:
1. DO NOT SKIP, OMIT, OR SUMMARIZE ANY TRANSACTION ROW. Every line in the table is an individual transaction.
2. For each transaction row:
   - "date": Date formatted as YYYY-MM-DD.
   - "voucherType":
       * Debited / Withdrawal / Dr -> "Payment"
       * Credited / Deposit / Cr -> "Receipt"
       * Cash Deposit / ATM Withdrawal / Self-Transfer -> "Contra"
       * Bank Charges / SMS Fees / GST on Fees -> "Payment"
       * Interest Credited -> "Receipt"
   - "partyName": Counter-party vendor/client/source extracted cleanly from narration (e.g. "UPI/123/RAMESH" -> "RAMESH", "NEFT-ABC CORP" -> "ABC CORP", "CHG: CONSOLIDATED CHARGES" -> "Bank Charges", "INT COLL" -> "Interest Received", "ATM WDL" -> "Cash"). If not identifiable, set null.
   - "amount": Transaction amount (positive number).
   - "narration": Full, clean transaction description.
   - "referenceNumber": UTR / Cheque / Ref / UPI transaction id if visible, otherwise null.
   - "confidence": 1.0.
   - "reason": Brief classification reason.

Return strictly a JSON array of objects matching this schema:
[
  {
    "date": "YYYY-MM-DD",
    "voucherType": "Payment" | "Receipt" | "Contra" | "Journal",
    "partyName": "Counterparty Name" | null,
    "amount": 1000.00,
    "narration": "Full narration text",
    "referenceNumber": "UTR/Ref/Cheque" | null,
    "confidence": 1.0,
    "reason": "Debit from vendor"
  }
]

--- ${pageRangeStr} STATEMENT TEXT ---
${chunkText}`;

      try {
        const txns = await callGeminiJson(pagePrompt, 65536);
        if (Array.isArray(txns)) {
          console.log(`[Bank Statement] Extracted ${txns.length} transactions from ${pageRangeStr}.`);
          for (const t of txns) {
            if (!t || isHeaderOrSummaryRow(t)) continue;
            const amt = cleanAmount(t.amount);
            if (amt <= 0) continue;

            const normD = normalizeDate(t.date);
            allTransactions.push({
              date: normD,
              voucherType: (t.voucherType || 'Payment') as any,
              partyName: t.partyName || null,
              partyLedger: t.partyLedger || null,
              amount: amt,
              bankLedger: detectedBank,
              narration: t.narration || '',
              referenceNumber: t.referenceNumber || null,
              confidence: Number(t.confidence) || 1.0,
              reason: t.reason || ''
            });
          }
        }
      } catch (err: any) {
        console.error(`[Bank Statement] Failed to extract from ${pageRangeStr}:`, err.message);
      }
    }

    console.log(`[Bank Statement] Total extracted transactions across ${pages.length} page(s): ${allTransactions.length}`);

    return {
      bankName: detectedBank,
      accountType: detectedAccountType,
      accountNumber: headerInfo.accountNumber || '',
      ifsc: headerInfo.ifsc || '',
      openingBalance: cleanAmount(headerInfo.openingBalance),
      closingBalance: cleanAmount(headerInfo.closingBalance),
      statementPeriod: headerInfo.statementPeriod || null,
      transactions: allTransactions
    };
  }

  // Fallback for scanned image PDF or binary file buffer
  console.log('[Bank Statement] Falling back to direct multimodal binary PDF parsing...');
  const baseInstructions = `You are an expert accountant with deep knowledge of Tally Prime and Indian banking systems.
Analyze this bank statement document and convert EVERY SINGLE transaction into structured banking data.

CRITICAL INSTRUCTIONS:
1. Extract EVERY single transaction row without skipping, omitting, or summarizing ANY row.
2. Extract the Bank Name, Account Type (Savings Account / Current Account / Overdraft Account), Account Number, IFSC, Opening Balance, Closing Balance, and Statement Period.
3. For each transaction:
   - "date": YYYY-MM-DD format.
   - "voucherType": Payment (withdrawals/debits), Receipt (deposits/credits), Contra (cash/transfers), or Journal.
   - "partyName": Counter-party / vendor / client / service name from narration.
   - "amount": Transaction amount (positive number).
   - "bankLedger": Identified bank name.
   - "narration": Full narration.
   - "referenceNumber": UTR / Cheque / UPI ID.
   - "confidence": 1.0.
   - "reason": Short reason.

Return strictly valid JSON following the schema.`;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: baseInstructions },
            { inlineData: { data: buffer.toString('base64'), mimeType: mimeType || 'application/pdf' } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: bankStatementExtractionSchema as any,
        maxOutputTokens: 65536,
        temperature: 0.1
      }
    });

    const responseText = result.response.text();
    if (!responseText) throw new Error('Gemini returned empty content.');

    const parsed = parseGeminiJson<ExtractedBankStatementInfo>(responseText);
    const cleanedTxns = (parsed.transactions || [])
      .filter(t => !isHeaderOrSummaryRow(t) && cleanAmount(t.amount) > 0)
      .map(t => ({
        ...t,
        date: normalizeDate(t.date),
        amount: cleanAmount(t.amount),
        bankLedger: (t.bankLedger || parsed.bankName || 'Bank Account').trim()
      }));

    return {
      ...parsed,
      accountType: parsed.accountType || 'Current Account',
      openingBalance: cleanAmount(parsed.openingBalance),
      closingBalance: cleanAmount(parsed.closingBalance),
      transactions: cleanedTxns
    };
  } catch (fallbackError: any) {
    console.error('Multimodal extraction error:', fallbackError);
    throw new Error(`Bank statement extraction failed: ${fallbackError.message || fallbackError}`);
  }
}



