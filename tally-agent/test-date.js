const axios = require('axios');

async function checkDate() {
    try {
        const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const token = loginRes.data.token;
        const res = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries/sync-queue', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Sample entry date:', res.data[0].date);
        console.log('Formatted dateStr:', res.data[0].date.replace(/-/g, ''));
    } catch (e) {
        console.error(e.message);
    }
}
checkDate();
