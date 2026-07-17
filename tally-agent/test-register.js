const axios = require('axios');

async function createBillForNikhil() {
    const backendUrl = 'https://tallysync-backend-1020363630918.asia-south1.run.app';
    const email = 'nikhil' + Date.now() + '@test.com';

    try {
        console.log('Logging in as admin to create user...');
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const adminToken = loginRes.data.token;

        console.log('Registering user with company "Nikhil"...');
        const regRes = await axios.post(`${backendUrl}/api/auth/signup`, {
            name: 'Nikhil Test',
            email: email,
            password: 'password123',
            companyName: 'Nikhil'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log('Registered successfully.');

        // Login as new user
        const newLoginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: email,
            password: 'password123'
        });
        const token = newLoginRes.data.token;

        const r = Math.floor(Math.random() * 10000);
        const billData = {
            type: 'sales',
            partyName: 'Tech Innovations ' + r,
            partyGstin: '27AADCB2230M1Z2', 
            invoiceNumber: 'INV-TEST-NIKHIL-' + r,
            date: new Date().toISOString().split('T')[0],
            items: [
                { name: 'Software Services', quantity: 1, rate: 5000, gst: 18, amount: 5000 }
            ],
            taxableAmount: 5000,
            taxAmount: 900,
            totalAmount: 5900,
            notes: 'Test bill for Tally Sync',
            idempotencyKey: 'TEST-NIKHIL-' + Date.now()
        };

        console.log('Creating bill...');
        const entryRes = await axios.post(`${backendUrl}/api/entries`, billData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Bill created successfully for company Nikhil!', entryRes.data.invoiceNumber);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

createBillForNikhil();
