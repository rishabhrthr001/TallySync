import { LiteParse } from '@llamaindex/liteparse';
import fs from 'fs';

async function test() {
  try {
    const buffer = fs.readFileSync('test.pdf');
    const parser = new LiteParse({ ocrEnabled: true });
    const data = await parser.parse(buffer);
    console.log('Parsed text:', data.text.substring(0, 100));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
