const axios = require('axios');
async function checkAllDates() {
    try {
        const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const queue = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries/sync-queue', {
            headers: { Authorization: `Bearer ${loginRes.data.token}` }
        });
        queue.data.forEach(e => {
            console.log(`Invoice: ${e.invoiceNumber}, Date: ${e.date}, Party: ${e.partyName}`);
        });
    } catch (e) {
        console.error(e.message);
    }
}
checkAllDates();
