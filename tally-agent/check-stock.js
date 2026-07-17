const axios = require('axios');
const TALLY = 'http://127.0.0.1:9000';

async function tryQuery(label, xml) {
    try {
        console.log(`\n--- ${label} ---`);
        const start = Date.now();
        const r = await axios.post(TALLY, xml, {
            headers: { 'Content-Type': 'text/xml' },
            timeout: 10000
        });
        console.log(`  Time: ${Date.now() - start}ms, Length: ${r.data.length}`);
        const names = [...r.data.matchAll(/<NAME>(.*?)<\/NAME>/gi)];
        if (names.length > 0) {
            console.log(`  Names found:`);
            names.forEach(m => console.log(`    • ${m[1]}`));
        } else {
            console.log(`  No <NAME> tags. First 500 chars:`);
            console.log(`  ${r.data.substring(0, 500)}`);
        }
        return true;
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
        return false;
    }
}

async function main() {
    // Method 1: TDL Collection
    await tryQuery('TDL Collection', `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Collection</TYPE><ID>MyStockItems</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="MyStockItems"><TYPE>Stock Item</TYPE><FETCH>NAME, BASEUNITS</FETCH></COLLECTION></TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>`);

    // Method 2: REPORTNAME=Stock Summary
    await tryQuery('Stock Summary Report', `<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <REPORTNAME>Stock Summary</REPORTNAME>
    <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`);

    // Method 3: REPORTNAME=StockItem 
    await tryQuery('StockItem Export', `<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA><REQUESTDESC>
    <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
    <REPORTNAME>StockItem</REPORTNAME>
</REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`);
}

main();
