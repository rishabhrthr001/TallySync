import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function test() {
    try {
        console.log('Testing with API Key:', process.env.GEMINI_API_KEY ? 'Present (ending in ' + process.env.GEMINI_API_KEY.slice(-5) + ')' : 'Missing');
        
        // List models
        // In @google/generative-ai, listing models is done via a different method or via REST.
        // Let's try calling a few model names to see which ones succeed, or use listModels.
        const modelNames = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-2.0-flash',
            'gemini-2.0-flash-exp',
            'gemini-2.5-flash'
        ];

        for (const name of modelNames) {
            try {
                const model = genAI.getGenerativeModel({ model: name });
                const result = await model.generateContent('Hi');
                console.log(`✅ Model "${name}" is available! Response:`, result.response.text().trim());
            } catch (err: any) {
                console.log(`❌ Model "${name}" failed:`, err.message);
            }
        }
    } catch (err: any) {
        console.error('Fatal error:', err);
    }
}

test();
