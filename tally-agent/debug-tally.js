const axios = require('axios');

async function testTally() {
    const xml = `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
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
        const response = await axios.post('http://localhost:9000', xml, {
            headers: { 'Content-Type': 'text/xml' }
        });
        console.log('RAW TALLY RESPONSE:');
        console.log(response.data);
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

testTally();
