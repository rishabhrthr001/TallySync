const axios = require('axios');
const TALLY = 'http://127.0.0.1:9000';

async function tally(xml) {
    const res = await axios.post(TALLY, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000
    });
    return res.data;
}

async function main() {
    // First check current stock
    console.log('=== Current Stock ===');
    const stockXml = `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>Stock Summary</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
    const stockRes = await tally(stockXml);
    const qtyMatch = stockRes.match(/<DSPCLQTY>(.*?)<\/DSPCLQTY>/);
    console.log(`Current stock: ${qtyMatch ? qtyMatch[1] : 'unknown'}\n`);

    // Test 1: Stock Journal with ONLY OUT (no IN)
    console.log('--- Test 1: Stock Journal with ONLY OUT ---');
    let xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
    <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Stock Journal" ACTION="Create">
            <DATE>20260501</DATE><VOUCHERTYPENAME>Stock Journal</VOUCHERTYPENAME><REFERENCE>SJ-OUT-ONLY</REFERENCE>
            <INVENTORYENTRIESOUT.LIST>
                <STOCKITEMNAME>Software Service</STOCKITEMNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                <RATE>5000.00/Nos</RATE><ACTUALQTY>1 Nos</ACTUALQTY><BILLEDQTY>1 Nos</BILLEDQTY><AMOUNT>5000.00</AMOUNT>
            </INVENTORYENTRIESOUT.LIST>
        </VOUCHER>
    </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    let res = await tally(xml);
    console.log(`  ${res.includes('<CREATED>1') ? '✅ SUCCESS' : '❌ FAILED: ' + res.substring(0, 150)}\n`);

    // Test 2: Receipt Note (Purchase type that adds stock)
    console.log('--- Test 2: Receipt Note ---');
    xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
    <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Receipt Note" ACTION="Create">
            <DATE>20260501</DATE><VOUCHERTYPENAME>Receipt Note</VOUCHERTYPENAME><REFERENCE>RN-TEST</REFERENCE>
            <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
            <INVENTORYENTRIESIN.LIST>
                <STOCKITEMNAME>Software Service</STOCKITEMNAME><ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                <RATE>5000.00/Nos</RATE><ACTUALQTY>1 Nos</ACTUALQTY><BILLEDQTY>1 Nos</BILLEDQTY><AMOUNT>5000.00</AMOUNT>
            </INVENTORYENTRIESIN.LIST>
        </VOUCHER>
    </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    res = await tally(xml);
    console.log(`  ${res.includes('<CREATED>1') ? '✅ SUCCESS' : '❌ FAILED: ' + res.substring(0, 150)}\n`);

    // Test 3: Delivery Note (Sales type that removes stock)
    console.log('--- Test 3: Delivery Note ---');
    xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
    <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Delivery Note" ACTION="Create">
            <DATE>20260501</DATE><VOUCHERTYPENAME>Delivery Note</VOUCHERTYPENAME><REFERENCE>DN-TEST</REFERENCE>
            <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
            <INVENTORYENTRIESOUT.LIST>
                <STOCKITEMNAME>Software Service</STOCKITEMNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                <RATE>5000.00/Nos</RATE><ACTUALQTY>1 Nos</ACTUALQTY><BILLEDQTY>1 Nos</BILLEDQTY><AMOUNT>5000.00</AMOUNT>
            </INVENTORYENTRIESOUT.LIST>
        </VOUCHER>
    </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    res = await tally(xml);
    console.log(`  ${res.includes('<CREATED>1') ? '✅ SUCCESS' : '❌ FAILED: ' + res.substring(0, 150)}\n`);

    // Test 4: Rejection Out
    console.log('--- Test 4: Rejection Out ---');
    xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Nikhil</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
    <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Rejection Out" ACTION="Create">
            <DATE>20260501</DATE><VOUCHERTYPENAME>Rejection Out</VOUCHERTYPENAME><REFERENCE>RO-TEST</REFERENCE>
            <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
            <INVENTORYENTRIESOUT.LIST>
                <STOCKITEMNAME>Software Service</STOCKITEMNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                <RATE>5000.00/Nos</RATE><ACTUALQTY>1 Nos</ACTUALQTY><BILLEDQTY>1 Nos</BILLEDQTY><AMOUNT>5000.00</AMOUNT>
            </INVENTORYENTRIESOUT.LIST>
        </VOUCHER>
    </TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    res = await tally(xml);
    console.log(`  ${res.includes('<CREATED>1') ? '✅ SUCCESS' : '❌ FAILED: ' + res.substring(0, 150)}\n`);

    // Check stock after
    console.log('=== Stock After Tests ===');
    const stockAfter = await tally(stockXml);
    const qtyAfter = stockAfter.match(/<DSPCLQTY>(.*?)<\/DSPCLQTY>/);
    console.log(`Stock after: ${qtyAfter ? qtyAfter[1] : 'unknown'}`);
}

main().catch(console.error);
