const axios = require('axios');

const xml = `<ENVELOPE>
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
                        <DATE>01-May-2026</DATE>
                        <EFFECTIVEDATE>01-May-2026</EFFECTIVEDATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <REFERENCE>INV-ALLOC-001</REFERENCE>
                        <ISINVOICE>YES</ISINVOICE>
                        
                        <PARTYLEDGERNAME>samsung</PARTYLEDGERNAME>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>samsung</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                            <AMOUNT>-70800.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                        
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Sales Accounts</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>60000.00</AMOUNT>
                            
                            <INVENTORYALLOCATIONS.LIST>
                                <STOCKITEMNAME>Software Service</STOCKITEMNAME>
                                <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                                <RATE>20000.00/Nos</RATE>
                                <ACTUALQTY>3 Nos</ACTUALQTY>
                                <BILLEDQTY>3 Nos</BILLEDQTY>
                                <AMOUNT>60000.00</AMOUNT>
                            </INVENTORYALLOCATIONS.LIST>
                        </ALLLEDGERENTRIES.LIST>
                        
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>GST Tax</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                            <AMOUNT>10800.00</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

axios.post('http://127.0.0.1:9000', xml).then(r => console.log(r.data)).catch(e => console.error(e.message));
