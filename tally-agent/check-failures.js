const axios = require('axios');

const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999',
};

async function check() {
    try {
        const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
            email: CONFIG.EMAIL,
            password: CONFIG.PASSWORD
        });
        const token = loginRes.data.token;

        const entriesRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const failed = entriesRes.data.filter(e => e.status === 'failed');
        console.log(`\nFound ${failed.length} failed entries:`);
        failed.forEach(e => {
            console.log(`- ID: ${e._id}`);
            console.log(`  Invoice: ${e.invoiceNumber}`);
            console.log(`  Company: ${e.companyName}`);
            console.log(`  Error: ${e.syncError}`);
            console.log('-------------------');
        });
    } catch (err) {
        console.error(err.message);
    }
}

check();
