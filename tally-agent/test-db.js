const axios = require('axios');
async function checkAll() {
    const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', {
        email: 'pankaj@tallySync.com',
        password: 'pankaj@9999'
    });
    const queue = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    const nikhil = queue.data.filter(e => e.companyName === 'Nikhil');
    nikhil.forEach(e => {
        console.log(`Invoice: ${e.invoiceNumber}, Company: ${e.companyName}, Status: ${e.status}`);
    });
}
checkAll();
