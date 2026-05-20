const axios = require('axios');

const CONFIG = {
    BACKEND_URL: 'https://tallysync-backend-1020363630918.asia-south1.run.app',
    EMAIL: 'pankaj@tallySync.com',
    PASSWORD: 'pankaj@9999',
};

async function retry() {
    try {
        const loginRes = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
            email: CONFIG.EMAIL,
            password: CONFIG.PASSWORD
        });
        const token = loginRes.data.token;

        const entriesRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const target = entriesRes.data.find(e => e.invoiceNumber === 'INV-9117' && e.companyName === 'Nikhil');
        if (target) {
            console.log(`Retrying entry ${target._id} (INV-9117)...`);
            await axios.post(`${CONFIG.BACKEND_URL}/api/entries/${target._id}/retry`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Retry queued successfully.');
        } else {
            console.log('Entry INV-9117 for Nikhil not found.');
        }
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}

retry();
