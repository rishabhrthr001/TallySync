
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
        <COLLECTION NAME="VoucherCollection">
            <TYPE>Voucher</TYPE>
            <FETCH>DATE, VOUCHERNUMBER, REFERENCE, PARTYLEDGERNAME, ALLLEDGERENTRIES.*, ALLINVENTORYENTRIES.*</FETCH>
        </COLLECTION>
    </TDLMESSAGE></TDL>
    <REPORTNAME>List of Accounts</REPORTNAME>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => {
        const data = r.data;
        // Find the last voucher
        const start = data.lastIndexOf('<VOUCHER');
        const end = data.lastIndexOf('</VOUCHER>');
        if (start !== -1 && end !== -1) {
            console.log(data.substring(start, end + 10));
        } else {
            console.log('No vouchers found in response.');
        }
    })
    .catch(e => console.error(e.message));
