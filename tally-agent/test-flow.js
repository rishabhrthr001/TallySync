const axios = require('axios');

async function testFlow() {
    const backendUrl = 'https://tallysync-backend-1020363630918.asia-south1.run.app';
    console.log(`Connecting to ${backendUrl}...`);

    try {
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const token = loginRes.data.token;
        console.log('Login successful. Token acquired.');

        const r = Math.floor(Math.random() * 10000);
        const billData = {
            type: 'sales',
            partyName: 'Tech Innovations ' + r,
            partyGstin: '27AADCB2230M1Z2', // Valid GSTIN format
            invoiceNumber: 'INV-TEST-' + r,
            date: new Date().toISOString().split('T')[0],
            items: [
                { name: 'Software Services', quantity: 1, rate: 10000, gst: 18, amount: 10000 }
            ],
            taxableAmount: 10000,
            taxAmount: 1800,
            totalAmount: 11800,
            notes: 'Test bill for Tally Sync',
            idempotencyKey: 'TEST-' + Date.now()
        };

        const entryRes = await axios.post(`${backendUrl}/api/entries`, billData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Bill created successfully!', entryRes.data.invoiceNumber);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

testFlow();
