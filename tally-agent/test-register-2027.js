const axios = require('axios');

async function createBillForNikhil() {
    const backendUrl = 'https://tallysync-backend-1020363630918.asia-south1.run.app';

    try {
        console.log('Logging in to get token...');
        const newLoginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: 'nikhil1714702000000@test.com', // Let's just create a new one to be sure
            password: 'password123'
        }).catch(async () => {
            const adminLoginRes = await axios.post(`${backendUrl}/api/auth/login`, {
                email: 'pankaj@tallySync.com',
                password: 'pankaj@9999'
            });
            const email = 'nikhil' + Date.now() + '@test.com';
            await axios.post(`${backendUrl}/api/auth/signup`, {
                name: 'Nikhil Test', email: email, password: 'password123', companyName: 'Nikhil'
            }, { headers: { Authorization: `Bearer ${adminLoginRes.data.token}` } });
            
            return axios.post(`${backendUrl}/api/auth/login`, { email, password: 'password123' });
        });

        const token = newLoginRes.data.token;
        const r = Math.floor(Math.random() * 10000);
        const billData = {
            type: 'sales',
            partyName: 'Tech Innovations ' + r,
            partyGstin: '27AADCB2230M1Z2', 
            invoiceNumber: 'INV-TEST-NIKHIL-2027-' + r,
            date: '2027-05-03', // HARDCODED 2027!
            items: [
                { name: 'Software Services', quantity: 1, rate: 5000, gst: 18, amount: 5000 }
            ],
            taxableAmount: 5000,
            taxAmount: 900,
            totalAmount: 5900,
            notes: 'Test bill for Tally Sync',
            idempotencyKey: 'TEST-NIKHIL-2027-' + Date.now()
        };

        console.log('Creating bill with date 2027-05-03...');
        const entryRes = await axios.post(`${backendUrl}/api/entries`, billData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Bill created successfully for company Nikhil!', entryRes.data.invoiceNumber);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

createBillForNikhil();
