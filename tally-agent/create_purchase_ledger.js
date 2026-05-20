const axios = require('axios');

async function createPurchaseLedger() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <LEDGER NAME="Purchase Accounts" ACTION="Create">
                        <NAME>Purchase Accounts</NAME>
                        <PARENT>Purchase Accounts</PARENT>
                        <ISGSTENABLED>Yes</ISGSTENABLED>
                    </LEDGER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        console.log('[CONFIG] Creating "Purchase Accounts" ledger in Tally...');
        const res = await axios.post('http://127.0.0.1:9000', xml, {
            headers: { 'Content-Type': 'text/xml' }
        });
        console.log('[TALLY RESPONSE]\n', res.data);
        if (res.data.includes('<CREATED>1</CREATED>') || res.data.includes('<ALTERED>1</ALTERED>')) {
            console.log('\n✅ SUCCESS: "Purchase Accounts" ledger created successfully!');
        } else {
            console.warn('\n⚠️ WARNING: Could not create ledger. Check Tally response.');
        }
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

createPurchaseLedger();
