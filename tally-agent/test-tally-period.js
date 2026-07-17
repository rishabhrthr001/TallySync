const axios = require('axios');
async function test() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;
    try {
        const res = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log(res.data.match(/<SVFROMDATE>(.*?)<\/SVFROMDATE>/)?.[1]);
        console.log(res.data.match(/<SVTODATE>(.*?)<\/SVTODATE>/)?.[1]);
    } catch (e) {}
}
test();
