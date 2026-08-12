import React, { forwardRef } from 'react';
import { formatCurrency } from '../utils/format';

export interface InvoiceItem {
  name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  gst?: number;
  hsn?: string;
  unit?: string;
}

export interface InvoiceData {
  type: string;
  partyName: string;
  partyGstin?: string;
  partyAddress?: string;
  invoiceNumber: string;
  date: string;
  items: InvoiceItem[];
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  companyName: string;
  companyGstin?: string;
  companyPhone?: string;
  companyAddress?: string;
  gstType?: string;
}

interface Props {
  data: InvoiceData;
  user?: any;
}

function numberToWordsINR(amount: number): string {
  const num = Math.floor(amount);
  if (num === 0) return 'Rupees Zero Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str;
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;

  if (crore > 0) words += convertChunk(crore) + 'Crore ';
  if (lakh > 0) words += convertChunk(lakh) + 'Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + 'Thousand ';
  if (rem > 0) words += convertChunk(rem);

  return `Rupees ${words.trim()} Only`;
}

const PrintableInvoice = forwardRef<HTMLDivElement, Props>(({ data, user }, ref) => {
  const companyName = data?.companyName || user?.companyName || user?.name || 'PHOTO BILL ENTERPRISES';
  const companyGstin = data?.companyGstin || user?.gstin || '';
  const companyPhone = data?.companyPhone || user?.phone || '';
  const companyAddress = data?.companyAddress || user?.address || '';
  const partyAddress = data?.partyAddress || (data as any)?.address || '';

  const isSales = data?.type === 'sales';
  const titleBadge = isSales ? 'TAX INVOICE' : 'PURCHASE VOUCHER';

  const grandTotal = Number(data?.totalAmount || 0);
  let taxable = Number(data?.taxableAmount || 0);
  let taxVal = Number(data?.taxAmount || 0);

  if (taxable === 0 && grandTotal > 0) {
    taxable = Number((grandTotal / 1.18).toFixed(2));
    taxVal = Number((grandTotal - taxable).toFixed(2));
  } else if (taxVal === 0 && grandTotal > taxable) {
    taxVal = Number((grandTotal - taxable).toFixed(2));
  }

  const isIgst = data?.gstType === 'igst';
  const effectiveGstRate = taxable > 0 && taxVal > 0 ? Math.round((taxVal / taxable) * 100) : 18;

  const validItems = Array.isArray(data?.items) && data.items.filter(i => (i.name || i.description || i.amount)).length > 0
    ? data.items.filter(i => (i.name || i.description || i.amount))
    : [{
        name: data?.partyName ? `Supply of Goods / Services (${isSales ? 'Sales' : 'Purchase'})` : 'Taxable Supply',
        quantity: 1,
        rate: taxable,
        amount: taxable,
        gst: effectiveGstRate,
        hsn: '9983',
        unit: 'NOS'
      }];

  return (
    <div 
      ref={ref} 
      className="printable-invoice-container w-full max-w-[850px] mx-auto bg-white text-slate-900 font-sans p-6 sm:p-8 border border-slate-300 rounded-2xl shadow-sm leading-normal text-xs sm:text-sm"
      style={{
        colorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .printable-invoice-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Invoice Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4 gap-4">
        <div className="space-y-1 max-w-[60%]">
          <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
            {companyName}
          </div>
          {companyAddress && (
            <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-line">
              {companyAddress}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-800 pt-0.5">
            {companyGstin && <span>GSTIN: <span className="font-mono font-black text-slate-950">{companyGstin}</span></span>}
            {companyPhone && <span>Phone: <span className="font-mono font-bold text-slate-900">{companyPhone}</span></span>}
          </div>
        </div>

        <div className="text-right space-y-2 shrink-0">
          <div className="inline-block px-3 py-1 bg-slate-950 text-white rounded-md text-xs font-black uppercase tracking-widest">
            {titleBadge}
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="font-black text-slate-950 font-mono">
              Invoice No: <span className="text-indigo-900 font-extrabold">{data?.invoiceNumber || 'INV-001'}</span>
            </div>
            <div className="font-bold text-slate-700">
              Date: <span className="font-mono text-slate-950">{data?.date || new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To / Party Details */}
      <div className="mb-4">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-250 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block border-b border-slate-200 pb-0.5 mb-1">
            {isSales ? 'Billed To (Customer / Buyer)' : 'Supplier / Vendor Details'}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h3 className="text-sm font-black text-slate-950">{data?.partyName || 'Cash Customer'}</h3>
              {partyAddress && (
                <p className="text-xs text-slate-600 font-medium mt-0.5 whitespace-pre-line">{partyAddress}</p>
              )}
            </div>
            {data?.partyGstin && (
              <div className="text-xs font-bold text-slate-800 sm:text-right shrink-0">
                Party GSTIN: <span className="font-mono font-black text-slate-950">{data.partyGstin}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="border border-slate-300 rounded-xl overflow-hidden mb-4 avoid-break">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-wider">
              <th className="py-2.5 px-2.5 w-8 text-center border-r border-slate-800">#</th>
              <th className="py-2.5 px-3 border-r border-slate-800">Item Description</th>
              <th className="py-2.5 px-2.5 w-16 text-center border-r border-slate-800">HSN</th>
              <th className="py-2.5 px-2.5 w-16 text-center border-r border-slate-800">Qty</th>
              <th className="py-2.5 px-3 w-24 text-right border-r border-slate-800">Rate (₹)</th>
              <th className="py-2.5 px-2.5 w-14 text-center border-r border-slate-800">GST</th>
              <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-semibold text-slate-850">
            {validItems.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const rate = Number(item.rate || (item.amount ? item.amount / qty : 0));
              const amt = Number(item.amount || (rate * qty));
              const gst = Number(item.gst || 18);
              return (
                <tr key={idx} className="even:bg-slate-50/70">
                  <td className="py-2.5 px-2.5 text-center border-r border-slate-200 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-950">
                    {item.name || item.description || 'Item'}
                  </td>
                  <td className="py-2.5 px-2.5 text-center border-r border-slate-200 font-mono text-slate-600">{item.hsn || '9983'}</td>
                  <td className="py-2.5 px-2.5 text-center border-r border-slate-200 font-mono font-bold">{qty} {item.unit || ''}</td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono">{formatCurrency(rate)}</td>
                  <td className="py-2.5 px-2.5 text-center border-r border-slate-200 font-mono text-slate-700">{gst}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">{formatCurrency(amt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tax Calculation & Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 items-start avoid-break">
        {/* Left Side: Invoice Amount in Words & Notes */}
        <div className="space-y-3">
          <div className="p-3 bg-indigo-50/60 border border-indigo-150 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 block mb-0.5">
              Invoice Amount in Words
            </span>
            <p className="text-xs font-black text-indigo-950 capitalize italic leading-snug">
              {numberToWordsINR(grandTotal)}
            </p>
          </div>

          {data?.notes && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Notes</span>
              <p className="font-medium leading-tight">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Right Side: Detailed Tax Calculation Box */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-1.5 text-xs">
          <div className="flex justify-between items-center font-bold text-slate-700">
            <span>Taxable Amount</span>
            <span className="font-mono font-extrabold text-slate-950">{formatCurrency(taxable)}</span>
          </div>

          {isIgst ? (
            <div className="flex justify-between items-center font-bold text-slate-700">
              <span>Integrated Tax (IGST {effectiveGstRate}%)</span>
              <span className="font-mono font-extrabold text-slate-950">{formatCurrency(taxVal)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center font-bold text-slate-700">
                <span>Central Tax (CGST {(effectiveGstRate / 2).toFixed(1)}%)</span>
                <span className="font-mono font-extrabold text-slate-950">{formatCurrency(taxVal / 2)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-slate-700">
                <span>State Tax (SGST {(effectiveGstRate / 2).toFixed(1)}%)</span>
                <span className="font-mono font-extrabold text-slate-950">{formatCurrency(taxVal / 2)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between items-center font-bold text-slate-700 border-t border-slate-200 pt-1">
            <span>Total GST Amount</span>
            <span className="font-mono font-extrabold text-slate-950">{formatCurrency(taxVal)}</span>
          </div>

          <div className="flex justify-between items-center text-sm font-black text-slate-950 border-t-2 border-slate-950 pt-2">
            <span className="uppercase tracking-wider">Grand Total</span>
            <span className="font-mono text-base font-black text-indigo-950">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="pt-6 border-t border-slate-200 flex justify-between items-end px-2 avoid-break">
        <div className="text-center space-y-3">
          <div className="border-b-2 border-slate-400 w-32 sm:w-40 mx-auto"></div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Customer Signature</div>
        </div>

        <div className="text-center space-y-3">
          <div className="text-xs font-black text-slate-900 uppercase">For {companyName}</div>
          <div className="border-b-2 border-slate-400 w-36 sm:w-44 mx-auto"></div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
});

export default PrintableInvoice;
