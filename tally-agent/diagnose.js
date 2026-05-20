/**
 * diagnose.js — Checks the state of Tally masters for the active company.
 * Run: node diagnose.js
 */
const axios = require('axios');
const TALLY_URL = 'http://localhost:9000';

async function tally(xml) {
    const res = await axios.post(TALLY_URL, xml, {
        headers: { 'Content-Type': 'text/xml' }, timeout: 8000
    });
    return res.data;
}

async function main() {
    console.log('=== TallySync Diagnostics ===\n');

    // 1. Active company
    const compXml = `
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>List of Accounts</REPORTNAME>
    <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><ACCOUNTTYPE>Company</ACCOUNTTYPE></STATICVARIABLES>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
    const compData = await tally(compXml);
    const compMatch = compData.match(/<SVCURRENTCOMPANY>(.*?)<\/SVCURRENTCOMPANY>/i);
    console.log('Active Company:', compMatch ? compMatch[1] : 'NOT DETECTED');

    // 2. Check if company maintains inventory
    const invCheck = compData.match(/<ISMAINTAININGACCOUNTSONLY>(.*?)<\/ISMAINTAININGACCOUNTSONLY>/i);
    console.log('Accounts Only Mode:', invCheck ? invCheck[1] : 'Not found in response (probably NO = inventory enabled)');

    // 3. List all Ledgers
    const masterXml = `
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>List of Accounts</REPORTNAME>
    <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
    const masterData = await tally(masterXml);

    // Check key ledgers
    const ledgersToCheck = ['GST Tax', 'Sales Accounts', 'Purchase Accounts', 'Sundry Debtors', 'Sundry Creditors', 'Prince', 'Software Services'];
    console.log('\n--- Ledger/Stock Item Presence ---');
    for (const name of ledgersToCheck) {
        const found = new RegExp(`<NAME>\\s*${name}\\s*</NAME>`, 'i').test(masterData);
        console.log(`  ${found ? '✅' : '❌'} "${name}"`);
    }

    // 4. Try creating "GST Tax" explicitly
    console.log('\n--- Creating "GST Tax" ledger ---');
    const gstXml = `
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
    <REQUESTDATA>
        <TALLYMESSAGE>
            <LEDGER NAME="GST Tax" ACTION="Create">
                <NAME>GST Tax</NAME>
                <PARENT>Duties &amp; Taxes</PARENT>
                <TAXTYPE>GST</TAXTYPE>
            </LEDGER>
        </TALLYMESSAGE>
    </REQUESTDATA>
</IMPORTDATA></BODY></ENVELOPE>`;
    const gstRes = await tally(gstXml);
    console.log('GST Tax create response:', gstRes.substring(0, 300));

    // 5. Try a minimal plain voucher (no inventory) to confirm voucher creation works
    console.log('\n--- Testing minimal Sales voucher (no stock) ---');
    const minVouXml = `
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY><IMPORTDATA>
    <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${compMatch ? compMatch[1] : 'Nikhil'}</SVCURRENTCOMPANY></STATICVARIABLES>
    </REQUESTDESC>
    <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create">
                <DATE>01-May-2026</DATE>
                <EFFECTIVEDATE>01-May-2026</EFFECTIVEDATE>
                <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                <REFERENCE>DIAG-001</REFERENCE>
                <PARTYLEDGERNAME>Prince</PARTYLEDGERNAME>
                <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>Prince</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                    <AMOUNT>-1000.00</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
                <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>Sales Accounts</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                    <AMOUNT>1000.00</AMOUNT>
                </ALLLEDGERENTRIES.LIST>
            </VOUCHER>
        </TALLYMESSAGE>
    </REQUESTDATA>
</IMPORTDATA></BODY></ENVELOPE>`;
    const minRes = await tally(minVouXml);
    const minOk = minRes.includes('<CREATED>1</CREATED>');
    console.log('Minimal voucher result:', minOk ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Response:', minRes.substring(0, 300));
}

main().catch(console.error);
