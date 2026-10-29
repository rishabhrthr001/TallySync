import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
  Search, Download, ExternalLink, RefreshCcw, CheckCircle2, Clock, XCircle, ChevronRight, TrendingUp, TrendingDown, Printer, Filter, X, RotateCcw, Package, AlertTriangle
} from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import PrintableInvoice from '../components/PrintableInvoice';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';
import { formatVoucherStatusMessage } from '../utils/statusFormatter';
import { useSearchParams } from 'react-router-dom';

const Entries: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [withItems, setWithItems] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const defaultPrintData = {
    type: 'sales',
    partyName: 'Customer',
    partyGstin: '',
    invoiceNumber: 'INV-000',
    date: new Date().toISOString().split('T')[0],
    items: [],
    taxableAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    gstType: 'cgst-sgst',
    notes: '',
    companyName: user?.companyName || 'Company'
  };

  const [printData, setPrintData] = useState<any>(defaultPrintData);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [shouldPrint, setShouldPrint] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintAction = useReactToPrint({
    contentRef: printRef
  });

  // Trigger actual print only after printData is set and component re-renders
  useEffect(() => {
    if (shouldPrint && printData) {
      setShouldPrint(false);
      setTimeout(() => {
        handlePrintAction();
      }, 100);
    }
  }, [shouldPrint, printData]);

  const fetchEntries = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await axios.get('/api/entries', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEntries(res.data || []);
    } catch (err) {
      console.error('Error fetching entries', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // Live background auto-polling every 3.5s to track Tally sync success / failure / retry automatically
    const interval = setInterval(() => {
      fetchEntries(true);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const triggerPrint = (entry: any) => {
    const tot = Number(entry.totalAmount || 0);
    const taxableVal = Number(entry.taxableAmount || (tot > 0 ? Number((tot / 1.18).toFixed(2)) : 0));
    const taxVal = Number(entry.taxAmount || (tot > 0 ? Number((tot - taxableVal).toFixed(2)) : 0));

    const itemsArr = Array.isArray(entry.items) && entry.items.length > 0
      ? entry.items
      : [{ 
          name: entry.partyName ? `Supply - ${entry.partyName}` : 'Taxable Item Supply', 
          quantity: 1, 
          rate: taxableVal, 
          amount: taxableVal,
          gst: 18
        }];

    setPrintData({
      type: entry.type || 'sales',
      partyName: entry.partyName || 'Cash Customer',
      partyGstin: entry.partyGstin || '',
      invoiceNumber: entry.invoiceNumber || 'INV-000',
      date: entry.date,
      items: itemsArr,
      taxableAmount: taxableVal,
      taxAmount: taxVal,
      totalAmount: tot,
      gstType: entry.gstType || 'cgst-sgst',
      notes: entry.notes || '',
      companyName: user?.companyName || 'PhotoBill Enterprises'
    });
    setIsPrintModalOpen(true);
  };

  const handleRetryEntry = async (id: string) => {
    setRetryingId(id);
    try {
      await axios.post(`/api/entries/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('Entry re-queued for Tally agent sync!', 'success');
      setEntries(prev => prev.map(e => e._id === id ? { ...e, status: 'pending', syncError: '' } : e));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to re-queue entry', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const successCount = entries.filter(e => e.status === 'success').length;
  const failedCount = entries.filter(e => e.status === 'failed').length;
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  const filteredEntries = entries.filter(e => {
    const itemMatch = Array.isArray(e.items) && e.items.some((i: any) => 
      (i.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesSearch = (e.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          itemMatch;
    
    let matchesDate = true;
    if (dateFrom) matchesDate = matchesDate && e.date >= dateFrom;
    if (dateTo) matchesDate = matchesDate && e.date <= dateTo;

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = e.status === statusFilter;
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <Layout>
      <div className="print-hidden-mobile">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">Audit History</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">Voucher History & Sync Status</h2>
            <p className="text-slate-400 text-sm font-semibold mt-0.5">Track live Tally sync success, view error reasons, and retry failed bills</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.open('https://ewaybillgst.gov.in/', '_blank')}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              E-Way Bill Portal
            </button>
            <button 
              onClick={() => fetchEntries()} 
              className="p-3 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              title="Refresh Entries"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] overflow-hidden">
          {/* Filters Header */}
          <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by Item Name, Party Name, or Invoice Ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* With / Without Items Toggle */}
              <div className="flex items-center bg-white p-1 border border-slate-200/80 rounded-2xl shadow-xs">
                <button
                  type="button"
                  onClick={() => setWithItems(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    withItems ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  With Items
                </button>
                <button
                  type="button"
                  onClick={() => setWithItems(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !withItems ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Summary Only
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200/80 rounded-2xl shadow-xs text-xs font-semibold text-slate-600 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>From</span>
                <input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent outline-none font-mono text-slate-800"
                />
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200/80 rounded-2xl shadow-xs text-xs font-semibold text-slate-600 w-full sm:w-auto">
                <span>To</span>
                <input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-transparent outline-none font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Sync Status Filter Bar with Live Counter */}
          <div className="px-5 py-3 border-b border-slate-150 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">Tally Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                All ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'success'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Synced ({successCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'failed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : failedCount > 0 
                      ? 'bg-rose-50 text-rose-700 border-2 border-rose-300 font-black animate-pulse'
                      : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Failed ({failedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pending ({pendingCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Auto-Sync
              </span>
            </div>
          </div>

          {/* Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-6">Voucher / Date</th>
                  <th className="py-4 px-6">Party Name</th>
                  <th className="py-4 px-6 text-center">Type</th>
                  {withItems && <th className="py-4 px-6">Item Details & Breakdown</th>}
                  <th className="py-4 px-6 text-right">Total Amount</th>
                  <th className="py-4 px-6 text-center w-60">Sync Status & Actions</th>
                  <th className="py-4 px-6 text-right">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                <AnimatePresence>
                  {filteredEntries.map((e, idx) => (
                    <motion.tr 
                      key={e._id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-5 align-top">
                        <div className="text-sm font-black text-slate-900 font-mono leading-tight">{e.invoiceNumber || 'NO-REF'}</div>
                        <div className="text-xs font-semibold text-slate-400 mt-1">{e.date}</div>
                        {e.companyName && (
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5 truncate max-w-[150px]" title={e.companyName}>
                            🏢 {e.companyName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="font-bold text-slate-900 text-sm">{e.partyName}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {e.partyGstin ? (
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {e.partyGstin}
                            </span>
                          ) : null}
                          {e.bankLedger && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/80">
                              🏦 {e.bankLedger}
                            </span>
                          )}
                          {e.notes && <span className="text-[11px] text-slate-400 truncate max-w-xs">{e.notes}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center align-top">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                          e.type === 'sales' ? 'bg-indigo-50 text-indigo-700' : 
                          e.type === 'purchase' ? 'bg-amber-50 text-amber-700' :
                          e.type === 'receipt' ? 'bg-emerald-50 text-emerald-700' :
                          e.type === 'payment' ? 'bg-rose-50 text-rose-700' :
                          e.type === 'contra' ? 'bg-purple-50 text-purple-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {e.type === 'sales' || e.type === 'receipt' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {e.type}
                        </span>
                      </td>
                      {withItems && (
                        <td className="px-6 py-4 align-top">
                          {e.items && e.items.length > 0 ? (
                            <div className="space-y-1.5 min-w-[240px] max-w-sm">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {e.items.length} Item{e.items.length > 1 ? 's' : ''}
                              </span>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {e.items.map((it: any, itIdx: number) => (
                                  <div key={itIdx} className="flex justify-between items-center text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                                    <span className="font-bold text-slate-800 truncate mr-2" title={it.name}>{it.name}</span>
                                    <span className="font-mono text-[11px] text-slate-600 font-bold whitespace-nowrap">
                                      {it.quantity} {it.unit || 'Nos'} × ₹{it.rate} = <strong className="text-slate-900">{formatCurrency(it.amount || it.quantity * it.rate)}</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No item details (Accounting Voucher)</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-5 text-right font-black text-slate-900 text-sm font-mono align-top">
                        <div>{formatCurrency(e.totalAmount || 0)}</div>
                        {e.taxableAmount > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium">Taxable: {formatCurrency(e.taxableAmount)}</div>
                        )}
                      </td>
                      <td className="px-6 py-5 align-top">
                        {(() => {
                          const info = formatVoucherStatusMessage(e.status, e.syncError, e.reason);
                          return (
                            <div className="flex flex-col items-center justify-center gap-1.5 max-w-[240px] mx-auto">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                                e.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs' : 
                                e.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs' : 
                                'bg-amber-50 text-amber-700 animate-pulse border border-amber-200 shadow-xs'
                              }`}>
                                {e.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5] text-emerald-600" /> : 
                                 e.status === 'failed' ? <XCircle className="h-3.5 w-3.5 stroke-[2.5] text-rose-600" /> : 
                                 <Clock className="h-3.5 w-3.5 stroke-[2.5] text-amber-600" />}
                                {e.status === 'success' ? 'Synced to Tally' : (e.status === 'failed' ? 'Sync Failed' : 'Syncing to Tally...')}
                              </span>

                              {/* Failure reason & Actionable Hint & Retry Button */}
                              {e.status === 'failed' && (
                                <div className="flex flex-col items-center gap-1 mt-1 w-full">
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 leading-tight break-words text-center w-full" title={info.detail}>
                                    {info.headline}
                                  </span>
                                  {info.hint && (
                                    <span className="text-[8.5px] font-medium text-slate-500 text-center leading-tight">
                                      💡 {info.hint}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleRetryEntry(e._id)}
                                    disabled={retryingId === e._id}
                                    className="inline-flex items-center gap-1 px-3 py-1 mt-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Re-queue entry for Tally sync"
                                  >
                                    <RotateCcw className={`h-2.5 w-2.5 ${retryingId === e._id ? 'animate-spin' : ''}`} />
                                    {retryingId === e._id ? 'Retrying...' : 'Retry Sync'}
                                  </button>
                                </div>
                              )}

                              {/* Pending reason & guidance */}
                              {e.status === 'pending' && (
                                <div className="flex flex-col items-center gap-0.5 mt-0.5 w-full">
                                  <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 leading-tight break-words text-center w-full" title={info.detail}>
                                    {info.headline}
                                  </span>
                                  <span className="text-[8.5px] font-medium text-slate-400 text-center">
                                    Runs automatically on Tally PC
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-5 text-right align-top">
                        <button 
                          onClick={() => triggerPrint(entryWithDefaults(e))}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Print Invoice Voucher"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={withItems ? 7 : 6} className="text-center py-12 text-slate-400">
                      No matching vouchers found for "{statusFilter === 'all' ? searchTerm : `${statusFilter} status`}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredEntries.map(e => {
              const info = formatVoucherStatusMessage(e.status, e.syncError, e.reason);
              return (
                <div key={e._id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900 font-mono">{e.invoiceNumber || 'NO-REF'}</div>
                      <div className="text-xs text-slate-400 font-semibold">{e.date}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider ${
                      e.type === 'sales' ? 'bg-indigo-50 text-indigo-700' : 
                      e.type === 'purchase' ? 'bg-amber-50 text-amber-700' :
                      e.type === 'receipt' ? 'bg-emerald-50 text-emerald-700' :
                      e.type === 'payment' ? 'bg-rose-50 text-rose-700' :
                      e.type === 'contra' ? 'bg-purple-50 text-purple-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {e.type}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{e.partyName}</h4>
                    {e.partyGstin && <p className="text-[10px] font-mono text-slate-400 mt-0.5">{e.partyGstin}</p>}
                    {e.notes && <p className="text-xs text-slate-400 mt-1 italic leading-tight truncate">{e.notes}</p>}
                  </div>

                  {withItems && e.items && e.items.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Items ({e.items.length})
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {e.items.map((it: any, iIdx: number) => (
                          <div key={iIdx} className="flex justify-between items-center text-xs text-slate-700">
                            <span className="truncate mr-2 font-medium">{it.name}</span>
                            <span className="font-mono font-bold whitespace-nowrap">{it.quantity} × ₹{it.rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Amount</span>
                      <span className="text-base font-black text-slate-900 font-mono">{formatCurrency(e.totalAmount || 0)}</span>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                        e.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                        e.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                        'bg-amber-50 text-amber-700 animate-pulse border border-amber-200'
                      }`}>
                        {e.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.2] text-emerald-600" /> : 
                         e.status === 'failed' ? <XCircle className="h-3.5 w-3.5 stroke-[2.2] text-rose-600" /> : 
                         <Clock className="h-3.5 w-3.5 stroke-[2.2] text-amber-600" />}
                        {e.status === 'success' ? 'Synced to Tally' : (e.status === 'failed' ? 'Sync Failed' : 'Syncing to Tally...')}
                      </span>
                      <button 
                        onClick={() => triggerPrint(entryWithDefaults(e))}
                        className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {e.status === 'failed' && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-rose-900">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        {info.headline}
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {info.detail}
                      </p>
                      {info.hint && (
                        <p className="text-indigo-700 font-medium text-[10px] bg-white p-2 rounded-xl border border-indigo-100">
                          💡 <strong>Hint:</strong> {info.hint}
                        </p>
                      )}
                      <button
                        onClick={() => handleRetryEntry(e._id)}
                        disabled={retryingId === e._id}
                        className="inline-flex items-center gap-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 w-full justify-center"
                      >
                        <RotateCcw className={`h-3 w-3 ${retryingId === e._id ? 'animate-spin' : ''}`} />
                        {retryingId === e._id ? 'Retrying...' : 'Retry Tally Sync'}
                      </button>
                    </div>
                  )}

                  {e.status === 'pending' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {info.headline}
                      </div>
                      <p className="text-amber-800 text-[11px]">
                        {info.detail}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hidden print container */}
      <div className="hidden print:block font-sans text-black">
        <PrintableInvoice ref={printRef} data={printData} user={user} />
      </div>
    </Layout>
  );
};

// Helper for print defaults
function entryWithDefaults(e: any) {
  const tot = Number(e.totalAmount || 0);
  const taxableVal = Number(e.taxableAmount || (tot > 0 ? Number((tot / 1.18).toFixed(2)) : 0));
  const taxVal = Number(e.taxAmount || (tot > 0 ? Number((tot - taxableVal).toFixed(2)) : 0));
  return {
    ...e,
    taxableAmount: taxableVal,
    taxAmount: taxVal,
    totalAmount: tot,
    items: e.items || []
  };
}

export default Entries;
