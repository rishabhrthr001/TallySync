import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, RefreshCcw, CheckCircle2, Clock, XCircle, TrendingDown, Filter, Calendar, Download, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';

interface Entry {
  _id: string;
  type: string;
  date: string;
  partyName: string;
  partyGstin?: string;
  invoiceNumber?: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType?: string;
  status?: string;
}

const GST2B: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState('Last Month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [withItems, setWithItems] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/entries', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEntries(res.data);
    } catch (err) {
      console.error('Error fetching entries', err);
      showToast('Failed to fetch entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSync = async () => {
    if (filteredEntries.length === 0) return;
    setSyncing(true);
    try {
      const entryIds = filteredEntries.map(e => e._id);
      await axios.post('/api/entries/bulk-retry', { entryIds, withItems }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast(`Queued ${entryIds.length} eligible entries for Tally sync`, 'success');
      fetchEntries();
    } catch (err) {
      showToast('Failed to queue entries for sync', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const isEligible = (e: Entry) => e.type === 'purchase' && e.partyGstin && e.partyGstin.trim().length > 0;

  const filteredEntries = entries.filter(e => {
    if (!isEligible(e)) return false;

    const matchesSearch = e.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.partyGstin?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (period !== 'Custom') {
      const entryDate = new Date(e.date);
      const now = new Date();
      if (period === 'Last Month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        matchesDate = entryDate >= lastMonth && entryDate < thisMonth;
      } else if (period === 'Quarterly') {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        matchesDate = entryDate >= quarterStart;
      } else if (period === 'Last Year') {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        matchesDate = entryDate >= lastYearStart && entryDate < thisYearStart;
      }
    } else {
      if (dateFrom) matchesDate = matchesDate && e.date >= dateFrom;
      if (dateTo) matchesDate = matchesDate && e.date <= dateTo;
    }

    return matchesSearch && matchesDate;
  });

  const totalITC = filteredEntries.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
  const totalTaxable = filteredEntries.reduce((sum, e) => sum + (e.taxableAmount || 0), 0);
  const totalCGSTSGST = filteredEntries.filter(e => e.gstType !== 'igst').reduce((sum, e) => sum + (e.taxAmount || 0), 0);
  const totalIGST = filteredEntries.filter(e => e.gstType === 'igst').reduce((sum, e) => sum + (e.taxAmount || 0), 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-xs font-bold tracking-wide uppercase">
                GST Returns
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              GSTR-2B
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium max-w-2xl">
              Input Tax Credit statement — verified supplier filings with valid GSTIN
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl border border-slate-200 p-2 sm:p-4 shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {['Last Month', 'Quarterly', 'Last Year', 'Custom'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                  period === p 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
            
            <AnimatePresence>
              {period === 'Custom' && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <span className="text-slate-400 font-medium">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative w-full xl:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search GSTIN, party, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-teal-50/50 p-4 rounded-3xl border border-teal-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-teal-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{filteredEntries.length} Eligible Invoices</p>
              <p className="text-xs font-bold text-teal-600">{formatCurrency(totalITC)} ITC Available</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">Items:</span>
              <button 
                onClick={() => setWithItems(!withItems)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${withItems ? 'bg-teal-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${withItems ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            <button
              onClick={handleBulkSync}
              disabled={syncing || filteredEntries.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-2xl font-bold text-sm shadow-md shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
            >
              {syncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Sync to Tally
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-teal-500 to-cyan-600 p-6 rounded-3xl shadow-lg shadow-teal-500/20 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-teal-100 font-bold text-sm mb-1">ITC Available</p>
              <h3 className="text-3xl font-black">{formatCurrency(totalITC)}</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          </motion.div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-bold text-sm mb-1">Total Taxable Value</p>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(totalTaxable)}</h3>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-bold text-sm mb-1">Total CGST + SGST</p>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(totalCGSTSGST)}</h3>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-bold text-sm mb-1">Total IGST</p>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(totalIGST)}</h3>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Invoice / Party</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider">GSTIN</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Taxable</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Tax Amount</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Total</th>
                  <th className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="p-4"><div className="h-12 bg-slate-100 rounded-xl" /></td>
                    </tr>
                  ))
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                      No GSTIN-verified purchases found for this period
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="text-sm font-bold text-slate-700">
                          {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{entry.invoiceNumber || '-'}</span>
                          <span className="text-xs font-bold text-slate-500 truncate max-w-[200px]">{entry.partyName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold font-mono border border-slate-200">
                          {entry.partyGstin}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-bold text-slate-600">{formatCurrency(entry.taxableAmount)}</span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-teal-600">{formatCurrency(entry.taxAmount)}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{entry.gstType || 'CGST-SGST'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-black text-slate-900">{formatCurrency(entry.totalAmount)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">ITC Eligible</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-32 bg-slate-100 rounded-3xl" />
            ))
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-medium shadow-sm">
              No GSTIN-verified purchases found for this period
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry._id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-black text-slate-900">{entry.partyName}</h4>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">INV: {entry.invoiceNumber || '-'}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-bold">ITC Eligible</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold font-mono border border-slate-200">
                    {entry.partyGstin}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Taxable</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(entry.taxableAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">ITC ({entry.gstType || 'CS'})</p>
                    <p className="text-sm font-black text-teal-600">{formatCurrency(entry.taxAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(entry.totalAmount)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
      </div>
    </Layout>
  );
};

export default GST2B;
