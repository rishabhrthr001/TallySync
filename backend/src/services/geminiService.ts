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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, docPart] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Empty response from model');
    }

    return parseGeminiJson<ExtractedInvoiceInfo>(responseText);
  } catch (error: any) {
    console.warn('Fast flash model failed, trying fallback...', error.message || error);
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      const fallbackResult = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, docPart] }],
        generationConfig: { responseMimeType: 'application/json' }
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
 * Extracts structured transaction details from a bank statement PDF/image using Gemini.
 */
export async function extractBankStatementDetails(buffer: Buffer, mimeType: string, selectedBank?: string): Promise<ExtractedBankStatementInfo> {
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

  let bankHint = '';
  if (selectedBank) {
    bankHint = `\nThe user has explicitly stated this is a statement from **${selectedBank}**. Use this as the exact Bank Name unless contradicted.`;
  }

  const baseInstructions = `You are an expert accountant with deep knowledge of Tally Prime, Indian banking systems, and bank statement reconciliation.
Analyze this bank statement and convert it into structured banking data for Tally accounting.${bankHint}

STEP 1: IDENTIFY THE BANK & ACCOUNT
- Identify the exact BANK NAME from the header, logo, or branch details (e.g., "ICICI Bank", "HDFC Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank", "Bank of Baroda", "Punjab National Bank", "Canara Bank", "IndusInd Bank", "Federal Bank").
- Extract the Account Number, IFSC, Statement Period (from & to dates in YYYY-MM-DD), Opening Balance, and Closing Balance.

STEP 2: EXTRACT EVERY TRANSACTION
- Extract EVERY single row in the statement. DO NOT SKIP ANY TRANSACTIONS.
- For each transaction:
  1. date: YYYY-MM-DD format.
  2. Determine voucherType:
     * Money withdrawn / debited (DR) -> "Payment" (unless transfer to own cash/bank -> "Contra")
     * Money deposited / credited (CR) -> "Receipt" (unless transfer from own cash/bank -> "Contra")
     * Cash deposit or Cash withdrawal -> "Contra"
     * Bank charges, SMS fees, interest -> "Payment" or "Journal"
  3. partyName: Extract clean counter-party / vendor / client / service name from the narration.
     * Example: "UPI/412398471/RAVI TRADERS" -> "RAVI TRADERS"
     * Example: "NEFT-N102938-TECH SOLUTIONS" -> "TECH SOLUTIONS"
     * Example: "CHG/CONSOLIDATED CHARGES" -> "Bank Charges"
     * Example: "INT COLL" -> "Interest Received"
     * Example: "ATM WDL" -> "Cash"
  4. bankLedger: Set this to the identified Bank Name (e.g. "ICICI Bank" or "HDFC Bank").
  5. amount: Transaction amount (positive number).
  6. referenceNumber: UTR / Cheque / Ref / UPI txn id if available.
  7. narration: Complete clean narration for Tally voucher narration.
  8. confidence: 0.0 to 1.0.
  9. reason: Short explanation.

Return strictly valid JSON following the schema.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    let contentsParts: any[] = [];
    if (extractedText.length > 100) {
      contentsParts = [
        { text: `${baseInstructions}\n\n--- BANK STATEMENT TEXT CONTENT ---\n${extractedText}` }
      ];
    } else {
      contentsParts = [
        { text: baseInstructions },
        { inlineData: { data: buffer.toString('base64'), mimeType: mimeType || 'application/pdf' } }
      ];
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: contentsParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: bankStatementExtractionSchema as any
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Gemini returned empty content.');
    }

    return parseGeminiJson<ExtractedBankStatementInfo>(responseText);
  } catch (error: any) {
    console.error('Gemini bank statement extraction error:', error.message || error);
    try {
      console.log('Retrying bank statement extraction with gemini-3.1-flash-lite fallback...');
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
      
      let fallbackParts: any[] = [];
      if (extractedText.length > 100) {
        fallbackParts = [
          { text: `Extract bankName, accountNumber, openingBalance, closingBalance, statementPeriod, and all transactions as JSON with date (YYYY-MM-DD), voucherType (Payment/Receipt/Contra/Journal), partyName, amount, bankLedger, narration, referenceNumber, confidence, reason from this text:\n\n${extractedText}` }
        ];
      } else {
        fallbackParts = [
          { text: `Extract bankName, accountNumber, openingBalance, closingBalance, statementPeriod, and all transactions as JSON with date (YYYY-MM-DD), voucherType (Payment/Receipt/Contra/Journal), partyName, amount, bankLedger, narration, referenceNumber, confidence, reason.` },
          { inlineData: { data: buffer.toString('base64'), mimeType: mimeType || 'application/pdf' } }
        ];
      }

      const fallbackResult = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: fallbackParts }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      return parseGeminiJson<ExtractedBankStatementInfo>(fallbackResult.response.text());
    } catch (fallbackError: any) {
      throw new Error(`Gemini bank statement extraction failed: ${fallbackError.message || error.message || error}`);
    }
  }
}



