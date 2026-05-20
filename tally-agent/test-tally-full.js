const axios = require('axios');

async function testTallyFull() {
    const party = 'Tech Innovations 1703';
    
    // 1. Create Ledger
    const ledgerXml = `
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
                    <LEDGER NAME="${party}" ACTION="Create">
                        <NAME>${party}</NAME>
                        <PARENT>Sundry Debtors</PARENT>
                        <OPENINGBALANCE>0</OPENINGBALANCE>
                        <PARTYGSTIN>27AADCB2230M1Z2</PARTYGSTIN>
                        <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
                    </LEDGER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        await axios.post('http://localhost:9000', ledgerXml, { headers: { 'Content-Type': 'text/xml' } });
        console.log('Ledger created');
    } catch (e) {
        console.log('Ledger err', e.message);
    }

    // 2. Create Voucher
    const voucherXml = `
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
                        <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
                        <PERSISTEDVIEW>Accounting VoucherView</PERSISTEDVIEW>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>${party}</LEDGERNAME>
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
        const response = await axios.post('http://localhost:9000', voucherXml, { headers: { 'Content-Type': 'text/xml' } });
        console.log('VOUCHER RESPONSE:');
        console.log(response.data);
    } catch (e) {
        console.log('Voucher err', e.message);
    }
}

testTallyFull();
