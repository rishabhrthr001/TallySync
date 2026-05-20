const axios = require('axios');
const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999'
};

async function reset() {
    const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
        email: CONFIG.EMAIL,
        password: CONFIG.PASSWORD
    });
    const token = loginRes.data.token;
    
    const entriesRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const target = entriesRes.data.filter(e => e.invoiceNumber.includes('INV-2027'));
    
    for (const e of target) {
        await axios.patch(`${CONFIG.BACKEND_URL}/api/entries/${e._id}/sync-status`,
            { status: 'pending', error: '' },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        console.log(`Reset ${e.invoiceNumber}`);
    }
}

reset();
