const axios = require('axios');

const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999',
};

async function retryAll() {
    try {
        const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
            email: CONFIG.EMAIL,
            password: CONFIG.PASSWORD
        });
        const token = loginRes.data.token;

        const entriesRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Let's retry all entries for the 'Nikhil' company
        const targets = entriesRes.data.filter(e => e.companyName === 'Nikhil');
        console.log(`Found ${targets.length} entries for Nikhil.`);
        
        for (const target of targets) {
            console.log(`Retrying entry ${target.invoiceNumber}...`);
            await axios.post(`${CONFIG.BACKEND_URL}/api/entries/${target._id}/retry`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
        console.log('Retry queued successfully for all Nikhil entries.');
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}

retryAll();
