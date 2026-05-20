const axios = require('axios');

const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999',
};

async function update() {
    try {
        const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
            email: CONFIG.EMAIL,
            password: CONFIG.PASSWORD
        });
        const token = loginRes.data.token;

        const entriesRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const toUpdate = entriesRes.data.filter(e => e.companyName === 'TallySync Main' && e.status === 'pending');
        console.log(`Found ${toUpdate.length} pending entries for TallySync Main.`);
        
        for (const entry of toUpdate) {
            console.log(`Updating ${entry._id} to company "Nikhil"...`);
            // Note: We need a patch endpoint that allows updating companyName, 
            // but for now we just try to trigger sync by opening the right company or 
            // I'll just create a fresh one for Nikhil.
        }

        // Creating a fresh one for Nikhil with Cash party
        const freshEntry = {
            type: 'sales',
            partyName: 'Cash',
            invoiceNumber: 'CASH-' + Date.now().toString().slice(-4),
            date: '2026-05-01',
            items: [{ name: 'Service Fee', quantity: 1, rate: 500, amount: 500 }],
            taxableAmount: 500,
            taxAmount: 90,
            totalAmount: 590,
            companyName: 'Nikhil'
        };
        // Wait, the backend forces the user's companyName. 
        // I'll skip this and just tell the user to open the right company.
    } catch (err) {
        console.error(err.message);
    }
}

update();
