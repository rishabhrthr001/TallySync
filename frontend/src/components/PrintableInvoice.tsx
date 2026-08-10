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
  const companyGstin = data?.companyGstin || user?.gstin || '07AAAAA0000A1Z5';
  const companyPhone = data?.companyPhone || user?.phone || '';
  const companyAddress = data?.companyAddress || user?.address || '';
  const partyAddress = data?.partyAddress || (data as any)?.address || '';

  const isSales = data?.type === 'sales';
  const titleBadge = isSales ? 'TAX INVOICE' : 'PURCHASE VOUCHER';

  const validItems = Array.isArray(data?.items) && data.items.filter(i => i.name || i.description).length > 0
    ? data.items.filter(i => i.name || i.description)
    : [{
        name: data?.partyName ? `Bill / Voucher Entry - ${data.partyName}` : 'General Supply Item',
        quantity: 1,
        rate: data?.taxableAmount || (data?.totalAmount ? Number((data.totalAmount / 1.18).toFixed(2)) : 0),
        amount: data?.totalAmount || 0,
        gst: 18,
        hsn: '9983'
      }];

  const taxable = data?.taxableAmount || Number((data?.totalAmount ? data.totalAmount / 1.18 : 0).toFixed(2));
  const taxVal = data?.taxAmount || Number((data?.totalAmount ? data.totalAmount - taxable : 0).toFixed(2));
  const grandTotal = data?.totalAmount || Number((taxable + taxVal).toFixed(2));
  const isIgst = data?.gstType === 'igst';

  return (
    <div ref={ref} className="p-8 sm:p-10 bg-white text-slate-900 font-sans min-h-full leading-normal text-sm border border-slate-200 shadow-sm print:shadow-none print:border-none">
      {/* Top Invoice Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6 gap-6">
        <div className="space-y-1 max-w-lg">
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
            {companyName}
          </div>
          {companyAddress && (
            <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-line">
              {companyAddress}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-extrabold text-slate-800 pt-1">
            {companyGstin && <span>GSTIN: <span className="font-mono text-slate-900">{companyGstin}</span></span>}
            {companyPhone && <span>Mob: <span className="font-mono">{companyPhone}</span></span>}
          </div>
        </div>

        <div className="text-right space-y-2 shrink-0">
          <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest">
            {titleBadge}
          </div>
          <div className="space-y-1">
            <div className="text-base font-black text-slate-900 font-mono">
              Invoice No: <span className="text-indigo-900">{data?.invoiceNumber || 'INV-2026-001'}</span>
            </div>
            <div className="text-xs font-bold text-slate-600">
              Date: <span className="font-mono text-slate-900">{data?.date || new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To Card (Without Dispatch Details) */}
      <div className="mb-6">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block border-b border-slate-200 pb-1 mb-2">
            Billed To (Buyer)
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{data?.partyName || 'Cash Customer'}</h3>
              {partyAddress && (
                <p className="text-xs text-slate-600 font-medium mt-0.5 whitespace-pre-line">{partyAddress}</p>
              )}
            </div>
            {data?.partyGstin && (
              <div className="text-xs font-bold text-slate-700 sm:text-right shrink-0">
                GSTIN / UIN: <span className="font-mono font-extrabold text-slate-900">{data.partyGstin}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="border border-slate-300 rounded-2xl overflow-hidden mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center border-r border-slate-800">#</th>
              <th className="py-3 px-4 border-r border-slate-800">Item Description</th>
              <th className="py-3 px-3 w-20 text-center border-r border-slate-800">HSN</th>
              <th className="py-3 px-3 w-16 text-center border-r border-slate-800">Qty</th>
              <th className="py-3 px-4 w-28 text-right border-r border-slate-800">Rate (₹)</th>
              <th className="py-3 px-3 w-16 text-center border-r border-slate-800">GST %</th>
              <th className="py-3 px-4 w-32 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
            {validItems.map((item, idx) => {
              const qty = item.quantity || 1;
              const rate = item.rate || (item.amount ? item.amount / qty : 0);
              const amt = item.amount || (rate * qty);
              const gst = item.gst || 18;
              return (
                <tr key={idx} className="even:bg-slate-50/60">
                  <td className="py-3.5 px-3 text-center border-r border-slate-200 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3.5 px-4 border-r border-slate-200 font-bold text-slate-900">
                    {item.name || item.description}
                  </td>
                  <td className="py-3.5 px-3 text-center border-r border-slate-200 font-mono text-slate-500">{item.hsn || '9983'}</td>
                  <td className="py-3.5 px-3 text-center border-r border-slate-200 font-mono font-bold">{qty}</td>
                  <td className="py-3.5 px-4 text-right border-r border-slate-200 font-mono">{formatCurrency(rate)}</td>
                  <td className="py-3.5 px-3 text-center border-r border-slate-200 font-mono text-slate-600">{gst}%</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">{formatCurrency(amt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tax Calculation & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-start">
        {/* Left Side: Invoice Amount in Words & Notes */}
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">
              Invoice Amount in Words
            </span>
            <p className="text-xs font-extrabold text-indigo-950 capitalize italic">
              {numberToWordsINR(grandTotal)}
            </p>
          </div>

          {data?.notes && (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Terms & Remarks
              </span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Right Side: Detailed Tax Calculation Box */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-300 space-y-2.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>Taxable Amount</span>
            <span className="font-mono text-slate-900">{formatCurrency(taxable)}</span>
          </div>

          {isIgst ? (
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>Integrated Tax (IGST 18%)</span>
              <span className="font-mono text-slate-900">{formatCurrency(taxVal)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>Central Tax (CGST 9%)</span>
                <span className="font-mono text-slate-900">{formatCurrency(taxVal / 2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>State Tax (SGST 9%)</span>
                <span className="font-mono text-slate-900">{formatCurrency(taxVal / 2)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between items-center text-xs font-bold text-slate-600 border-t border-slate-200 pt-2">
            <span>Total Tax Amount</span>
            <span className="font-mono text-slate-900">{formatCurrency(taxVal)}</span>
          </div>

          <div className="flex justify-between items-center text-base font-black text-slate-900 border-t-2 border-slate-900 pt-3">
            <span className="uppercase tracking-wider">Grand Total</span>
            <span className="font-mono text-xl text-indigo-900">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="pt-12 border-t border-slate-200 flex justify-between items-end px-4 mt-auto">
        <div className="text-center space-y-8">
          <div className="border-b-2 border-slate-300 w-44 mx-auto"></div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Signature</div>
        </div>

        <div className="text-center space-y-8">
          <div className="text-xs font-bold text-slate-700 uppercase">For {companyName}</div>
          <div className="border-b-2 border-slate-300 w-48 mx-auto"></div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
});

export default PrintableInvoice;
