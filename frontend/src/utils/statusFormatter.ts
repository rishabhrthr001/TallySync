/**
 * Transforms raw / cryptic Tally sync errors and pending states into crystal-clear, human-friendly messages.
 */
export function formatVoucherStatusMessage(status?: string, syncError?: string, reason?: string): {
  headline: string;
  detail: string;
  hint?: string;
  badgeText: string;
} {
  if (status === 'success') {
    return {
      headline: 'Synced with Tally',
      detail: 'Voucher successfully recorded in Tally Prime.',
      badgeText: 'Synced'
    };
  }

  if (status === 'pending') {
    return {
      headline: 'Waiting for Tally Sync',
      detail: reason || 'Queued in PhotoBill. Running Tally Agent on your computer will automatically post this into Tally Prime.',
      hint: 'Ensure Tally Agent is running on your Tally PC.',
      badgeText: 'Pending'
    };
  }

  // Failed status
  const raw = (syncError || reason || '').toLowerCase();

  if (raw.includes('does not exist') || raw.includes('ledger') || raw.includes('not found')) {
    // Extract ledger name if present
    const match = (syncError || '').match(/Ledger '([^']+)'/i) || (syncError || '').match(/ledger\s+([^\s]+)/i);
    const ledgerName = match ? match[1] : '';
    return {
      headline: ledgerName ? `Ledger "${ledgerName}" missing in Tally` : 'Party Ledger Not Found in Tally',
      detail: ledgerName 
        ? `The ledger "${ledgerName}" does not exist in your active Tally company.` 
        : 'The party or account ledger was not found in your active Tally company master.',
      hint: 'Create this ledger in Tally Prime, then click Retry.',
      badgeText: 'Ledger Missing'
    };
  }

  if (raw.includes('econnrefused') || raw.includes('connection refused') || raw.includes('timeout') || raw.includes('connect')) {
    return {
      headline: 'Cannot Connect to Tally Prime',
      detail: 'Tally Prime application is not reachable or port 9000 is closed.',
      hint: 'Open Tally Prime on your PC with your company loaded.',
      badgeText: 'Connection Error'
    };
  }

  if (raw.includes('date') || raw.includes('financial year') || raw.includes('period') || raw.includes('out of')) {
    return {
      headline: 'Voucher Date Outside Financial Year',
      detail: 'The invoice date is outside the currently active accounting period in Tally.',
      hint: 'Change the current period in Tally (Alt+F2) to include this date.',
      badgeText: 'Date Mismatch'
    };
  }

  if (raw.includes('duplicate') || raw.includes('already exists') || raw.includes('voucher number')) {
    return {
      headline: 'Duplicate Invoice Number in Tally',
      detail: 'A voucher with this exact invoice/reference number already exists in Tally.',
      hint: 'Check your Tally daybook or update the invoice number.',
      badgeText: 'Duplicate'
    };
  }

  if (raw.includes('stock') || raw.includes('item') || raw.includes('negative stock') || raw.includes('insufficient')) {
    return {
      headline: 'Stock Item or Quantity Issue in Tally',
      detail: 'One or more items in this bill are missing from Tally stock masters or have insufficient stock.',
      hint: 'Check your Tally Stock Item masters and inventory levels.',
      badgeText: 'Stock Issue'
    };
  }

  if (raw.includes('company') || raw.includes('no company')) {
    return {
      headline: 'No Active Company in Tally',
      detail: 'No company is currently opened in Tally Prime, or the company name does not match.',
      hint: 'Select and open your company in Tally Prime.',
      badgeText: 'Company Closed'
    };
  }

  if (raw.includes('tax') || raw.includes('gst') || raw.includes('cgst') || raw.includes('sgst') || raw.includes('igst')) {
    return {
      headline: 'GST Tax Ledger Mismatch in Tally',
      detail: 'The required GST duty ledgers (CGST / SGST / IGST) were not found in Tally.',
      hint: 'Ensure standard GST Duty ledgers exist in Tally.',
      badgeText: 'Tax Ledger Missing'
    };
  }

  // Clean XML tags and line breaks
  const cleanError = (syncError || reason || 'Tally rejected voucher creation')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    headline: cleanError.length > 50 ? `${cleanError.slice(0, 48)}...` : cleanError,
    detail: cleanError,
    hint: 'Check your Tally Prime configuration and click Retry.',
    badgeText: 'Sync Error'
  };
}
