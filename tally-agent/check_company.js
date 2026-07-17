
const axios = require('axios');
const xml = `
<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>List of Accounts</REPORTNAME>
    <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <ACCOUNTTYPE>Company</ACCOUNTTYPE>
    </STATICVARIABLES>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => {
        console.log('Response:', r.data);
    })
    .catch(e => console.error(e.message));
