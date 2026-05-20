const axios = require('axios');
async function test() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
                    <ACCOUNTTYPE>Company</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;
    try {
        const res = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log(res.data);
    } catch (e) {}
}
test();
