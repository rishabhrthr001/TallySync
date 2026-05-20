import pdfParse from 'pdf-parse';
import fs from 'fs';

async function test() {
  try {
    const buffer = fs.readFileSync('test.pdf');
    const data = await pdfParse(buffer);
    console.log('Parsed text:', data.text.substring(0, 100));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
