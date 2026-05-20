const axios = require('axios');

async function testTallyVoucher() {
    const xml = `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting VoucherView">
                        <DATE>20260503</DATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <REFERENCE>TEST-VOUCHER-1</REFERENCE>
                        <PARTYLEDGERNAME>Tech Innovations 1703</PARTYLEDGERNAME>
                        <PERSISTEDVIEW>Accounting VoucherView</PERSISTEDVIEW>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Tech Innovations 1703</LEDGERNAME>
                            <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
                            <PARTYGSTIN>27AADCB2230M1Z2</PARTYGSTIN>
                            <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                            <AMOUNT>-11800.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Sales Accounts</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>10000.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        const response = await axios.post('http://localhost:9000', xml, {
            headers: { 'Content-Type': 'text/xml' }
        });
        console.log('VOUCHER RESPONSE:');
        console.log(response.data);
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

testTallyVoucher();
