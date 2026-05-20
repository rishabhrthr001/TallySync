const axios = require('axios');
const xml = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER ACTION="Create" VCHTYPE="Sales" OBJVIEW="Invoice Voucher View">
                        <DATE>01-May-2026</DATE>
                        <EFFECTIVEDATE>01-May-2026</EFFECTIVEDATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <PARTYLEDGERNAME>xiaomi</PARTYLEDGERNAME>
                        <ISINVOICE>Yes</ISINVOICE>
                        <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                        
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>xiaomi</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                            <AMOUNT>-442500.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>

                        <ALLINVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>Smart TV</STOCKITEMNAME>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <RATE>45000.00</RATE>
                            <AMOUNT>225000.00</AMOUNT>
                            <BILLEDQTY> 5 Nos</BILLEDQTY>
                            <ACTUALQTY> 5 Nos</ACTUALQTY>
                            <BATCHALLOCATIONS.LIST>
                                <GODOWNNAME>Main Location</GODOWNNAME>
                                <BATCHNAME>Primary Batch</BATCHNAME>
                                <AMOUNT>225000.00</AMOUNT>
                                <ACTUALQTY> 5 Nos</ACTUALQTY>
                                <BILLEDQTY> 5 Nos</BILLEDQTY>
                            </BATCHALLOCATIONS.LIST>
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>Sales Accounts</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                                <AMOUNT>225000.00</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                        </ALLINVENTORYENTRIES.LIST>

                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>GST Tax</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>67500.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml).then(r => console.log(r.data)).catch(e => console.error(e.message));
