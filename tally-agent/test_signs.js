
const axios = require('axios');
const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
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
                    <VOUCHER VCHTYPE="Sales" ACTION="Create">
                        <DATE>20260501</DATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <REFERENCE>TEST-CONV-1</REFERENCE>
                        <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>Cash</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                            <AMOUNT>1180.00</AMOUNT>
                        </LEDGERENTRIES.LIST>
                        <INVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>Software Service</STOCKITEMNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>-1000.00</AMOUNT>
                            <ACTUALQTY> 1 Nos</ACTUALQTY>
                            <BILLEDQTY> 1 Nos</BILLEDQTY>
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>Sales Accounts</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                                <AMOUNT>-1000.00</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                        </INVENTORYENTRIES.LIST>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>GST Tax</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>-180.00</AMOUNT>
                        </LEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml)
    .then(r => console.log('Response:', r.data))
    .catch(e => console.error(e.message));
