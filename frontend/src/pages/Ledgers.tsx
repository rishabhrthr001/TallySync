import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Users, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  RefreshCcw,
  CreditCard,
  History,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

const Ledgers: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Receivable' | 'Payable' | 'Cleared'>('All');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'receivable' | 'payable'>('receivable');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Sync states
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [syncError, setSyncError] = useState<string>('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchLedgers();
    // Do NOT auto-fetch sync status on mount; only poll after user triggers a sync
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const res = await axios.get('/api/ledger/sync-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSyncStatus(res.data.status);
      setSyncError(res.data.error || '');
      setLastSync(res.data.lastSync);
      return res.data.status;
    } catch (err) {
      console.error('Error fetching sync status', err);
      return 'idle';
    }
  };

  const handleSyncLedgers = async () => {
    setSyncLoading(true);
    try {
      await axios.post('/api/ledger/sync-request', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('Ledger sync request queued in agent.', 'success');
      setSyncStatus('pending');
      setSyncError('');
    } catch (err: any) {
      console.error('Error initiating sync', err);
      showToast(err.response?.data?.error || 'Failed to initiate ledger sync', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // Poll sync status when status is pending or syncing
  useEffect(() => {
    let intervalId: any;
    
    const checkStatus = async () => {
      const status = await fetchSyncStatus();
      if (status === 'success') {
        showToast('Ledgers synchronized with Tally successfully!', 'success');
        fetchLedgers();
        clearInterval(intervalId);
      } else if (status === 'failed') {
        showToast('Tally ledger synchronization failed.', 'error');
        clearInterval(intervalId);
      }
    };

    if (syncStatus === 'pending' || syncStatus === 'syncing') {
      intervalId = setInterval(checkStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncStatus]);

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ledger', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLedgers(res.data);
    } catch (err) {
      console.error('Error fetching ledgers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!partyName.trim()) {
      setError('Party name is required');
      return;
    }

    setSubmitting(true);
    try {
      const numericBalance = Number(openingBalance) || 0;
      const finalBalance = balanceType === 'receivable' ? numericBalance : -numericBalance;
      
      await axios.post('/api/ledger', {
        partyName: partyName.trim(),
        gstin: gstin.trim().toUpperCase(),
        balance: finalBalance
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Reset & close
      setPartyName('');
      setGstin('');
      setOpeningBalance('');
      setBalanceType('receivable');
      setIsModalOpen(false);
      fetchLedgers();
    } catch (err: any) {
      console.error('Error creating party ledger', err);
      setError(err.response?.data?.error || 'Failed to create party. Party name must be unique.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLedgers = ledgers.filter(l => {
    const matchesSearch = 
      l.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.gstin && l.gstin.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'All' ? true :
      statusFilter === 'Receivable' ? l.balance > 0 :
      statusFilter === 'Payable' ? l.balance < 0 :
      l.balance === 0;

    return matchesSearch && matchesStatus;
  });

  const totalParties = ledgers.length;
  const totalReceivables = ledgers.reduce((acc, l) => l.balance > 0 ? acc + l.balance : acc, 0);
  const totalPayables = Math.abs(ledgers.reduce((acc, l) => l.balance < 0 ? acc + l.balance : acc, 0));
  const netOutstanding = ledgers.reduce((acc, l) => acc + l.balance, 0);

  if (loading) return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compiling Party Balances...</p>
    </div>
  );

  return (
    <Layout>
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-5 mb-8">
        <div>
          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider font-mono">Ledgers</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">Party Accounts</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">
            {lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'Real-time receivables, payables, and transactions overview'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSyncLedgers}
            disabled={syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 border rounded-2xl text-xs font-bold uppercase tracking-wider transition-all w-full sm:w-auto cursor-pointer ${
              syncStatus === 'pending' || syncStatus === 'syncing'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : syncStatus === 'failed'
                ? 'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border-rose-200 hover:border-rose-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
            title={syncStatus === 'failed' ? `Last sync failed: ${syncError}` : 'Sync ledgers from Tally'}
          >
            <RefreshCcw className={`h-4 w-4 ${syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading ? 'animate-spin' : ''}`} />
            {syncStatus === 'pending' || syncStatus === 'syncing' 
              ? 'Syncing Tally...' 
              : syncStatus === 'failed'
              ? 'Sync Failed (Retry)'
              : 'Sync Tally'}
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/15 transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Add New Party
          </button>
        </div>
      </div>

      {syncStatus === 'failed' && syncError && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-rose-500 rounded-full animate-ping"></span>
            <span>Tally Sync Failed: {syncError}</span>
          </div>
          <button 
            onClick={handleSyncLedgers}
            className="text-[10px] tracking-wider uppercase bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm shadow-rose-600/10 active:scale-95 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <LedgerStat 
          title="Total Parties" 
          value={totalParties} 
          icon={Users} 
          color="indigo" 
          description="Registered client profiles"
        />
        <LedgerStat 
          title="Receivables (Dr)" 
          value={formatCurrency(totalReceivables)} 
          icon={ArrowUpRight} 
          color="emerald" 
          description="Total funds due to you"
        />
        <LedgerStat 
          title="Payables (Cr)" 
          value={formatCurrency(totalPayables)} 
          icon={ArrowDownRight} 
          color="rose" 
          description="Total obligations outstanding"
        />
        <LedgerStat 
          title="Net Outstanding" 
          value={formatCurrency(Math.abs(netOutstanding))} 
          icon={CreditCard} 
          color={netOutstanding >= 0 ? "indigo" : "rose"} 
          description={netOutstanding >= 0 ? "Net receivable balance" : "Net payable balance"}
        />
      </div>

      {/* Main content box */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Filters and search */}
        <div className="p-5 border-b border-slate-150 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or GSTIN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <select 
                value={statusFilter} 
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 appearance-none shadow-sm cursor-pointer pr-10"
              >
                <option value="All">All Ledgers</option>
                <option value="Receivable">Receivables (Dr)</option>
                <option value="Payable">Payables (Cr)</option>
                <option value="Cleared">Cleared (Zero)</option>
              </select>
            </div>
            
            <button onClick={fetchLedgers} className="p-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-sm transition-colors cursor-pointer">
              <RefreshCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Desktop View Table */}
        <div className="hidden lg:block overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                <th className="px-8 py-5">Party Identity</th>
                <th className="px-8 py-5 text-center">Closing Balance</th>
                <th className="px-8 py-5 text-center">Accounting Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <AnimatePresence>
                {filteredLedgers.map((l, idx) => {
                  const isDr = l.balance > 0;
                  const isCr = l.balance < 0;
                  const isZero = l.balance === 0;
                  return (
                    <motion.tr 
                      key={l._id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-slate-50/30 transition-all font-semibold text-slate-750 group"
                    >
                      <td className="px-8 py-5 flex items-center gap-4">
                        <div className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold uppercase transition-colors ${
                          isDr ? 'bg-emerald-50 text-emerald-600' : isCr ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {l.partyName[0]}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{l.partyName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GST: {l.gstin || 'UNREGISTERED'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center font-mono font-bold text-base">
                        <span className={isDr ? 'text-emerald-600' : isCr ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(Math.abs(l.balance))}
                          {!isZero && <span className="text-[10px] font-black uppercase ml-1 opacity-60">{isDr ? 'Dr' : 'Cr'}</span>}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isDr ? 'bg-emerald-50 text-emerald-750 border border-emerald-100' : 
                          isCr ? 'bg-rose-50 text-rose-750 border border-rose-100' : 
                          'bg-slate-50 text-slate-500 border border-slate-200/60'
                        } border`}>
                          {isDr ? 'Receivable' : isCr ? 'Payable' : 'Cleared'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => navigate(`/entries?search=${l.partyName}`)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                          title="View Ledger Statement"
                        >
                          <History className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Grid */}
        <div className="block lg:hidden p-4 space-y-4">
          <AnimatePresence>
            {filteredLedgers.map((l, idx) => {
              const isDr = l.balance > 0;
              const isCr = l.balance < 0;
              const isZero = l.balance === 0;
              return (
                <motion.div
                  key={l._id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm uppercase ${
                        isDr ? 'bg-emerald-50 text-emerald-600' : isCr ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {l.partyName[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{l.partyName}</h4>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase block">GST: {l.gstin || 'UNREGISTERED'}</span>
                      </div>
                    </div>
                    
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      isDr ? 'bg-emerald-50 text-emerald-700' : 
                      isCr ? 'bg-rose-50 text-rose-700' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {isDr ? 'Dr' : isCr ? 'Cr' : 'Cleared'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Closing Balance</span>
                      <span className={`text-base font-black font-mono ${isDr ? 'text-emerald-600' : isCr ? 'text-rose-600' : 'text-slate-800'}`}>
                        {formatCurrency(Math.abs(l.balance))}
                        {!isZero && <small className="text-[10px] ml-1 opacity-60 uppercase font-black">{isDr ? 'Dr' : 'Cr'}</small>}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/entries?search=${l.partyName}`)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all shadow-sm"
                    >
                      <History className="w-3.5 h-3.5" />
                      Statement
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredLedgers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Users className="h-14 w-14 opacity-20 mb-4" />
            <p className="font-bold text-lg text-slate-700">No party ledgers found</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">Start by adding a new party profile manually or via entry.</p>
          </div>
        )}
      </div>

      {/* Create Party Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200/80 overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Initialize Ledger Party</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">Define name, identification, and opening net balance</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddParty} className="p-6 md:p-8 space-y-5">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex gap-2 items-center">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Party Name</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="E.g., Acme Corporation"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">GSTIN (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="E.g., 27AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all uppercase placeholder:text-slate-350"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Opening Balance (INR)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all font-mono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Balance Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBalanceType('receivable')}
                        className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all ${
                          balanceType === 'receivable'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Dr (Receivable)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceType('payable')}
                        className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all ${
                          balanceType === 'payable'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Cr (Payable)
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 mt-2 bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/10 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Initializing...' : 'Create Ledger Party'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const LedgerStat: React.FC<any> = ({ title, value, icon: Icon, color, description }) => {
  const bgClasses: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-700'
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex items-center gap-4 group hover:border-indigo-200 transition-all duration-300">
      <div className={`p-3.5 rounded-2xl ${bgClasses[color]} group-hover:scale-105 transition-transform duration-300`}>
        <Icon className="h-5 w-5 stroke-[2.2]" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{title}</p>
        <h4 className="text-xl font-black text-slate-900 font-mono tracking-tight mt-1.5">{value}</h4>
        <p className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-none">{description}</p>
      </div>
    </div>
  );
};

export default Ledgers;

