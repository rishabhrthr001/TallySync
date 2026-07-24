import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Google Gen AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

/**
 * Extracts structured product details from a base64 encoded image using Gemini Vision.
 */
export async function extractProductDetails(base64Image: string): Promise<ExtractedProductInfo> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
  required: ['partyName', 'invoiceNumber', 'date', 'items', 'taxableAmount', 'taxAmount', 'totalAmount', 'gstType']
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
 * Extracts structured invoice details from a PDF or image file buffer using Gemini 1.5 Pro.
 */
export async function extractInvoiceDetails(buffer: Buffer, mimeType: string, docType: 'sales' | 'purchase' = 'purchase'): Promise<ExtractedInvoiceInfo> {
  try {
    // Upgrade model to gemini-1.5-pro for high precision OCR & reasoning
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const docPart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const isPurchase = docType === 'purchase';

    const prompt = `You are an expert accounting document parser extracting structured JSON data from an invoice PDF/image.

DOCUMENT TYPE FOR PARSING: "${docType.toUpperCase()} BILL"

PARTY EXTRACTION INSTRUCTIONS:
- This document is being processed as a ${docType.toUpperCase()} BILL.
${isPurchase ? `- Because this is a PURCHASE BILL:
  * The "partyName" MUST BE THE SUPPLIER / VENDOR / SELLER / ISSUER (found under sections like "Supplier", "Vendor", "From", "Billed From", "Messrs").
  * Example: If Supplier is "JJMBSS 2025-26" and Buyer is "BHARAT ENTERPRISES", partyName MUST BE "JJMBSS 2025-26".
  * The "partyGstin" MUST BE THE SUPPLIER'S / VENDOR'S GSTIN. DO NOT extract the buyer's GSTIN.` : `- Because this is a SALES BILL:
  * The "partyName" MUST BE THE BUYER / CUSTOMER / CONSIGNEE (found under sections like "Buyer", "Billed To", "Customer", "Ship To", "Consignee").
  * The "partyGstin" MUST BE THE BUYER'S / CUSTOMER'S GSTIN. DO NOT extract our seller GSTIN.`}

ITEM EXTRACTION INSTRUCTIONS:
- For each item line in the table:
  * Extract a CLEAN, INTELLIGENT item name.
  * STRIP OUT: leading serial numbers or index prefixes like "1-", "2.", batch metadata lines (e.g. "Batch : Primary Batch", "Batch No", "Exp Date"), serial numbers, and table formatting artifacts.
  * PRESERVE: product variants, brand, weight/pack size (e.g. "UREA NEEM IFFCO 45 KG" or "DAP IFFCO 50 KG").
  * Extract HSN code, Quantity, Unit (e.g., PCS, BAG, KG), Rate, Line Taxable Amount, GST%, CGST, SGST, and IGST if visible.

GENERAL INSTRUCTIONS:
- Format date as YYYY-MM-DD.
- If party GSTIN is present and does not start with state code '27', set gstType to 'igst'. Otherwise, default to 'cgst-sgst'.`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            docPart
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: invoiceExtractionSchema as any
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Gemini 1.5 Pro returned empty content.');
    }

    return JSON.parse(responseText) as ExtractedInvoiceInfo;
  } catch (error: any) {
    console.error('Gemini invoice extraction error:', error);
    // Fallback to gemini-2.5-flash if 1.5-pro hits any unexpected issue
    try {
      console.log('Retrying with gemini-2.5-flash fallback...');
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const docPart = { inlineData: { data: buffer.toString('base64'), mimeType } };
      const fallbackPrompt = `Extract invoice details as JSON. Document type: ${docType}. Extract partyName (${docType === 'purchase' ? 'Supplier/Vendor' : 'Buyer/Customer'}), partyGstin, invoiceNumber, date (YYYY-MM-DD), items (clean name without batch lines), taxableAmount, taxAmount, totalAmount, gstType.`;
      const fallbackResult = await fallbackModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: fallbackPrompt }, docPart] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: invoiceExtractionSchema as any }
      });
      return JSON.parse(fallbackResult.response.text()) as ExtractedInvoiceInfo;
    } catch (fallbackError: any) {
      throw new Error(`Gemini invoice extraction failed: ${error.message || error}`);
    }
  }
}


