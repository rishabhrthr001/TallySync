const axios = require('axios');

async function retryFailed() {
    try {
        const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const token = loginRes.data.token;
        const res = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const failed = res.data.filter(e => e.status === 'failed' && e.companyName === 'Nikhil');
        console.log(`Found ${failed.length} failed entries for Nikhil.`);
        for (const f of failed) {
            await axios.post(`https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries/${f._id}/retry`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`Retried ${f.invoiceNumber}`);
        }
    } catch (e) {
        console.error(e.message);
    }
}
retryFailed();
