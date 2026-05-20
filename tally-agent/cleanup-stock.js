const axios = require('axios');
const TALLY_URL = 'http://127.0.0.1:9000';

async function run() {
    console.log('Fetching stock items...');
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Stock Item</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        const res = await axios.post(TALLY_URL, xml);
        const data = res.data;
        
        // Match both <NAME> and <NAME.LIST>
        const items = [];
        const matches = data.matchAll(/<NAME>(.*?)<\/NAME>/g);
        for (const m of matches) {
            items.push(m[1]);
        }
        
        console.log(`Found ${items.length} items.`);
        console.log('Items:', items);
        
        const toDelete = items.filter(name => {
            const n = name.toLowerCase();
            return n !== 'software services' && n !== 'software service';
        });
        
        console.log(`Deleting ${toDelete.length} items...`);
        
        for (const name of toDelete) {
            const delXml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY><IMPORTDATA>
        <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
        <REQUESTDATA>
            <TALLYMESSAGE>
                <STOCKITEM NAME="${name}" ACTION="Delete"></STOCKITEM>
            </TALLYMESSAGE>
        </REQUESTDATA>
    </IMPORTDATA></BODY>
</ENVELOPE>`;
            try {
                const delRes = await axios.post(TALLY_URL, delXml);
                if (delRes.data.includes('<DELETED>1</DELETED>')) {
                    console.log(`  ✅ Deleted: ${name}`);
                } else {
                    console.log(`  ❌ Skip: ${name}`);
                }
            } catch (err) {
                console.log(`  ❌ Error: ${name} - ${err.message}`);
            }
        }
    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
}

run();
