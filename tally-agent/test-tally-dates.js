const axios = require('axios');

async function testDates() {
    const years = ['20260501'];
    
    for (const d of years) {
        const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting VoucherView">
                        <DATE>${d}</DATE>
                        <EFFECTIVEDATE>${d}</EFFECTIVEDATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <REFERENCE>TEST-DATE-${d}</REFERENCE>
                        <PARTYLEDGERNAME>Sales Accounts</PARTYLEDGERNAME>
                        <PERSISTEDVIEW>Accounting VoucherView</PERSISTEDVIEW>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Sales Accounts</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                            <AMOUNT>-100.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Sales Accounts</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>100.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
        try {
            const res = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
            console.log(`Testing Date: ${d} -> ${res.data.includes('Voucher date is missing') ? 'FAILED (Out of Range)' : 'SUCCESS / OTHER ERROR'}`);
            if (!res.data.includes('Voucher date is missing')) {
                console.log(res.data);
            }
        } catch (e) {
            console.error(`Error for ${d}`);
        }
    }
}
testDates();
