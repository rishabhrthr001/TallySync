import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const bankStatementExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    bankName: {
      type: SchemaType.STRING,
      description: 'The bank name.'
    },
    transactions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          voucherType: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
          narration: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING }
        },
        required: ['date', 'voucherType', 'amount', 'narration', 'confidence', 'reason']
      }
    }
  },
  required: ['bankName', 'transactions']
};

async function run() {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const text = "2026-07-17 UPI/412398471/ABHISHEK KUMAR MAHTO Deposit 10000.00 Balance 10000.00";

  console.log("Calling gemini-3.6-flash...");
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: bankStatementExtractionSchema
      }
    });
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Error calling gemini-3.6-flash:", err);
  }
}

run();
