
const axios = require('axios');
const xml = `
<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>Ledger</REPORTNAME>
    <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
        <LEDGERNAME>Golu</LEDGERNAME>
    </STATICVARIABLES>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => {
        console.log('Response:', r.data.substring(0, 5000));
    })
    .catch(e => console.error(e.message));
