const axios = require('axios');

async function testVoucher() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY>
                    <USEZEROENTRIES>Yes</USEZEROENTRIES>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
                        <DATE>01-May-2026</DATE>
                        <EFFECTIVEDATE>01-May-2026</EFFECTIVEDATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <REFERENCE>TEST-SIGN-2</REFERENCE>
                        <VOUCHERNUMBER>TEST-SIGN-2</VOUCHERNUMBER>
                        <NARRATION>Test Sign 2</NARRATION>
                        
                        <ISINVOICE>Yes</ISINVOICE>
                        <ISVATDUTYPAID>Yes</ISVATDUTYPAID>
                        <PARTYLEDGERNAME>mentos</PARTYLEDGERNAME>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>mentos</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                            <AMOUNT>-11800.00</AMOUNT>
                        </LEDGERENTRIES.LIST>
                        
                        <ALLINVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>App Development</STOCKITEMNAME>
                            <RATE>10000.00/Nos</RATE>
                            <AMOUNT>-10000.00</AMOUNT>
                            <ACTUALQTY> 1 Nos</ACTUALQTY>
                            <BILLEDQTY> 1 Nos</BILLEDQTY>
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>Sales Accounts</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                                <AMOUNT>10000.00</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                        </ALLINVENTORYENTRIES.LIST>
                        
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>GST Tax</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>1800.00</AMOUNT>
                        </LEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

    try {
        const res = await axios.post('http://127.0.0.1:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log('[TEST VOUCHER RESPONSE]\n', res.data);
    } catch (e) {
        console.error('[ERROR]', e.message);
    }
}

testVoucher();
