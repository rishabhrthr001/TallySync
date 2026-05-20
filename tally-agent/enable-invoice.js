const axios = require('axios');

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
                    <VOUCHERTYPE NAME="Sales" ACTION="Alter">
                        <NAME>Sales</NAME>
                        <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
                        <ISINVOICE>Yes</ISINVOICE>
                        <NUMBERINGMETHOD>Manual</NUMBERINGMETHOD>
                        <USEFORPOSINVOICE>No</USEFORPOSINVOICE>
                    </VOUCHERTYPE>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

async function fix() {
    try {
        console.log('[CONFIG] Enabling Inventory mode for "Sales" voucher type...');
        const res = await axios.post('http://127.0.0.1:9000', xml, {
            headers: { 'Content-Type': 'text/xml' }
        });
        console.log('[TALLY RESPONSE]\n', res.data);
        if (res.data.includes('<ALTERED>1</ALTERED>') || res.data.includes('<CREATED>1</CREATED>')) {
            console.log('\n✅ SUCCESS: Sales voucher type now supports Inventory!');
        } else {
            console.warn('\n⚠️ WARNING: Could not alter voucher type. Check if "Nikhil" is open.');
        }
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

fix();
