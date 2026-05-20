import React, { forwardRef } from 'react';
import { formatCurrency } from '../utils/format';

export interface InvoiceData {
  type: string;
  partyName: string;
  invoiceNumber: string;
  date: string;
  items: any[];
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  companyName: string;
  gstType?: string;
  partyGstin?: string;
}

interface Props {
  data: InvoiceData;
  user?: any;
}

const PrintableInvoice = forwardRef<HTMLDivElement, Props>(({ data, user }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white text-black min-h-full font-sans">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
        <div>
          <h1 className="text-4xl font-black mb-2">{data.companyName || user?.companyName || 'Company Name'}</h1>
          <p className="text-sm text-slate-600 font-bold uppercase tracking-widest">
            {data.type === 'sales' ? 'Tax Invoice' : 'Purchase Voucher'}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="text-xl font-bold uppercase text-slate-800">Invoice: {data.invoiceNumber || '----'}</div>
          <div className="text-sm text-slate-500 font-mono">Date: {data.date}</div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">Billed To</h3>
          <div className="text-lg font-bold text-slate-800">{data.partyName || 'Party Name'}</div>
        </div>
      </div>

      <table className="w-full mb-8 border border-slate-300">
        <thead>
          <tr className="bg-slate-100 text-xs font-bold uppercase tracking-widest text-slate-600">
            <th className="py-3 px-4 text-left border-b border-slate-300 w-12">#</th>
            <th className="py-3 px-4 text-left border-b border-slate-300">Item Description</th>
            <th className="py-3 px-4 text-center border-b border-slate-300">Rate</th>
            <th className="py-3 px-4 text-center border-b border-slate-300">Qty</th>
            <th className="py-3 px-4 text-center border-b border-slate-300">GST %</th>
            <th className="py-3 px-4 text-right border-b border-slate-300">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {data.items.filter(i => i.name).map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 px-4 border-r border-slate-200 text-slate-500">{idx + 1}</td>
              <td className="py-3 px-4 border-r border-slate-200 font-bold text-slate-800">{item.name}</td>
              <td className="py-3 px-4 border-r border-slate-200 text-center font-mono">{formatCurrency(item.rate)}</td>
              <td className="py-3 px-4 border-r border-slate-200 text-center font-mono">{item.quantity}</td>
              <td className="py-3 px-4 border-r border-slate-200 text-center font-mono">{item.gst || 18}%</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          {data.items.filter(i => i.name).length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">No items added to this invoice.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end mb-8">
        <div className="w-1/2 space-y-3">
          <div className="flex justify-between items-center text-sm font-medium text-slate-600 px-4">
            <span>Taxable Amount</span>
            <span className="font-mono">{formatCurrency(data.taxableAmount)}</span>
          </div>
          {data.gstType === 'igst' ? (
            <div className="flex justify-between items-center text-sm font-medium text-slate-600 px-4">
              <span>IGST</span>
              <span className="font-mono">{formatCurrency(data.taxAmount)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-sm font-medium text-slate-600 px-4">
                <span>CGST</span>
                <span className="font-mono">{formatCurrency(data.taxAmount / 2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium text-slate-600 px-4">
                <span>SGST</span>
                <span className="font-mono">{formatCurrency(data.taxAmount / 2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center text-lg font-black text-slate-900 border-t-2 border-slate-900 pt-3 px-4">
            <span>Grand Total</span>
            <span className="font-mono">{formatCurrency(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      {data.notes && (
        <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</h4>
          <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-slate-200 text-center flex justify-between px-12">
        <div className="space-y-12">
          <div className="border-b-2 border-slate-300 w-48"></div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Customer Signature</div>
        </div>
        <div className="space-y-12">
          <div className="border-b-2 border-slate-300 w-48 text-right"></div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
});

export default PrintableInvoice;
