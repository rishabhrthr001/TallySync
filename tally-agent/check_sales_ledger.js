const axios = require('axios');

async function checkSalesLedger() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Ledger</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        const res = await axios.post('http://127.0.0.1:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        const data = res.data;
        
        const hasSales = data.includes('Sales Accounts');
        console.log('[CHECK] Ledger "Sales Accounts" exists:', hasSales);
        
        if (!hasSales) {
            console.log('[FIX] Creating "Sales Accounts" ledger...');
            const createXml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE>
                    <LEDGER NAME="Sales Accounts" ACTION="Create">
                        <NAME>Sales Accounts</NAME>
                        <PARENT>Sales Accounts</PARENT>
                        <ISGSTENABLED>Yes</ISGSTENABLED>
                    </LEDGER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
            const createRes = await axios.post('http://127.0.0.1:9000', createXml, { headers: { 'Content-Type': 'text/xml' } });
            console.log('[FIX] Create response:', createRes.data);
        }
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

checkSalesLedger();
