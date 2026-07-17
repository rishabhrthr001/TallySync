const axios = require('axios');

async function createNikhilUser() {
    const backendUrl = 'https://tallysync-backend-1020363630918.asia-south1.run.app';
    try {
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, {
            email: 'pankaj@tallySync.com',
            password: 'pankaj@9999'
        });
        const adminToken = loginRes.data.token;

        await axios.post(`${backendUrl}/api/auth/signup`, {
            name: 'Nikhil',
            email: 'nikhil@test.com',
            password: 'nikhil123',
            companyName: 'Nikhil'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });

        console.log('User nikhil@test.com created with password nikhil123');
    } catch (err) {
        console.log('User probably already exists or:', err.response ? err.response.data : err.message);
    }
}
createNikhilUser();
