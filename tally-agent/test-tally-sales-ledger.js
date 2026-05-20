const axios = require('axios');
async function test() {
    const xml = `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <LEDGER NAME="Sales Accounts" ACTION="Create">
                        <NAME>Sales Accounts</NAME>
                        <PARENT>Sales Accounts</PARENT>
                        <OPENINGBALANCE>0</OPENINGBALANCE>
                        <GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>
                    </LEDGER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
    try {
        const res = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log(res.data);
    } catch (e) { console.error(e.message); }
}
test();
