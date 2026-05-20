const axios = require('axios');

function escapeXML(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateVoucherXML(entry) {
    const dateStr = entry.date.replace(/-/g, '');
    const voucherType = entry.type === 'sales' ? 'Sales' : 'Purchase';
    const party = escapeXML(entry.partyName);
    const invoice = escapeXML(entry.invoiceNumber);
    const salesLedger = entry.type === 'sales' ? 'Sales Accounts' : 'Purchase Accounts';
    const taxLedger = 'GST Tax';

    return `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>${escapeXML(entry.companyName)}</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="${voucherType}" ACTION="Create" OBJVIEW="Accounting VoucherView">
                        <DATE>${dateStr}</DATE>
                        <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
                        <REFERENCE>${invoice}</REFERENCE>
                        <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
                        <PERSISTEDVIEW>Accounting VoucherView</PERSISTEDVIEW>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>${party}</LEDGERNAME>
                            ${entry.partyGstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${escapeXML(entry.partyGstin)}</PARTYGSTIN>` : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`}
                            <ISDEEMEDPOSITIVE>${entry.type === 'sales' ? 'YES' : 'NO'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${((entry.type === 'sales' ? -1 : 1) * entry.totalAmount).toFixed(2)}</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>${salesLedger}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${entry.type === 'sales' ? 'NO' : 'YES'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${((entry.type === 'sales' ? 1 : -1) * entry.taxableAmount).toFixed(2)}</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>${entry.taxAmount > 0 ? `
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>${taxLedger}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${entry.type === 'sales' ? 'NO' : 'YES'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${((entry.type === 'sales' ? 1 : -1) * entry.taxAmount).toFixed(2)}</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>` : ''}
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
}

async function run() {
    const loginRes = await axios.post('https://tallysync-backend-1020363630918.asia-south1.run.app/api/auth/login', { email: 'pankaj@tallySync.com', password: 'pankaj@9999' });
    const queue = await axios.get('https://tallysync-backend-1020363630918.asia-south1.run.app/api/entries', { headers: { Authorization: `Bearer ${loginRes.data.token}` } });
    
    // Find the bill with 2027 in its invoice number
    const entry = queue.data.find(e => e.invoiceNumber === 'INV-TEST-NIKHIL-4890');
    if (!entry) {
        console.log('No pending entry for Nikhil found!');
        return;
    }

    console.log(`Testing with entry: ${entry.invoiceNumber}`);
    const xml = generateVoucherXML(entry);
    console.log("SENDING VOUCHER XML:\n", xml);

    try {
        const response = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } });
        console.log('TALLY RESPONSE:');
        console.log(response.data);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
