const axios = require('axios');

const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999',
};

async function trigger() {
    try {
        const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
            email: CONFIG.EMAIL,
            password: CONFIG.PASSWORD
        });
        const token = loginRes.data.token;

        const entry = {
            type: 'sales',
            partyName: 'Cash',
            invoiceNumber: 'TEST-' + Date.now().toString().slice(-4),
            date: '2026-05-01',
            items: [{ name: 'Software Services', quantity: 1, rate: 1000, amount: 1000 }],
            taxableAmount: 1000,
            taxAmount: 180,
            totalAmount: 1180,
            companyName: 'Nikhil'
        };

        console.log('Creating test entry for Nikhil...');
        const res = await axios.post(`${CONFIG.BACKEND_URL}/api/entries`, entry, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Created:', res.data._id);
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}

trigger();
