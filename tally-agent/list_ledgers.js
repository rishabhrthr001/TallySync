const axios = require('axios');

async function listLedgers() {
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
        console.log('[TALLY LEDGERS]');
        const matches = res.data.match(/<NAME.LIST>([\s\S]*?)<\/NAME.LIST>/g) || [];
        matches.forEach(m => {
            const name = m.replace(/<\/?NAME.LIST>/g, '').replace(/<\/?NAME.*?>/g, '').trim();
            if (name.toLowerCase().includes('purch') || name.toLowerCase().includes('sale')) {
                console.log(' -', name);
            }
        });
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

listLedgers();
