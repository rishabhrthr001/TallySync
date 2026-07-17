const axios = require('axios');

async function getUsers() {
    const backendUrl = 'https://tallysync-backend-1020363630918.asia-south1.run.app';
    try {
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const token = loginRes.data.token;

        const usersRes = await axios.get(`${backendUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Current Admin User:', usersRes.data);
        
        // Since there's no "get all users" endpoint exposed easily, let's look at entries to see company users
        const entriesRes = await axios.get(`${backendUrl}/api/entries`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const companies = [...new Set(entriesRes.data.map(e => e.companyName))];
        console.log('Companies in DB:', companies);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
getUsers();
