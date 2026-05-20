
const axios = require('axios');
const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Accounts</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><ACCOUNTTYPE>Company</ACCOUNTTYPE></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

async function probe() {
    const ports = [9000, 9001, 9999, 10000];
    for (const port of ports) {
        try {
            console.log(`Probing port ${port}...`);
            const res = await axios.post(`http://127.0.0.1:${port}`, xml, { timeout: 2000 });
            console.log(`✅ FOUND TALLY ON PORT ${port}!`);
            console.log('Response snippet:', res.data.substring(0, 100));
            return;
        } catch (e) {
            console.log(`❌ Port ${port} failed: ${e.message}`);
        }
    }
    console.log('Could not find Tally on any standard port.');
}

probe();
