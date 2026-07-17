const axios = require('axios');

async function checkActiveCompany() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Company</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        const res = await axios.post('http://127.0.0.1:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log('[TALLY ACTIVE COMPANY RESPONSE]\n', res.data.substring(0, 1000));
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

checkActiveCompany();
