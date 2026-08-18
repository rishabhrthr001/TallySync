import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Filter, Calendar, RefreshCcw, FileText, CheckCircle2, 
  Clock, AlertCircle, IndianRupee, Tag, ShieldCheck, XCircle, Search
} from 'lucide-react';
import Layout from '../components/Layout';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Entry {
  _id: string;
  type: string;
  date: string;
  invoiceNumber: string;
  partyName: string;
  partyGstin?: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType: 'cgst-sgst' | 'igst';
  status: 'pending' | 'success' | 'failed';
}

const GST2A = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState<'lastMonth' | 'quarterly' | 'lastYear' | 'custom'>('lastMonth');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [withItems, setWithItems] = useState(true);

  // Fetch entries
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/entries', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.data) {
          // Filter to only purchase entries
          setEntries(res.data.data.filter((e: Entry) => e.type === 'purchase'));
        }
      } catch (err: any) {
        addToast({
          title: 'Failed to fetch',
          message: err.response?.data?.message || 'Could not load purchase entries.',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEntries();
  }, [addToast]);

  // Derived / Filtered data
  const filteredEntries = useMemo(() => {
    const now = new Date();
    // Default to a known current date for consistency based on prompt context if needed, but 'now' works.
    
    let fromDate = new Date();
    let toDate = new Date();

    if (timeFilter === 'lastMonth') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (timeFilter === 'quarterly') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else if (timeFilter === 'lastYear') {
      fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    } else if (timeFilter === 'custom') {
      if (customDateRange.from) fromDate = new Date(customDateRange.from);
      if (customDateRange.to) toDate = new Date(customDateRange.to);
    }

    return entries.filter(e => {
      if (!e.date) return false;
      const entryDate = new Date(e.date);
      
      if (timeFilter === 'custom') {
        const afterFrom = customDateRange.from ? entryDate >= fromDate : true;
        const beforeTo = customDateRange.to ? entryDate <= toDate : true;
        return afterFrom && beforeTo;
      }
      
      return entryDate >= fromDate && entryDate <= toDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, timeFilter, customDateRange]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        acc.taxableValue += e.taxableAmount || 0;
        if (e.gstType === 'igst') {
          acc.igst += e.taxAmount || 0;
        } else {
          acc.cgst += (e.taxAmount || 0) / 2;
          acc.sgst += (e.taxAmount || 0) / 2;
        }
        return acc;
      },
      { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }
    );
  }, [filteredEntries]);

  // Sync to Tally
  const handleSync = async () => {
    const unsyncedEntries = filteredEntries.filter(e => e.status !== 'success');
    if (unsyncedEntries.length === 0) {
      addToast({
        title: 'Already in Sync',
        message: 'All visible entries are already successfully synced to Tally.',
        type: 'success'
      });
      return;
    }

    try {
      setIsSyncing(true);
      const token = localStorage.getItem('token');
      const entryIds = unsyncedEntries.map(e => e._id);
      
      await axios.post(
        '/api/entries/bulk-retry',
        { entryIds, withItems },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setEntries(prev => prev.map(e => 
        entryIds.includes(e._id) ? { ...e, status: 'pending' } : e
      ));

      addToast({
        title: 'Sync Started',
        message: `Triggered sync for ${entryIds.length} entries.`,
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'Sync Failed',
        message: err.response?.data?.message || 'Failed to trigger sync to Tally.',
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-3 w-3" /> Synced
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 animate-pulse border border-amber-100">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck className="w-48 h-48" />
          </div>
          <div className="space-y-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5" /> GST Returns
            </span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">GSTR-2A</h1>
            <p className="text-sm font-semibold text-slate-500">Auto-populated purchase register from supplier filings</p>
          </div>
        </div>

        {/* Time Period Filter Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2 px-2 border-r border-slate-100">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Period</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'lastMonth', label: 'Last Month' },
              { id: 'quarterly', label: 'Quarterly' },
              { id: 'lastYear', label: 'Last Year' },
              { id: 'custom', label: 'Custom' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setTimeFilter(opt.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  timeFilter === opt.id 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-left-4">
              <input 
                type="date" 
                value={customDateRange.from}
                onChange={e => setCustomDateRange(p => ({ ...p, from: e.target.value }))}
                className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input 
                type="date" 
                value={customDateRange.to}
                onChange={e => setCustomDateRange(p => ({ ...p, to: e.target.value }))}
                className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-2xl">
          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="text-indigo-600 font-black">{filteredEntries.length}</span> Invoices • <span className="text-slate-800 font-black">{formatCurrency(filteredEntries.reduce((s, e) => s + (e.totalAmount || 0), 0))}</span> Total
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setWithItems(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${withItems ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                With Items
              </button>
              <button
                onClick={() => setWithItems(false)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${!withItems ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                Without Items
              </button>
            </div>
            
            <button
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync to Tally'}
            </button>
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-indigo-50 w-16 h-16 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider relative z-10">Taxable Value</span>
            <span className="text-xl font-black text-slate-800 font-mono relative z-10">{formatCurrency(summary.taxableValue)}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-emerald-50 w-16 h-16 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider relative z-10">Total CGST</span>
            <span className="text-xl font-black text-slate-800 font-mono relative z-10">{formatCurrency(summary.cgst)}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-blue-50 w-16 h-16 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider relative z-10">Total SGST</span>
            <span className="text-xl font-black text-slate-800 font-mono relative z-10">{formatCurrency(summary.sgst)}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-amber-50 w-16 h-16 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider relative z-10">Total IGST</span>
            <span className="text-xl font-black text-slate-800 font-mono relative z-10">{formatCurrency(summary.igst)}</span>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCcw className="h-8 w-8 animate-spin opacity-50 mb-4" />
            <p className="font-bold text-sm">Loading purchase entries...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)]">
            <Search className="h-12 w-12 opacity-20 mb-4" />
            <p className="font-bold text-lg text-slate-600">No purchase entries found for this period</p>
            <p className="text-sm font-medium mt-1">Try adjusting your date filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-3xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">Invoice No.</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">Supplier Name</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">GSTIN</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-right">Taxable Value</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-right">CGST</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-right">SGST</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-right">IGST</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-right">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredEntries.map((e) => (
                        <motion.tr 
                          key={e._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                            {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900 whitespace-nowrap">{e.invoiceNumber || 'N/A'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-800 max-w-[200px] truncate" title={e.partyName}>{e.partyName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {e.partyGstin ? (
                              <span className="text-xs font-bold text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded-md">{e.partyGstin}</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-800 font-mono text-right whitespace-nowrap">{formatCurrency(e.taxableAmount || 0)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right whitespace-nowrap">
                            {e.gstType !== 'igst' ? formatCurrency((e.taxAmount || 0) / 2) : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right whitespace-nowrap">
                            {e.gstType !== 'igst' ? formatCurrency((e.taxAmount || 0) / 2) : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right whitespace-nowrap">
                            {e.gstType === 'igst' ? formatCurrency(e.taxAmount || 0) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-indigo-600 font-mono text-right whitespace-nowrap">{formatCurrency(e.totalAmount || 0)}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {getStatusBadge(e.status)}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              <AnimatePresence>
                {filteredEntries.map((e) => (
                  <motion.div 
                    key={e._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-5 rounded-3xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col gap-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                          {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{e.partyName}</h4>
                        <p className="text-xs font-bold text-slate-500 mt-1">Inv: {e.invoiceNumber || 'N/A'}</p>
                      </div>
                      {getStatusBadge(e.status)}
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Taxable</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{formatCurrency(e.taxableAmount || 0)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Total Amount</span>
                        <span className="text-base font-black text-indigo-600 font-mono">{formatCurrency(e.totalAmount || 0)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default GST2A;
