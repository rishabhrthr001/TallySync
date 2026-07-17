import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const productExtractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    productName: { 
      type: SchemaType.STRING, 
      description: 'The identified name of the product.' 
    },
    brand: { 
      type: SchemaType.STRING, 
      description: 'The brand name of the product.' 
    },
    category: { 
      type: SchemaType.STRING, 
      description: 'General category classification.' 
    }
  },
  required: ['productName', 'brand', 'category']
};

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        console.log('Sending structured request to gemini-2.5-flash...');
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Identify the product: "Apple iPhone 14 Pro Max 256GB Space Gray"' }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: productExtractionSchema
            }
        });

        console.log('✅ Success! Response:', result.response.text());
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

test();
