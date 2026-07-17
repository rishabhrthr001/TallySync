const axios = require('axios');

/**
 * CONFIGURATION
 */
const CONFIG = {
    BACKEND_URL: process.env.BACKEND_URL || 'https://photobill-backend-1020363630918.asia-south1.run.app',
    TALLY_URL: process.env.TALLY_URL || 'http://127.0.0.1:9000',
    EMAIL: process.env.AGENT_EMAIL || 'pankaj@photoBill.com',
    PASSWORD: process.env.AGENT_PASSWORD || 'pankaj@9999',
    POLL_INTERVAL: 10000,
    RETRY_DELAY: 5000,
};

let AUTH_TOKEN = null;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function escapeXML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Convert a date string (YYYY-MM-DD or ISO) to Tally format.
 * Tally Educational Mode only allows 1st, 2nd, and 31st of any month.
 * We use the 1st to be universally safe.
 */
function toTallyDate(dateStr) {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let d;
    try {
        d = new Date(dateStr);
        if (isNaN(d.getTime())) d = new Date();
    } catch (e) {
        d = new Date();
    }
    // Force day=01 for Educational Mode compatibility
    return `01-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

const STATE_CODES = {
    '27': 'Maharashtra', '07': 'Delhi', '09': 'Uttar Pradesh', '33': 'Tamil Nadu',
    '19': 'West Bengal', '24': 'Gujarat', '29': 'Karnataka', '32': 'Kerala',
    '08': 'Rajasthan', '06': 'Haryana', '03': 'Punjab', '10': 'Bihar',
    '36': 'Telangana', '37': 'Andhra Pradesh', '23': 'Madhya Pradesh', '18': 'Assam'
};

function getStateName(gstin) {
    if (!gstin || gstin.length < 2) return '';
    return STATE_CODES[gstin.substring(0, 2)] || '';
}

// ─── NETWORK ────────────────────────────────────────────────────────────────

async function login() {
    while (true) {
        try {
            console.log(`[AUTH] Attempting login to ${CONFIG.BACKEND_URL}...`);
            const res = await axios.post(`${CONFIG.BACKEND_URL}/api/auth/login`, {
                email: CONFIG.EMAIL,
                password: CONFIG.PASSWORD
            });
            AUTH_TOKEN = res.data.token;
            console.log('[AUTH] Login successful.');
            break;
        } catch (error) {
            console.error(`[AUTH] Login failed: ${error.message}. Retrying in 5 seconds...`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

async function tallyRequest(xml) {
    const res = await axios.post(CONFIG.TALLY_URL, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 8000
    });
    return res.data;
}

async function updateBackendStatus(id, status, errorMsg = '') {
    try {
        await axios.patch(`${CONFIG.BACKEND_URL}/api/entries/${id}/sync-status`,
            { status, error: errorMsg },
            { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
    } catch (err) {
        console.warn(`[BACKEND] Failed to update status for ${id}: ${err.message}`);
    }
}

function unescapeXML(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function cleanTallyName(name) {
    if (!name) return '';
    return name
        .replace(/^(?:<NAME>|&lt;NAME&gt;)+/gi, '')
        .replace(/(?:<\/NAME>|&lt;\/NAME&gt;)+$/gi, '')
        .trim();
}


function getUOMForStockItem(stockItemData, resolvedName) {
    if (!stockItemData || !resolvedName) return 'Nos';
    try {
        const escapedName = escapeXML(resolvedName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Pattern 1: <STOCKITEM NAME="resolvedName" ...> ... <BASEUNITS>unit</BASEUNITS>
        const pattern1 = new RegExp(`<STOCKITEM[^>]*NAME="\\s*${escapedName}\\s*"[^>]*>([\\s\\S]*?)</STOCKITEM>`, 'i');
        let match = stockItemData.match(pattern1);
        if (match && match[1]) {
            const uomMatch = match[1].match(/<BASEUNITS>(.*?)<\/BASEUNITS>/i);
            if (uomMatch && uomMatch[1]) return unescapeXML(uomMatch[1].trim());
        }

        // Pattern 2: <STOCKITEM ...> ... <NAME>resolvedName</NAME> ... <BASEUNITS>unit</BASEUNITS>
        const blocks = stockItemData.split(/<STOCKITEM/gi);
        for (const block of blocks) {
            const nameMatch = block.match(new RegExp(`<NAME[^>]*>\\s*${escapedName}\\s*</NAME>`, 'i'));
            if (nameMatch) {
                const uomMatch = block.match(/<BASEUNITS>(.*?)<\/BASEUNITS>/i);
                if (uomMatch && uomMatch[1]) {
                    return unescapeXML(uomMatch[1].trim());
                }
            }
        }
    } catch (e) {
        console.warn(`[STOCK] Error parsing UOM for "${resolvedName}": ${e.message}`);
    }
    return 'Nos';
}

// ─── TALLY MASTER HELPERS ───────────────────────────────────────────────────

/** Detect which company is currently open in Tally */
async function getActiveCompany() {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Company</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>`;
    try {
        const data = await tallyRequest(xml);
        // Tally sometimes returns the current company in SVCURRENTCOMPANY or inside the first COMPANY tag
        const m = data.match(/<SVCURRENTCOMPANY>(.*?)<\/SVCURRENTCOMPANY>/i) 
               || data.match(/<REMOTECMPNAME>(.*?)<\/REMOTECMPNAME>/i)
               || data.match(/<NAME[^>]*>(.*?)<\/NAME>/i);
        return m ? unescapeXML(m[1].trim()) : null;
    } catch {
        return null;
    }
}

/** Resolve the correct company name from Tally to avoid 'Could not set SVCurrentCompany' errors */
async function resolveCompanyName(requestedName) {
    if (!requestedName) return null;
    const active = await getActiveCompany();
    if (active) {
        console.log(`[TALLY] Resolving "${requestedName}" -> Active Open Company: "${active}"`);
        return active;
    }
    return requestedName;
}

/** Fetch ledgers specifically from Tally using TDL Collection to avoid group-name collisions */
async function getLedgerList(companyName) {
    const resolvedName = await resolveCompanyName(companyName);
    const xml = `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Collection</TYPE><ID>TallySyncLedgers</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVCURRENTCOMPANY>${escapeXML(resolvedName)}</SVCURRENTCOMPANY>
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="TallySyncLedgers"><TYPE>Ledger</TYPE><FETCH>NAME, PARENT, PARTYGSTIN, CLOSINGBALANCE</FETCH></COLLECTION></TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>`;
    try {
        const data = await tallyRequest(xml);
        console.log(`[LEDGER] Fetched ledgers (${data.length} bytes)`);
        return data;
    } catch (e) {
        console.error(`[TALLY] Failed to fetch ledgers: ${e.message}`);
        return '';
    }
}

/** Fetch stock items specifically from Tally using TDL Collection */
async function getStockItemList(companyName) {
    const resolvedName = await resolveCompanyName(companyName);
    const xml = `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export Data</TALLYREQUEST><TYPE>Collection</TYPE><ID>TallySyncStockItems</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVCURRENTCOMPANY>${escapeXML(resolvedName)}</SVCURRENTCOMPANY>
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="TallySyncStockItems"><TYPE>Stock Item</TYPE><FETCH>NAME, BASEUNITS, CLOSINGBALANCE, OPENINGRATE, STANDARDCOSTINGRATE, STANDARDSELLINGRATE</FETCH><METHOD>LASTSALEPRICE : $LASTSALERATE</METHOD><METHOD>STANDARDPRICE : $STANDARDPRICE</METHOD><METHOD>LASTPURCHASECOST : $LASTPURCHASECOST</METHOD></COLLECTION></TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>`;
    try {
        const data = await tallyRequest(xml);
        console.log(`[STOCK] Fetched stock items (${data.length} bytes)`);
        return data;
    } catch (e) {
        console.error(`[TALLY] Failed to fetch stock items: ${e.message}`);
        return '';
    }
}

/** Check if a name exists in a Tally data string (case-insensitive) */
function findExactName(dataStr, name) {
    if (!dataStr || !name) return null;
    const searchName = name.trim();
    // Match both <NAME>value</NAME> and NAME="value" attribute patterns
    // Using a more robust regex to ensure we match the full string
    const escapedName = escapeXML(searchName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRegex = new RegExp(`<NAME>\\s*(${escapedName})\\s*</NAME>`, 'i');
    const attrRegex = new RegExp(`NAME="(${escapedName})"`, 'i');
    
    const m = dataStr.match(tagRegex) || dataStr.match(attrRegex);
    if (m) {
        console.log(`[MATCH] Found exact Tally name for "${searchName}" -> "${m[1]}"`);
        return m[1];
    }

    // Smart Fallback: Try singular/plural variation
    let variation = '';
    if (searchName.toLowerCase().endsWith('s')) {
        variation = searchName.substring(0, searchName.length - 1);
    } else {
        variation = searchName + 's';
    }

    const varEscaped = escapeXML(variation).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const varTagRegex = new RegExp(`<NAME>\\s*(${varEscaped})\\s*</NAME>`, 'i');
    const varMatch = dataStr.match(varTagRegex);

    if (varMatch) {
        console.log(`[SMART MATCH] Using Tally's "${varMatch[1]}" for bill's "${searchName}"`);
        return varMatch[1];
    }

    return null;
}

/** Create or verify Unit of Measure in Tally */
async function upsertUnit(companyName, uom = 'Nos') {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY><IMPORTDATA>
        <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${escapeXML(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
            <TALLYMESSAGE>
                <UNIT NAME="${escapeXML(uom)}" ACTION="Alter">
                    <NAME>${escapeXML(uom)}</NAME>
                    <SYMBOL>${escapeXML(uom)}</SYMBOL>
                </UNIT>
            </TALLYMESSAGE>
        </REQUESTDATA>
    </IMPORTDATA></BODY>
</ENVELOPE>`;
    try {
        const res = await tallyRequest(xml);
        const ok = res.includes('<CREATED>1</CREATED>') || res.includes('<ALTERED>1</ALTERED>');
        if (ok) {
            console.log(`[UNIT] OK: "${uom}"`);
        } else {
            console.warn(`[UNIT] Create/Alter not confirmed for "${uom}". Response: ${res.substring(0, 200)}`);
        }
        return ok;
    } catch (e) {
        console.warn(`[UNIT] Error creating "${uom}": ${e.message}`);
        return false;
    }
}

/**
 * Create or update a Stock Item in Tally.
 * ACTION="Create" — Tally will skip if it already exists.
 */
async function upsertStockItem(companyName, name, uom = 'Nos') {
    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY><IMPORTDATA>
        <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${escapeXML(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
            <TALLYMESSAGE>
                <STOCKITEM NAME="${escapeXML(name)}" ACTION="Create">
                    <NAME>${escapeXML(name)}</NAME>
                    <BASEUNITS>${escapeXML(uom)}</BASEUNITS>
                    <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
                    <ISUPDATINGSTOCKITEM>YES</ISUPDATINGSTOCKITEM>
                    <ISCOSTCENTRESON>NO</ISCOSTCENTRESON>
                    <ISBATCHWISEON>NO</ISBATCHWISEON>
                    <ISPERISHABLEON>NO</ISPERISHABLEON>
                    <ISGSTENABLED>YES</ISGSTENABLED>
                </STOCKITEM>
            </TALLYMESSAGE>
        </REQUESTDATA>
    </IMPORTDATA></BODY>
</ENVELOPE>`;
    try {
        const res = await tallyRequest(xml);
        const ok = res.includes('<CREATED>1</CREATED>') || res.includes('<ALTERED>1</ALTERED>');
        if (ok) {
            console.log(`[STOCK] Created/Verified item: "${name}"`);
            // Give Tally a moment to commit the new master before referencing in voucher
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.warn(`[STOCK] Could not confirm creation of "${name}". Response: ${res.substring(0,200)}`);
        }
        return ok;
    } catch (e) {
        console.error(`[STOCK] Error creating "${name}": ${e.message}`);
        return false;
    }
}

/**
 * Create or update a Ledger in Tally.
 * Uses ACTION="Create" by default. forceAlter=true uses ACTION="Alter" to update GSTIN etc.
 */
async function upsertLedger(companyName, ledgerName, parentGroup, gstin = '', forceAlter = false) {
    const stateName = getStateName(gstin);
    const action = forceAlter ? 'Alter' : 'Create';

    const isGstDuty = parentGroup === 'Duties & Taxes';

    const gstBlock = gstin
        ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
           <PARTYGSTIN>${escapeXML(gstin)}</PARTYGSTIN>`
        : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`;

    let dutyHead = 'IGST';
    if (ledgerName.toLowerCase().startsWith('cgst')) {
        dutyHead = 'CGST';
    } else if (ledgerName.toLowerCase().startsWith('sgst')) {
        dutyHead = 'SGST';
    }

    const dutyBlock = isGstDuty
        ? `<TAXTYPE>GST</TAXTYPE>
           <GSTDUTYHEAD>${dutyHead}</GSTDUTYHEAD>`
        : '';

    const xml = `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY><IMPORTDATA>
        <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${escapeXML(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
            <TALLYMESSAGE>
                <LEDGER NAME="${escapeXML(ledgerName)}" ACTION="${action}">
                    <NAME>${escapeXML(ledgerName)}</NAME>
                    <PARENT>${escapeXML(parentGroup)}</PARENT>
                    <STATENAME>${escapeXML(stateName)}</STATENAME>
                    <COUNTRYNAME>India</COUNTRYNAME>
                    <ISGSTENABLED>YES</ISGSTENABLED>
                    ${isGstDuty ? dutyBlock : gstBlock}
                </LEDGER>
            </TALLYMESSAGE>
        </REQUESTDATA>
    </IMPORTDATA></BODY>
</ENVELOPE>`;
    try {
        const res = await tallyRequest(xml);
        const ok = res.includes('<CREATED>1</CREATED>') || res.includes('<ALTERED>1</ALTERED>');
        if (ok) {
            console.log(`[LEDGER] ${action} OK: "${ledgerName}" (${parentGroup})`);
        } else {
            console.warn(`[LEDGER] ${action} not confirmed for "${ledgerName}". Response: ${res.substring(0,200)}`);
        }
        return ok;
    } catch (e) {
        console.error(`[LEDGER] Error on "${ledgerName}": ${e.message}`);
        return false;
    }
}

// ─── VOUCHER XML GENERATORS ─────────────────────────────────────────────────

/**
 * Format quantity for Tally — use integer when whole, decimal only when needed.
 * Tally requires "6 Nos" not "6.00 Nos"
 */
function fmtQty(qty, unit = 'Nos') {
    const n = Number(qty);
    return `${Number.isInteger(n) ? n : n.toFixed(2)} ${unit}`;
}

function buildEnvelope(entry, voucherType, dateStr, bodyXml, objView = '') {
    const narration = entry.items && entry.items.length > 0
        ? `${voucherType} ${entry.invoiceNumber}: ${entry.items.map(i => `${i.name} x${i.quantity}`).join(', ')} — via TallySync`
        : `${voucherType} ${entry.invoiceNumber} — via TallySync`;

    const objViewAttr = objView ? ` OBJVIEW="${objView}"` : '';

    return `
<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>${escapeXML(entry.companyName)}</SVCURRENTCOMPANY>
                    <USEZEROENTRIES>Yes</USEZEROENTRIES>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="${voucherType}" ACTION="Create"${objViewAttr}>
                        <DATE>${dateStr}</DATE>
                        <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
                        <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
                        <REFERENCE>${escapeXML(entry.invoiceNumber)}</REFERENCE>
                        <VOUCHERNUMBER>${escapeXML(entry.invoiceNumber)}</VOUCHERNUMBER>
                        <NARRATION>${escapeXML(narration)}</NARRATION>
                        ${bodyXml}
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
}

/**
 * MODE 1 — Inventory Voucher (with ALLINVENTORYENTRIES.LIST)
 * Preferred mode — tracks stock movement in Tally.
 *
 * Sign rules (Tally uses CREDIT-side perspective):
 *   Sales:    Party Dr (DEEMED=YES, AMT=negative), Stock Cr (DEEMED=NO, AMT=positive),
 *             Income Cr (via ACCOUNTINGALLOCATIONS), GST Cr (DEEMED=NO, AMT=positive)
 *   Purchase: Party Cr (DEEMED=NO, AMT=negative), Stock Dr (DEEMED=YES, AMT=negative),
 *             Expense Dr (via ACCOUNTINGALLOCATIONS), GST Dr (DEEMED=YES, AMT=negative)
 */
function generateInventoryVoucherXML(entry, partyName, incomeLedger, taxLedgers) {
    const isSales    = entry.type === 'sales';
    const voucherType = isSales ? 'Sales' : 'Purchase';
    const dateStr    = toTallyDate(entry.date);

    // Sign rules (Tally XML standard): Debit = Negative, Credit = Positive
    const partyAmtValue = isSales
        ? -Math.abs(Number(entry.totalAmount)) // Sales: Party Dr (-)
        : Math.abs(Number(entry.totalAmount)); // Purchase: Party Cr (+)

    let inventoryLines = '';
    (entry.items || []).forEach(item => {
        const itemQty    = Number(item.quantity) || 0;
        const itemRate   = Number(item.rate) || 0;
        const itemAmountValue = isSales ? Math.abs(itemQty * itemRate) : -Math.abs(itemQty * itemRate); // Sales: Outward (+) Credit, Purchase: Inward (-) Debit
        const allocationAmountValue = itemAmountValue; // Ledgers match inventory entry sign
        
        const rateStr    = `${itemRate.toFixed(2)}/${escapeXML(item.uom || 'Nos')}`;
        const qtyStr     = fmtQty(itemQty, item.uom || 'Nos');

        inventoryLines += `
                        <ALLINVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>${escapeXML(item.name)}</STOCKITEMNAME>
                            <ISDEEMEDPOSITIVE>${isSales ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
                            <RATE>${rateStr}</RATE>
                            <AMOUNT>${itemAmountValue.toFixed(2)}</AMOUNT>
                            <ACTUALQTY>${qtyStr}</ACTUALQTY>
                            <BILLEDQTY>${qtyStr}</BILLEDQTY>
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>${escapeXML(incomeLedger)}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>${isSales ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
                                <AMOUNT>${allocationAmountValue.toFixed(2)}</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                        </ALLINVENTORYENTRIES.LIST>`;
    });

    let taxLines = '';
    (taxLedgers || []).forEach(tax => {
        const taxAmtValue = isSales
            ? Math.abs(tax.amount) // Sales: Tax Cr (+)
            : -Math.abs(tax.amount); // Purchase: Tax Dr (-)
            
        taxLines += `
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${escapeXML(tax.name)}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${isSales ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${taxAmtValue.toFixed(2)}</AMOUNT>
                        </LEDGERENTRIES.LIST>`;
    });

    const body = `
                        <ISINVOICE>Yes</ISINVOICE>
                        <ISVATDUTYPAID>Yes</ISVATDUTYPAID>
                        <PARTYLEDGERNAME>${escapeXML(partyName)}</PARTYLEDGERNAME>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${escapeXML(partyName)}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${isSales ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${partyAmtValue.toFixed(2)}</AMOUNT>
                        </LEDGERENTRIES.LIST>
                        ${inventoryLines}
                        ${taxLines}`;

    return buildEnvelope(entry, voucherType, dateStr, body, 'Invoice Voucher View');
}

/**
 * MODE 2 — Accounting Voucher (fallback, no stock lines)
 * Used when inventory voucher fails (e.g. Tally voucher type not set to "Use for Invoice").
 * Financial totals are correct; stock movement must be updated in Tally manually.
 */
function generateAccountingVoucherXML(entry, partyName, incomeLedger, taxLedgers) {
    const isSales     = entry.type === 'sales';
    const voucherType = isSales ? 'Sales' : 'Purchase';
    const dateStr     = toTallyDate(entry.date);

    // Sign rules (Tally XML standard): Debit = Negative, Credit = Positive
    const partyAmtValue = isSales
        ? -Math.abs(Number(entry.totalAmount)) // Sales: Party Dr (-)
        : Math.abs(Number(entry.totalAmount)); // Purchase: Party Cr (+)

    const incomeAmtValue = isSales
        ? Math.abs(Number(entry.taxableAmount))  // Sales: Income Cr (+)
        : -Math.abs(Number(entry.taxableAmount)); // Purchase: Expense Dr (-)

    let taxLines = '';
    (taxLedgers || []).forEach(tax => {
        const taxAmtValue = isSales
            ? Math.abs(tax.amount) // Sales: Tax Cr (+)
            : -Math.abs(tax.amount); // Purchase: Tax Dr (-)
            
        taxLines += `
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${escapeXML(tax.name)}</LEDGERNAME>
                            <AMOUNT>${taxAmtValue.toFixed(2)}</AMOUNT>
                        </LEDGERENTRIES.LIST>`;
    });

    const body = `
                        <PARTYLEDGERNAME>${escapeXML(partyName)}</PARTYLEDGERNAME>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${escapeXML(partyName)}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${isSales ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${partyAmtValue.toFixed(2)}</AMOUNT>
                        </LEDGERENTRIES.LIST>
                        <LEDGERENTRIES.LIST>
                            <LEDGERNAME>${escapeXML(incomeLedger)}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>${isSales ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
                            <AMOUNT>${incomeAmtValue.toFixed(2)}</AMOUNT>
                        </LEDGERENTRIES.LIST>
                        ${taxLines}`;

    return buildEnvelope(entry, voucherType, dateStr, body, 'Accounting Voucher View');
}

/**
 * STOCK JOURNAL — Adjusts stock quantities after accounting voucher.
 * For Sales:  stock goes OUT (INVENTORYENTRIESOUT → INVENTORYENTRIESIN transfer to consumed)
 * For Purchase: stock comes IN
 * 
 * Stock Journal requires both IN and OUT entries (transfer format).
 * For sales deduction: we create a "consumed" entry. 
 * Actually for simple stock reduction, we use Delivery Note / Receipt Note style.
 * But since Stock Journal worked in testing, we use the same format:
 *   OUT: items being sold/consumed
 *   IN:  same items (transfer to self, net zero, but Tally tracks the movement)
 * 
 * BETTER APPROACH: Use a simple OUT-only structure with godown.
 */
function generateStockJournalXML(entry) {
    const isSales = entry.type === 'sales';
    const dateStr = toTallyDate(entry.date);
    
    const stockLines = (entry.items || []).map(item => {
        const qty = fmtQty(item.quantity);
        const rate = `${Number(item.rate).toFixed(2)}/Nos`;
        const amt = (Number(item.quantity) * Number(item.rate)).toFixed(2);
        
        if (isSales) {
            // Sales = stock goes OUT only (reduces quantity)
            return `
                <INVENTORYENTRIESOUT.LIST>
                    <STOCKITEMNAME>${escapeXML(item.name)}</STOCKITEMNAME>
                    <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                    <RATE>${rate}</RATE>
                    <ACTUALQTY>${qty}</ACTUALQTY>
                    <BILLEDQTY>${qty}</BILLEDQTY>
                    <AMOUNT>${amt}</AMOUNT>
                </INVENTORYENTRIESOUT.LIST>`;
        } else {
            // Purchase = stock comes IN only (increases quantity)
            return `
                <INVENTORYENTRIESIN.LIST>
                    <STOCKITEMNAME>${escapeXML(item.name)}</STOCKITEMNAME>
                    <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                    <RATE>${rate}</RATE>
                    <ACTUALQTY>${qty}</ACTUALQTY>
                    <BILLEDQTY>${qty}</BILLEDQTY>
                    <AMOUNT>${amt}</AMOUNT>
                </INVENTORYENTRIESIN.LIST>`;
        }
    }).join('');

    const narration = `Stock ${isSales ? 'out' : 'in'} for ${entry.invoiceNumber} via TallySync`;

    return `<ENVELOPE>
    <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
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
                    <VOUCHER VCHTYPE="Stock Journal" ACTION="Create">
                        <DATE>${dateStr}</DATE>
                        <VOUCHERTYPENAME>Stock Journal</VOUCHERTYPENAME>
                        <REFERENCE>SJ-${escapeXML(entry.invoiceNumber)}</REFERENCE>
                        <NARRATION>${escapeXML(narration)}</NARRATION>
                        ${stockLines}
                    </VOUCHER>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;
}

// ─── SYNC LOGIC ──────────────────────────────────────────────────────────────

async function syncEntry(entry) {
    console.log(`\n[SYNC] Processing: ${entry.invoiceNumber} (${entry.type}) → Party: ${entry.partyName}`);

    // Resolve exact Tally company name once
    entry.companyName = await resolveCompanyName(entry.companyName);

    // If totalAmount is 0 (missing from frontend), compute it from items
    if (!entry.totalAmount && entry.items && entry.items.length > 0) {
        let computedTotal = 0;
        for (const item of entry.items) {
            computedTotal += (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        }
        if (computedTotal > 0) {
            console.log(`[SYNC] Computed total amount from items: ${computedTotal.toFixed(2)}`);
            entry.totalAmount = computedTotal;
            // Reverse calculate tax if needed (assuming 18% GST for now, as in backend)
            entry.taxableAmount = computedTotal / 1.18;
            entry.taxAmount = computedTotal - entry.taxableAmount;
        }
    }

    try {
        // 1. Fetch current Tally master list (ledgers) and stock item list separately
        const [masterData, stockItemData] = await Promise.all([
            getLedgerList(entry.companyName), 
            getStockItemList(entry.companyName)
        ]);

        console.log(`[DEBUG] Stock item list length: ${stockItemData.length} chars`);

        // 2. Resolve/create all required ledgers
        const partyGroup   = entry.type === 'sales' ? 'Sundry Debtors' : 'Sundry Creditors';
        const incomeGroup  = entry.type === 'sales' ? 'Sales Accounts'  : 'Purchase Accounts';
        
        let taxRate = 18;
        const taxAmount = Number(entry.taxAmount) || 0;
        if (entry.taxableAmount > 0 && taxAmount > 0) {
            taxRate = Math.round((taxAmount / entry.taxableAmount) * 100);
        }

        const incomeLabel = entry.type === 'sales' ? 'Sales Accounts' : 'Purchase Accounts';

        // Determine GST split type (Local CGST + SGST vs Interstate IGST)
        const taxLedgers = [];
        const partyGstin = (entry.partyGstin || '').trim();
        
        let isInterstate = false;
        if (entry.gstType === 'igst') {
            isInterstate = true;
        } else if (!entry.gstType && partyGstin.length === 15) {
            const partyStateCode = partyGstin.substring(0, 2);
            if (partyStateCode !== '27') {
                isInterstate = true;
            }
        }

        if (taxAmount > 0) {
            if (isInterstate) {
                taxLedgers.push({
                    name: `IGST @ ${taxRate}%`,
                    amount: taxAmount,
                    rate: taxRate,
                    group: 'Duties & Taxes'
                });
            } else {
                const halfRate = taxRate / 2;
                const halfAmount = Number((taxAmount / 2).toFixed(2));
                taxLedgers.push({
                    name: `CGST @ ${halfRate}%`,
                    amount: halfAmount,
                    rate: halfRate,
                    group: 'Duties & Taxes'
                });
                const sgstAmount = Number((taxAmount - halfAmount).toFixed(2));
                taxLedgers.push({
                    name: `SGST @ ${halfRate}%`,
                    amount: sgstAmount,
                    rate: halfRate,
                    group: 'Duties & Taxes'
                });
            }
        }

        const ledgersNeeded = [
            { name: entry.partyName.trim(), group: partyGroup,  gstin: entry.partyGstin || '' },
            { name: incomeLabel,            group: incomeGroup,  gstin: '' }
        ];

        for (const tax of taxLedgers) {
            ledgersNeeded.push({ name: tax.name, group: tax.group, gstin: '' });
        }

        const resolvedNames = {};
        for (const led of ledgersNeeded) {
            // Skip reserved internal ledgers
            const nameLower = led.name.toLowerCase();
            if (['cash', 'bank', 'profit & loss'].includes(nameLower)) {
                resolvedNames[led.name] = led.name;
                continue;
            }

            const exactName = findExactName(masterData, led.name);
            if (exactName) {
                resolvedNames[led.name] = exactName;
                // If party has GSTIN, update ledger to ensure GST details are set
                if (led.gstin && ['Sundry Debtors','Sundry Creditors'].includes(led.group)) {
                    await upsertLedger(entry.companyName, exactName, led.group, led.gstin, true); // Alter
                }
            } else {
                console.log(`[LEDGER] Not found in Tally, creating: "${led.name}"`);
                await upsertLedger(entry.companyName, led.name, led.group, led.gstin, false); // Create
                resolvedNames[led.name] = led.name;
            }
        }

        const partyResolved  = resolvedNames[entry.partyName.trim()];
        const incomeResolved = resolvedNames[incomeLabel];
        
        // Map resolved tax ledger names back into our taxLedgers array
        for (const tax of taxLedgers) {
            tax.name = resolvedNames[tax.name] || tax.name;
        }

        // 3. Ensure Unit of Measure exists
        await upsertUnit(entry.companyName, 'Nos');

        // 4. Create any missing stock items FIRST — all of them before the voucher
        const missingItems = [];
        if (entry.items && entry.items.length > 0) {
            for (const item of entry.items) {
                const itemName = item.name.trim();
                
                // For stock items, try SINGULAR form first (e.g., "Software Service")
                // to avoid matching accidentally-created plural duplicates
                let resolvedItem = null;
                
                // Try singular first if name ends with 's'
                if (itemName.toLowerCase().endsWith('s') && itemName.length > 1) {
                    const singular = itemName.substring(0, itemName.length - 1);
                    const singEscaped = escapeXML(singular).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const singRegex = new RegExp(`<NAME>\\s*(${singEscaped})\\s*</NAME>`, 'i');
                    const singMatch = stockItemData.match(singRegex);
                    if (singMatch) {
                        resolvedItem = singMatch[1];
                        console.log(`[STOCK] Resolved "${itemName}" → "${resolvedItem}" (singular preferred)`);
                    }
                }
                
                // If no singular match, try exact match
                if (!resolvedItem) {
                    resolvedItem = findExactName(stockItemData, itemName);
                }

                if (resolvedItem) {
                    console.log(`[STOCK] Already exists in Tally: "${resolvedItem}"`);
                    item.name = resolvedItem;
                    item.uom = getUOMForStockItem(stockItemData, resolvedItem);
                    console.log(`[STOCK]   → UOM resolved to: "${item.uom}"`);
                } else {
                    console.log(`[STOCK] Not found, creating: "${itemName}"`);
                    await upsertStockItem(entry.companyName, itemName, 'Nos');
                    item.uom = 'Nos';
                    missingItems.push(itemName);
                }
            }
        }

        let confirmedStockData = stockItemData;
        if (missingItems.length > 0) {
            console.log(`[STOCK] Waiting 2s for Tally to commit new items...`);
            await new Promise(r => setTimeout(r, 2000));
            confirmedStockData = await getStockItemList();

            for (const itemName of missingItems) {
                const confirmed = findExactName(confirmedStockData, itemName);
                if (confirmed) {
                    console.log(`[STOCK] Confirmed in Tally: "${confirmed}"`);
                    const entryItem = entry.items.find(i => i.name.trim() === itemName);
                    if (entryItem) {
                        entryItem.name = confirmed;
                        entryItem.uom = getUOMForStockItem(confirmedStockData, confirmed);
                    }
                } else {
                    console.warn(`[STOCK] WARNING: "${itemName}" still not found after creation. Voucher may fail.`);
                }
            }
        }

        // 5. Create voucher — TRY INVENTORY VOUCHER first (detailed bill with items),
        //    fall back to ACCOUNTING-ONLY + STOCK JOURNAL if Tally rejects it.
        const isOk = (r) => r.includes('<CREATED>1</CREATED>') || r.includes('<ALTERED>1</ALTERED>');

        let voucherCreated = false;

        // Step 5a: Try INVENTORY VOUCHER first (detailed bill with per-item lines)
        if (entry.items && entry.items.length > 0) {
            console.log(`\n[VOUCHER] Attempting detailed inventory voucher for ${entry.invoiceNumber}...`);
            const invXml = generateInventoryVoucherXML(entry, partyResolved, incomeResolved, taxLedgers);
            console.log(`[DEBUG XML]\n${invXml}`);
            const invResponse = await tallyRequest(invXml);
            console.log(`[DEBUG RESPONSE]\n${invResponse}`);

            if (isOk(invResponse)) {
                console.log(`[VOUCHER] ✅ Detailed inventory voucher created for ${entry.invoiceNumber}`);
                console.log(`[VOUCHER]    → Item details & stock movement recorded in one voucher.`);
                voucherCreated = true;
                // No separate Stock Journal needed — inventory voucher handles stock natively
            } else {
                const errMatch = invResponse.match(/<LINEERROR>(.*?)<\/LINEERROR>/is);
                const errMsg = errMatch ? errMatch[1].replace(/\s+/g, ' ').trim() : '';
                console.warn(`[VOUCHER] ⚠️  Inventory voucher rejected: ${errMsg || 'unknown'}`);
                console.warn(`[VOUCHER]    → Falling back to accounting-only + stock journal...`);
            }
        }

        // Step 5b: Fallback — ACCOUNTING VOUCHER (no item details, just totals)
        if (!voucherCreated) {
            console.log(`\n[VOUCHER] Creating accounting-only entry for ${entry.invoiceNumber}...`);
            const accXml = generateAccountingVoucherXML(entry, partyResolved, incomeResolved, taxLedgers);
            console.log(`[DEBUG XML]\n${accXml}`);
            const accResponse = await tallyRequest(accXml);
            console.log(`[DEBUG RESPONSE]\n${accResponse}`);

            if (!isOk(accResponse)) {
                const errMatch = accResponse.match(/<LINEERROR>(.*?)<\/LINEERROR>/is)
                    || accResponse.match(/<DESCRIPTION>(.*?)<\/DESCRIPTION>/is);
                const errMsg = errMatch
                    ? errMatch[1].replace(/\s+/g, ' ').trim()
                    : 'Accounting voucher creation failed';
                console.error(`[VOUCHER] ❌ FAILED: ${entry.invoiceNumber} — ${errMsg}`);
                console.error(`[TALLY RESPONSE]\n${accResponse}\n`);
                await updateBackendStatus(entry._id, 'failed', errMsg);
                return;
            }
            console.log(`[VOUCHER] ✅ Accounting entry created for ${entry.invoiceNumber}`);

            // Step 5c: Stock Journal ONLY when accounting-only fallback was used
            if (entry.items && entry.items.length > 0) {
                console.log(`[STOCK] Creating Stock Journal for ${entry.invoiceNumber}...`);
                const sjXml = generateStockJournalXML(entry);
                const sjResponse = await tallyRequest(sjXml);

                if (isOk(sjResponse)) {
                    console.log(`[STOCK] ✅ Stock Journal created — quantities updated!`);
                } else {
                    console.warn(`[STOCK] ⚠️  Stock Journal failed. Financial entry is OK, but stock not updated.`);
                    console.warn(`[TALLY RESPONSE]\n${sjResponse}\n`);
                }
            }
        }

        await updateBackendStatus(entry._id, 'success');
        console.log(`[SYNC] ✅ COMPLETE: ${entry.invoiceNumber} (accounting + stock)`);

    } catch (error) {
        console.error(`[SYNC] Exception for ${entry.invoiceNumber}: ${error.message}`);
        await updateBackendStatus(entry._id, 'failed', error.message);
    }
}

function parseStockItemsFromXml(xml) {
    const items = [];
    if (!xml) return items;
    const blocks = xml.split(/<STOCKITEM\b/gi);
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        // Try NAME attribute first (e.g. NAME="Item"), then strict <NAME> child element
        // Do NOT use /<NAME[^>]*>/ — it also matches <NAME.LIST> which wraps names in some Tally versions
        const nameAttrMatch = block.match(/^\s*NAME="([^"]+)"/i);
        const nameTagMatch  = block.match(/<NAME>([\s\S]*?)<\/NAME>/i);
        const rawName = nameAttrMatch ? nameAttrMatch[1] : (nameTagMatch ? nameTagMatch[1] : null);
        if (!rawName) continue;
        const name = cleanTallyName(unescapeXML(rawName.trim()));
        if (!name) continue;

        const uomMatch = block.match(/<BASEUNITS[^>]*>([\s\S]*?)<\/BASEUNITS>/i);
        const uom = uomMatch ? unescapeXML(uomMatch[1].trim()) : 'Nos';
        
        const balMatch = block.match(/<CLOSINGBALANCE[^>]*>([\s\S]*?)<\/CLOSINGBALANCE>/i);
        let stock = 0;
        if (balMatch) {
            const rawBal = unescapeXML(balMatch[1].trim());
            const num = parseFloat(rawBal.replace(/[^\d.-]/g, ''));
            if (!isNaN(num)) stock = num;
        }

        // Tally rate fields often come as "1000.00 /Nos" — strip the /unit part before parsing
        const extractRate = (str) => {
            if (!str) return 0;
            const cleaned = str.split('/')[0].trim(); // only keep the number before "/"
            const num = parseFloat(cleaned.replace(/[^\d.-]/g, ''));
            return (!isNaN(num) && num > 0) ? num : 0;
        };

        // Try rate fields in priority order: last sale → standard selling → standard costing → last purchase → opening rate
        const rateCandidates = [
            block.match(/<LASTSALEPRICE[^>]*>([\s\S]*?)<\/LASTSALEPRICE>/i),
            block.match(/<STANDARDSELLINGRATE[^>]*>([\s\S]*?)<\/STANDARDSELLINGRATE>/i),
            block.match(/<STANDARDPRICE[^>]*>([\s\S]*?)<\/STANDARDPRICE>/i),
            block.match(/<LASTPURCHASECOST[^>]*>([\s\S]*?)<\/LASTPURCHASECOST>/i),
            block.match(/<STANDARDCOSTINGRATE[^>]*>([\s\S]*?)<\/STANDARDCOSTINGRATE>/i),
            block.match(/<OPENINGRATE[^>]*>([\s\S]*?)<\/OPENINGRATE>/i),
        ];
        let rate = 0;
        for (const m of rateCandidates) {
            if (m) { const r = extractRate(m[1]); if (r > 0) { rate = r; break; } }
        }

        // Parse GST from GSTDETAILS.LIST if present
        let gst = 18; // Default fallback to 18% as in backend schema
        const gstDetailsMatch = block.match(/<GSTDETAILS.LIST[^>]*>([\s\S]*?)<\/GSTDETAILS.LIST>/i);
        if (gstDetailsMatch) {
            const gstBlock = gstDetailsMatch[1];
            // Find RATEDETAILS.LIST that contains IGST
            const rateDetailsBlocks = gstBlock.split(/<RATEDETAILS.LIST[^>]*>/gi);
            for (let j = 1; j < rateDetailsBlocks.length; j++) {
                const rateBlock = rateDetailsBlocks[j];
                if (rateBlock.toLowerCase().includes('igst')) {
                    const rateValMatch = rateBlock.match(/<GSTRATE[^>]*>([\s\S]*?)<\/GSTRATE>/i);
                    if (rateValMatch) {
                        const parsedGst = parseFloat(rateValMatch[1].trim());
                        if (!isNaN(parsedGst) && parsedGst > 0) {
                            gst = parsedGst;
                            break;
                        }
                    }
                }
            }
        }

        items.push({ name, uom, unit: uom, stock, rate, gst });
    }
    return items;
}

function parseLedgersFromXml(xml) {
    const ledgers = [];
    if (!xml) return ledgers;
    const blocks = xml.split(/<LEDGER\b/gi);
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        // Try NAME attribute first (e.g. NAME="Party"), then strict <NAME> child element
        // Do NOT use /<NAME[^>]*>/ — it also matches <NAME.LIST> which wraps names in some Tally versions
        const nameAttrMatch = block.match(/^\s*NAME="([^"]+)"/i);
        const nameTagMatch  = block.match(/<NAME>([\s\S]*?)<\/NAME>/i);
        const rawName = nameAttrMatch ? nameAttrMatch[1] : (nameTagMatch ? nameTagMatch[1] : null);
        if (!rawName) continue;
        const partyName = cleanTallyName(unescapeXML(rawName.trim()));
        if (!partyName) continue;

        const parentMatch = block.match(/<PARENT[^>]*>([\s\S]*?)<\/PARENT>/i);
        const parent = parentMatch ? unescapeXML(parentMatch[1].trim()) : '';
        const gstinMatch = block.match(/<PARTYGSTIN[^>]*>([\s\S]*?)<\/PARTYGSTIN>/i);
        const gstin = gstinMatch ? unescapeXML(gstinMatch[1].trim()) : '';

        // parse closing balance and flip the sign: Debit is negative in Tally XML, but positive (receivable) in DB
        const balMatch = block.match(/<CLOSINGBALANCE[^>]*>([\s\S]*?)<\/CLOSINGBALANCE>/i);
        let balance = 0;
        if (balMatch) {
            const rawBal = unescapeXML(balMatch[1].trim());
            const num = parseFloat(rawBal.replace(/[^\d.-]/g, ''));
            if (!isNaN(num)) {
                balance = -num; // Flip sign: Tally Dr (-) -> DB Dr (+); Tally Cr (+) -> DB Cr (-)
            }
        }

        ledgers.push({ partyName, parent, gstin, balance });
    }
    return ledgers;
}

async function syncTallyInventoryAndParties(companyName, taskId) {
    try {
        console.log(`\n[SYNC-TD] 🔄 Fetching inventory and parties from Tally for "${companyName}"...`);
        const stockXml = await getStockItemList(companyName);
        const stockItems = parseStockItemsFromXml(stockXml);
        console.log(`[SYNC-TD]   • Found ${stockItems.length} stock items in Tally.`);

        const ledgerXml = await getLedgerList(companyName);
        const ledgers = parseLedgersFromXml(ledgerXml);
        // Filter ledgers belonging to party groups (e.g. Sundry Debtors, Sundry Creditors) or cash/bank
        const parties = ledgers.filter(l => 
            ['sundry debtors', 'sundry creditors', 'cash'].includes(l.parent.toLowerCase()) ||
            l.partyName.toLowerCase().includes('cash')
        );
        console.log(`[SYNC-TD]   • Found ${parties.length} party ledgers (Sundry Debtors/Creditors/Cash) in Tally.`);

        console.log(`[SYNC-TD] Sending data to website...`);
        await axios.post(`${CONFIG.BACKEND_URL}/api/entries/sync-tally-data-ingest`, {
            taskId,
            companyName,
            stockItems,
            parties
        }, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        console.log(`[SYNC-TD] ✅ Data synced successfully to website!`);
    } catch (e) {
        console.error(`[SYNC-TD] ❌ Failed: ${e.message}`);
        throw e;
    }
}

async function checkPendingInventorySyncs() {
    try {
        const res = await axios.get(`${CONFIG.BACKEND_URL}/api/inventory/sync-requests`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        const pendingUsers = res.data || [];
        for (const user of pendingUsers) {
            const companyName = user.companyName;
            if (!companyName) continue;
            console.log(`\n[SYNC-INV] 🔄 Received pending inventory sync request for "${companyName}"...`);
            try {
                const resolvedName = await resolveCompanyName(companyName);
                const stockXml = await getStockItemList(resolvedName);
                const stockItems = parseStockItemsFromXml(stockXml);
                console.log(`[SYNC-INV]   • Found ${stockItems.length} stock items in Tally.`);
                
                console.log(`[SYNC-INV] Sending inventory data to website...`);
                const completeRes = await axios.post(`${CONFIG.BACKEND_URL}/api/inventory/sync-complete`, {
                    companyName,
                    items: stockItems
                }, {
                    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
                });
                console.log(`[SYNC-INV] ✅ ${completeRes.data.message || 'Inventory sync complete!'}`);
            } catch (e) {
                console.error(`[SYNC-INV] ❌ Failed: ${e.message}`);
                try {
                    await axios.post(`${CONFIG.BACKEND_URL}/api/inventory/sync-fail`, {
                        companyName,
                        error: e.message
                    }, {
                        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
                    });
                    console.log(`[SYNC-INV] Reported failure to backend.`);
                } catch (failErr) {
                    console.error(`[SYNC-INV] Failed to report failure: ${failErr.message}`);
                }
            }
        }
    } catch (err) {
        console.error(`[SYNC-INV] Error checking pending inventory syncs: ${err.message}`);
    }
}

async function checkPendingLedgerSyncs() {
    try {
        const res = await axios.get(`${CONFIG.BACKEND_URL}/api/ledger/sync-requests`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        const pendingUsers = res.data || [];
        for (const user of pendingUsers) {
            const companyName = user.companyName;
            if (!companyName) continue;
            console.log(`\n[SYNC-LEDG] 🔄 Received pending ledger sync request for "${companyName}"...`);
            try {
                const resolvedName = await resolveCompanyName(companyName);
                const ledgerXml = await getLedgerList(resolvedName);
                const ledgers = parseLedgersFromXml(ledgerXml);
                
                const parties = ledgers.filter(l => 
                    ['sundry debtors', 'sundry creditors', 'cash'].includes(l.parent.toLowerCase()) ||
                    l.partyName.toLowerCase().includes('cash')
                );
                console.log(`[SYNC-LEDG]   • Found ${parties.length} party ledgers (Sundry Debtors/Creditors/Cash) out of ${ledgers.length} total.`);
                
                console.log(`[SYNC-LEDG] Sending ledger data to website...`);
                const completeRes = await axios.post(`${CONFIG.BACKEND_URL}/api/ledger/sync-complete`, {
                    companyName,
                    ledgers: parties
                }, {
                    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
                });
                console.log(`[SYNC-LEDG] ✅ Ledger sync complete!`);
            } catch (e) {
                console.error(`[SYNC-LEDG] ❌ Failed: ${e.message}`);
                try {
                    await axios.post(`${CONFIG.BACKEND_URL}/api/ledger/sync-fail`, {
                        companyName,
                        error: e.message
                    }, {
                        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
                    });
                    console.log(`[SYNC-LEDG] Reported failure to backend.`);
                } catch (failErr) {
                    console.error(`[SYNC-LEDG] Failed to report failure: ${failErr.message}`);
                }
            }
        }
    } catch (err) {
        console.error(`[SYNC-LEDG] Error checking pending ledger syncs: ${err.message}`);
    }
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────

async function run() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  TALLYSYNC AGENT  v6.0 — Invoice Mode    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('[DEBUG] Checking for zombie variables...');
    try { console.log('partyDeemed check:', typeof partyDeemed); } catch(e) { console.log('partyDeemed is correctly undefined in JS scope.'); }

    await login();

    while (true) {
        try {
            // Check for pending sync requests (e.g. fetching inventory/parties from Tally to Cloud)
            await checkPendingInventorySyncs();
            await checkPendingLedgerSyncs();

            // Check for pending sync tasks (e.g. fetching inventory/parties from Tally to Cloud via legacy endpoint)
            try {
                const taskRes = await axios.get(`${CONFIG.BACKEND_URL}/api/entries/pending-sync-tasks`, {
                    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
                });
                const tasks = taskRes.data || [];
                for (const task of tasks) {
                    if (task.type === 'sync_inventory_parties') {
                        await syncTallyInventoryAndParties(task.companyName, task._id);
                    }
                }
            } catch (err) {
                // Silently ignore if endpoint doesn't exist yet on the website
            }

            // Fetch all entries and filter pending ones
            const res = await axios.get(`${CONFIG.BACKEND_URL}/api/entries`, {
                headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
            });
            const queue = (res.data || []).filter(e => e.status === 'pending');

            if (queue.length === 0) {
                process.stdout.write(`\r[QUEUE] No pending bills. Next check in ${CONFIG.POLL_INTERVAL/1000}s...`);
                await new Promise(r => setTimeout(r, CONFIG.POLL_INTERVAL));
                continue;
            }

            // Group by company for display
            const groups = {};
            queue.forEach(e => {
                const name = e.companyName || 'Unknown';
                groups[name] = (groups[name] || 0) + 1;
            });
            // Group bills by company
            const companyGroups = {};
            queue.forEach(e => {
                const name = e.companyName || 'Unknown';
                if (!companyGroups[name]) companyGroups[name] = [];
                companyGroups[name].push(e);
            });

            console.log('\n\nPENDING BILLS BY COMPANY:');
            Object.entries(companyGroups).forEach(([name, bills]) => console.log(`  • ${name} → ${bills.length} bill(s)`));

            // Detect currently active Tally company for logging
            const activeCompany = await getActiveCompany();
            if (activeCompany) console.log(`[TALLY] Current Focus: "${activeCompany}"`);

            // Process each company
            for (const [companyName, bills] of Object.entries(companyGroups)) {
                if (companyName === 'Unknown') continue;
                
                console.log(`\n[PROCESS] Checking company: "${companyName}"...`);
                
                // We try to sync for this company. 
                // The Tally XMLs already include <SVCURRENTCOMPANY>, 
                // so Tally will switch context if the company is open.
                
                for (const entry of bills) {
                    await syncEntry(entry);
                }
            }
            
            console.log('\n[PROCESS] Cycle complete.');
            await new Promise(r => setTimeout(r, CONFIG.POLL_INTERVAL));
            await new Promise(r => setTimeout(r, CONFIG.POLL_INTERVAL));

        } catch (error) {
            console.error(`[LOOP] Fatal: ${error.message}`);
            await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY));
        }
    }
}

run();

module.exports = { generateInventoryVoucherXML, generateAccountingVoucherXML };
