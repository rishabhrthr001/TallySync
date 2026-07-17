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
                <TALLYMESSAGE>
                    <VOUCHERTYPE NAME="Sales" ACTION="Alter">
                        <NAME>Sales</NAME>
                        <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
                        <NUMBERINGMETHOD>Manual</NUMBERINGMETHOD>
                        <ISINVOICE>Yes</ISINVOICE>
                    </VOUCHERTYPE>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => console.log('Tally Response:', r.data))
    .catch(e => console.error('Error:', e.message));
