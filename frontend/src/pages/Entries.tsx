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

const Entries: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0 mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">All Bills</h2>
          <p className="text-slate-500 mt-1 font-medium">View and reprint generated invoices</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={fetchEntries} className="p-3 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden shadow-slate-200/50">
        {/* Filters Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 backdrop-blur-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search party or invoice..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            <div className="relative flex items-center border border-slate-200 bg-white rounded-xl shadow-sm px-3 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400">
              <span className="text-xs font-bold text-slate-400 uppercase mr-2">From:</span>
              <input 
                type="date" 
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="py-2.5 bg-transparent text-sm font-bold border-none outline-none"
              />
            </div>
            <div className="relative flex items-center border border-slate-200 bg-white rounded-xl shadow-sm px-3 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400">
              <span className="text-xs font-bold text-slate-400 uppercase mr-2">To:</span>
              <input 
                type="date" 
                value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="py-2.5 bg-transparent text-sm font-bold border-none outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Date & Invoice</th>
                <th className="px-8 py-5">Party Details</th>
                <th className="px-8 py-5 text-center">Type</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Amount</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {filteredEntries.map((e, idx) => (
                  <motion.tr 
                    key={e._id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-slate-50/50 transition-all font-medium text-slate-700 border-b border-slate-100/50"
                  >
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-slate-900 mb-1 leading-tight">
                        {e.invoiceNumber || 'NO-REF'}
                      </div>
                      <div className="text-xs font-bold text-slate-400 font-mono">
                        {e.date}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-base font-bold text-slate-800 leading-tight">{e.partyName}</div>
                      {e.notes && <div className="text-xs text-slate-400 truncate max-w-xs">{e.notes}</div>}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-tighter ${
                        e.type === 'sales' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {e.type === 'sales' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {e.type}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-tighter ${
                          e.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 
                          e.status === 'failed' ? 'bg-rose-50 text-rose-700' : 
                          'bg-slate-100 text-slate-500 animate-pulse'
                        }`}>
                          {e.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : 
                           e.status === 'failed' ? <XCircle className="h-3 w-3" /> : 
                           <Clock className="h-3 w-3" />}
                          {e.status || 'pending'}
                        </div>
                        {e.status === 'failed' && e.syncError && (
                          <div className="text-[10px] font-bold text-rose-400 max-w-[120px] leading-tight break-words">
                            {e.syncError}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-900 text-base font-mono">
                      {formatCurrency(e.totalAmount || 0)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setPrintData({ ...e, companyName: user?.companyName })}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 inline-flex transition-colors cursor-pointer"
                        >
                          <Printer className="h-4 w-4" /> Print
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Search className="h-10 w-10 opacity-20 mb-4" />
              <p className="font-bold text-lg">No bills matched your criteria</p>
              <button 
                onClick={() => {setSearchTerm(''); setDateFrom(''); setDateTo('');}} 
                className="text-indigo-600 font-bold hover:underline underline-offset-4 mt-2"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
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
