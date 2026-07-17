
const axios = require('axios');
const xml = `
<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
    </STATICVARIABLES>
    <TDL><TDLMESSAGE>
        <COLLECTION NAME="LastVouchers">
            <TYPE>Voucher</TYPE>
            <FETCH>*</FETCH>
        </COLLECTION>
    </TDLMESSAGE></TDL>
    <REPORTNAME>List of Accounts</REPORTNAME>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => {
        console.log('Response:', r.data.substring(r.data.lastIndexOf('<VOUCHER'), r.data.lastIndexOf('</VOUCHER>') + 10));
    })
    .catch(e => console.error(e.message));
