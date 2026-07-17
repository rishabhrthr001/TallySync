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
      description: 'The name of the party / customer / seller / company. Prefer the supplier/vendor name if it is a purchase bill, or buyer/customer if sales.' 
    },
    partyGstin: { 
      type: SchemaType.STRING, 
      description: 'The 15-character GSTIN (GST registration number) of the party.' 
    },
    invoiceNumber: { 
      type: SchemaType.STRING, 
      description: 'The invoice number or bill number reference.' 
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
          name: { type: SchemaType.STRING, description: 'Item name or description.' },
          quantity: { type: SchemaType.NUMBER, description: 'Quantity of the item.' },
          rate: { type: SchemaType.NUMBER, description: 'Rate or unit price.' },
          amount: { type: SchemaType.NUMBER, description: 'Total line amount (quantity * rate).' }
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
      description: 'Total tax amount (CGST+SGST or IGST).' 
    },
    totalAmount: { 
      type: SchemaType.NUMBER, 
      description: 'Grand total amount of the invoice.' 
    },
    gstType: { 
      type: SchemaType.STRING, 
      description: 'GST Treatment: "cgst-sgst" for intrastate (e.g. party GSTIN starting with 27 for Maharashtra) or "igst" for interstate.' 
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
    quantity: number;
    rate: number;
    amount: number;
  }>;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType: 'cgst-sgst' | 'igst';
  notes?: string;
}

/**
 * Extracts structured invoice details from a PDF or image file buffer using Gemini.
 */
export async function extractInvoiceDetails(buffer: Buffer, mimeType: string): Promise<ExtractedInvoiceInfo> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const docPart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const prompt = `Extract all details from this invoice or bill.
Identify the party name (prefer the seller/vendor name if it's an inbound purchase bill/expense, otherwise customer/buyer), party GSTIN, invoice number, invoice date, and the table of line items.
Format the output as structured JSON. Convert the date to YYYY-MM-DD.
If GSTIN is present and doesn't start with '27', set gstType to 'igst'. Otherwise, default to 'cgst-sgst'.`;

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
      throw new Error('Gemini returned empty content.');
    }

    return JSON.parse(responseText) as ExtractedInvoiceInfo;
  } catch (error: any) {
    console.error('Gemini invoice extraction error:', error);
    throw new Error(`Gemini invoice extraction failed: ${error.message || error}`);
  }
}

