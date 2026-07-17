import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
  Search, Download, ExternalLink, RefreshCcw, CheckCircle2, Clock, XCircle, ChevronRight, TrendingUp, TrendingDown, Printer, Filter
} from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import PrintableInvoice from '../components/PrintableInvoice';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { useSearchParams } from 'react-router-dom';

const Entries: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printData, setPrintData] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintAction = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setPrintData(null)
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  useEffect(() => {
    if (printData && printRef.current) {
      handlePrintAction();
    }
  }, [printData, handlePrintAction]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/entries', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEntries(res.data);
    } catch (err) {
      console.error('Error fetching entries', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateFrom) matchesDate = matchesDate && e.date >= dateFrom;
    if (dateTo) matchesDate = matchesDate && e.date <= dateTo;

    return matchesSearch && matchesDate;
  });

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">Audit History</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">Voucher History</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">Reprint generated bills and monitor sync states</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchEntries} 
            className="p-3 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
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
            <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search party name or invoice reference..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
            />
          </div>
          <div className="flex gap-3 w-full lg:w-auto overflow-x-auto">
            <div className="relative flex items-center border border-slate-200 bg-white rounded-2xl shadow-sm px-4 focus-within:ring-4 focus-within:ring-indigo-50 focus-within:border-indigo-400 transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase mr-3">From</span>
              <input 
                type="date" 
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="py-2.5 bg-transparent text-sm font-bold border-none outline-none text-slate-700"
              />
            </div>
            <div className="relative flex items-center border border-slate-200 bg-white rounded-2xl shadow-sm px-4 focus-within:ring-4 focus-within:ring-indigo-50 focus-within:border-indigo-400 transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase mr-3">To</span>
              <input 
                type="date" 
                value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="py-2.5 bg-transparent text-sm font-bold border-none outline-none text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                <th className="px-8 py-5">Invoice Reference</th>
                <th className="px-8 py-5">Party Details</th>
                <th className="px-8 py-5 text-center">Treatment</th>
                <th className="px-8 py-5 text-center">Sync Status</th>
                <th className="px-8 py-5 text-right">Grand Total</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {filteredEntries.map((e, idx) => (
                  <motion.tr 
                    key={e._id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group hover:bg-slate-50/40 transition-all font-medium text-slate-700 border-b border-slate-100"
                  >
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-slate-900 leading-tight mb-1">
                        {e.invoiceNumber || 'NO-REF'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">
                        {e.date}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-slate-800 leading-tight">{e.partyName}</div>
                      {e.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">{e.notes}</div>}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                        e.type === 'sales' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {e.type === 'sales' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {e.type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                          e.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                          e.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                          'bg-amber-50 text-amber-700 animate-pulse border border-amber-100'
                        }`}>
                          {e.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.2]" /> : 
                           e.status === 'failed' ? <XCircle className="h-3.5 w-3.5 stroke-[2.2]" /> : 
                           <Clock className="h-3.5 w-3.5 stroke-[2.2]" />}
                          {e.status || 'pending'}
                        </span>
                        {e.status === 'failed' && e.syncError && (
                          <span className="text-[9px] font-bold text-rose-400 max-w-[150px] leading-tight break-words text-center">
                            {e.syncError}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-900 text-sm font-mono">
                      {formatCurrency(e.totalAmount || 0)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setPrintData({ ...e, companyName: user?.companyName })}
                          className="px-4 py-2 bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-2 inline-flex transition-all cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile Card Grid View */}
        <div className="block md:hidden p-4 space-y-4">
          <AnimatePresence>
            {filteredEntries.map((e, idx) => (
              <motion.div
                key={e._id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.02)] space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${
                      e.type === 'sales' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {e.type === 'sales' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase font-mono tracking-wider">{e.date}</span>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">{e.invoiceNumber || 'NO-REF'}</h4>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider ${
                    e.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                    e.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                    'bg-amber-50 text-amber-700 animate-pulse border border-amber-100'
                  }`}>
                    {e.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : 
                     e.status === 'failed' ? <XCircle className="h-3 w-3" /> : 
                     <Clock className="h-3 w-3" />}
                    {e.status || 'pending'}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Party</span>
                  <span className="text-sm font-bold text-slate-800">{e.partyName}</span>
                  {e.notes && <p className="text-xs text-slate-400 mt-1 italic leading-tight truncate">{e.notes}</p>}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Amount</span>
                    <span className="text-base font-black text-slate-900 font-mono">{formatCurrency(e.totalAmount || 0)}</span>
                  </div>
                </div>

                {e.status === 'failed' && e.syncError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed">
                    <strong>Sync Error:</strong> {e.syncError}
                  </div>
                )}

                <button 
                  onClick={() => setPrintData({ ...e, companyName: user?.companyName })}
                  className="w-full py-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 active:border-indigo-200 text-slate-700 active:text-indigo-600 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Invoice
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Search className="h-10 w-10 opacity-20 mb-4" />
            <p className="font-bold text-lg">No bills matched your criteria</p>
            <button 
              onClick={() => {setSearchTerm(''); setDateFrom(''); setDateTo('');}} 
              className="text-indigo-600 font-bold hover:underline underline-offset-4 mt-2 cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Hidden layout for printing */}
      {printData && (
        <div className="hidden">
          <PrintableInvoice ref={printRef} data={printData} user={user} />
        </div>
      )}
    </Layout>
  );
};

export default Entries;
