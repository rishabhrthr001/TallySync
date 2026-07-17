const axios = require('axios');
async function retry() {
    const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', {
        email: 'pankaj@tallySync.com',
        password: 'pankaj@9999'
    });
    const queue = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    const failed = queue.data.filter(e => e.status === 'failed' && e.companyName === 'Nikhil');
    for (const f of failed) {
        await axios.patch(`https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries/${f._id}/status`, { status: 'pending' }, {
            headers: { Authorization: `Bearer ${loginRes.data.token}` }
        });
        console.log(`Patched ${f.invoiceNumber}`);
    }
}
retry();
