import React, { useEffect, useState, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, CreditCard, Plus, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCcw,
  Printer, CheckCircle2, Clock, XCircle, Trash2, Check, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { formatVoucherStatusMessage } from '../utils/statusFormatter';
import { useToast } from '../contexts/ToastContext';
import PrintableInvoice from '../components/PrintableInvoice';
import { useReactToPrint } from 'react-to-print';
import ProUpgradeModal from '../components/ProUpgradeModal';

const SUPPORTED_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "State Bank of India",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "IndusInd Bank",
  "IDFC FIRST Bank",
  "Union Bank of India",
  "Indian Bank",
  "Bank of India",
  "Yes Bank",
  "Federal Bank",
  "South Indian Bank",
  "AU Small Finance Bank",
  "IDBI Bank",
  "RBL Bank",
  "Bandhan Bank"
];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [stockValue, setStockValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  // Sync states
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [syncError, setSyncError] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  // Bank Statement states
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [parsingBank, setParsingBank] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [bankParseResult, setBankParseResult] = useState<any>(null);
  const [targetBankLedger, setTargetBankLedger] = useState<string>('');
  const [tempTransactions, setTempTransactions] = useState<any[]>([]);
  const [syncSaving, setSyncSaving] = useState(false);
  const [bankPassword, setBankPassword] = useState<string>('');
  const [showBankPassword, setShowBankPassword] = useState<boolean>(false);
  const [showProModal, setShowProModal] = useState(false);
  const [editingTxnIdx, setEditingTxnIdx] = useState<number | null>(null);

  const updateTempTxn = (index: number, field: string, value: any) => {
    setTempTransactions(prev => prev.map((t, idx) => idx === index ? { ...t, [field]: value } : t));
  };

  const removeTempTxn = (index: number) => {
    setTempTransactions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyBankLedgerToAll = (newBank: string) => {
    setTargetBankLedger(newBank);
    setTempTransactions(prev => prev.map(t => ({ ...t, bankLedger: newBank })));
  };

  const handleBankUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankFile) return;

    const isProOrTrial = user?.isSuperAdmin || user?.subscription?.isUnlimited;
    if (!isProOrTrial) {
      showToast('🔒 AI Bank Statement Parsing is a Pro feature (₹299/mo). Upgrade to Pro to unlock full potential!', 'error');
      setShowProModal(true);
      return;
    }

    setParsingBank(true);
    setBankParseResult(null);
    setTempTransactions([]);

    const formData = new FormData();
    formData.append('pdf', bankFile);
    if (selectedBank) {
      formData.append('selectedBank', selectedBank);
    }
    if (bankPassword) {
      formData.append('password', bankPassword);
    }

    try {
      const res = await axios.post('/api/entries/upload-bank-statement', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const detectedBank = selectedBank || (res.data.bankName || 'Bank Account').trim();
      setBankParseResult(res.data);
      setTargetBankLedger(detectedBank);
      setTempTransactions(res.data.data || []);
      showToast(`Detected ${detectedBank}! Extracted ${res.data.count} transactions. Review before syncing.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to parse bank statement', 'error');
    } finally {
      setParsingBank(false);
    }
  };

  const cleanNum = (val: any): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleaned = String(val).replace(/,/g, '').replace(/[^\d.\-]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const handleConfirmAndSyncBank = async () => {
    if (tempTransactions.length === 0) {
      showToast("No transactions left to sync.", "error");
      return;
    }
    setSyncSaving(true);
    try {
      const bankName = (targetBankLedger || selectedBank || 'Bank Account').trim();
      const enrichedTransactions = tempTransactions.map(t => ({
        ...t,
        bankLedger: (t.bankLedger || bankName).trim()
      }));

      const res = await axios.post('/api/entries/bulk', { 
        transactions: enrichedTransactions,
        bankName 
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast(`Successfully queued ${res.data.count} transactions for ${bankName} in Tally!`, 'success');
      setIsBankModalOpen(false);
      setBankFile(null);
      setBankParseResult(null);
      setTempTransactions([]);
      setTargetBankLedger('');
      setBankPassword('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to save transactions to database', 'error');
    } finally {
      setSyncSaving(false);
    }
  };

  // Print setup
  const [printData, setPrintData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintAction = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setPrintData(null)
  });


  useEffect(() => {
    if (printData && printRef.current) {
      handlePrintAction();
    }
  }, [printData, handlePrintAction]);

  // Tab filter state for recent entries
  const [recentFilter, setRecentFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [retryingBillId, setRetryingBillId] = useState<string | null>(null);

  const handlePrintBill = async (entry: any) => {
    const tot = Number(entry.totalAmount || 0);
    const taxableVal = Number(entry.taxableAmount || (tot > 0 ? Number((tot / 1.18).toFixed(2)) : 0));
    const taxVal = Number(entry.taxAmount || (tot > 0 ? Number((tot - taxableVal).toFixed(2)) : 0));

    const itemsArr = Array.isArray(entry.items) && entry.items.length > 0
      ? entry.items
      : [{ 
          name: entry.partyName ? `Supply - ${entry.partyName}` : 'Taxable Supply', 
          quantity: 1, 
          rate: taxableVal, 
          amount: taxableVal, 
          gst: 18,
          hsn: '9983' 
        }];

    const formattedInvoice = {
      ...entry,
      items: itemsArr,
      taxableAmount: taxableVal,
      taxAmount: taxVal,
      totalAmount: tot,
      companyName: entry.companyName || user?.companyName || 'PHOTO BILL ENTERPRISES'
    };

    try {
      // Mark as printed in the DB
      await axios.patch(`/api/entries/${entry._id}/print-status`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Update local state
      setRecentEntries(prev => prev.map(e => e._id === entry._id ? { ...e, printed: true, printedAt: new Date() } : e));
      // Set print data
      setPrintData(formattedInvoice);
      showToast("Invoice marked as printed & sent to printer", "success");
    } catch (err) {
      console.error("Failed to update print status", err);
      // Fallback print
      setPrintData(formattedInvoice);
    }
  };

  const getFilteredRecentEntries = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return recentEntries.filter((e: any) => {
      if (recentFilter === 'today') {
        return e.date === todayStr;
      }
      if (recentFilter === 'yesterday') {
        return e.date === yesterdayStr;
      }
      if (recentFilter === 'week') {
        return new Date(e.date) >= sevenDaysAgo;
      }
      return true;
    });
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, inventoryRes, entriesRes] = await Promise.all([
        axios.get('/api/entries/dashboard-stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/inventory', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/entries', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      setStats(statsRes.data);
      
      const totalStockValue = inventoryRes.data.reduce((acc: number, item: any) => {
        return acc + (item.stock > 0 ? item.stock * item.rate : 0);
      }, 0);
      setStockValue(totalStockValue);
      
      setRecentEntries(entriesRes.data || []);
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSyncStatuses = async () => {
    try {
      const [invRes, ledRes] = await Promise.all([
        axios.get('/api/inventory/sync-status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('/api/ledger/sync-status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const invStatus = invRes.data.status;
      const ledStatus = ledRes.data.status;

      if (invStatus === 'failed' || ledStatus === 'failed') {
        const errMsg = [
          invStatus === 'failed' ? `Inventory: ${invRes.data.error}` : '',
          ledStatus === 'failed' ? `Ledgers: ${ledRes.data.error}` : ''
        ].filter(Boolean).join(' | ');
        setSyncStatus('failed');
        setSyncError(errMsg || 'Sync failed');
        return 'failed';
      }

      if (invStatus === 'success' && ledStatus === 'success') {
        setSyncStatus('success');
        setSyncError('');
        return 'success';
      }

      if (invStatus === 'pending' || invStatus === 'syncing' || ledStatus === 'pending' || ledStatus === 'syncing') {
        setSyncStatus('syncing');
        return 'syncing';
      }

      setSyncStatus('idle');
      return 'idle';
    } catch (err) {
      console.error('Error fetching sync statuses', err);
      return 'idle';
    }
  };

  const handleSyncAll = async () => {
    setSyncLoading(true);
    try {
      await Promise.all([
        axios.post('/api/inventory/sync-request', {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.post('/api/ledger/sync-request', {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      showToast('Tally sync request queued in agent.', 'success');
      setSyncStatus('pending');
      setSyncError('');
    } catch (err: any) {
      console.error('Error initiating sync', err);
      showToast(err.response?.data?.error || 'Failed to initiate Tally sync', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRetryBill = async (id: string) => {
    setRetryingBillId(id);
    try {
      await axios.post(`/api/entries/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('Bill re-queued for Tally agent sync!', 'success');
      setRecentEntries(prev => prev.map(e => e._id === id ? { ...e, status: 'pending', syncError: '' } : e));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to retry bill', 'error');
    } finally {
      setRetryingBillId(null);
    }
  };

  useEffect(() => {
    let intervalId: any;

    const checkStatus = async () => {
      const status = await fetchSyncStatuses();
      if (status === 'success') {
        showToast('Inventory and Ledgers synchronized with Tally successfully!', 'success');
        fetchData();
        clearInterval(intervalId);
      } else if (status === 'failed') {
        showToast('Tally synchronization failed.', 'error');
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

  useEffect(() => {
    fetchData();
    // Do NOT auto-fetch sync status on mount; only poll after user triggers a sync
  }, []);

  const chartData = stats?.monthlySales.map((val: number, i: number) => ({
    name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    sales: val,
    purchase: stats.monthlyPurchase[i]
  })) || [];

  if (loading) return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compiling Dashboard Metrics...</p>
    </div>
  );

  const netProfit = (stats?.totalSales || 0) - (stats?.totalPurchase || 0);

  return (
    <Layout>
      <div className="print-hidden-mobile">
        {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-5 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">Overview</span>
            {refreshing && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">Syncing...</span>}
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">Overview</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">{user?.companyName} • Real-time metrics</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => fetchData(true)}
            className="p-3 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSyncAll}
            disabled={syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 border rounded-2xl text-xs font-bold uppercase tracking-wider transition-all w-full sm:w-auto cursor-pointer ${
              syncStatus === 'pending' || syncStatus === 'syncing'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : syncStatus === 'failed'
                ? 'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border-rose-200 hover:border-rose-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
            title={syncStatus === 'failed' ? `Last sync failed: ${syncError}` : 'Sync inventory and parties from Tally'}
          >
            <RefreshCcw className={`h-4 w-4 ${syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading ? 'animate-spin' : ''}`} />
            {syncStatus === 'pending' || syncStatus === 'syncing' 
              ? 'Syncing Tally...' 
              : syncStatus === 'failed'
              ? 'Sync Failed (Retry)'
              : 'Sync from Tally'}
          </button>

          <button
            onClick={() => setIsBankModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-tr from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/15 transition-all active:scale-95 cursor-pointer"
          >
            <CreditCard className="h-4 w-4" />
            Upload Statement
          </button>

          <Link 
            to="/create-entry"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/15 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Create Entry
          </Link>
        </div>
      </div>

      {syncStatus === 'failed' && syncError && (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-rose-500 rounded-full animate-ping"></span>
            <span>Tally Sync Failed: {syncError}</span>
          </div>
          <button 
            onClick={handleSyncAll}
            className="text-[10px] tracking-wider uppercase bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm shadow-rose-600/10 active:scale-95 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(stats?.totalSales || 0)} 
          icon={TrendingUp} 
          color="indigo" 
          change="+12.4%"
          positive={true}
          description="Successful sales bills"
        />
        <StatCard 
          title="Total Purchase" 
          value={formatCurrency(stats?.totalPurchase || 0)} 
          icon={TrendingDown} 
          color="amber" 
          change="+8.2%"
          positive={false}
          description="Inbound purchases logged"
        />
        <StatCard 
          title="Net Profit" 
          value={formatCurrency(netProfit)} 
          icon={CreditCard} 
          color={netProfit >= 0 ? "emerald" : "rose"} 
          change={netProfit >= 0 ? "+16.8%" : "-3.4%"}
          positive={netProfit >= 0}
          description="Net margin value"
        />
        <StatCard 
          title="Stock Value" 
          value={formatCurrency(stockValue)} 
          icon={Package} 
          color="slate" 
          change="Updated"
          positive={true}
          description="Real-time SKU valuation"
        />
      </div>

      {/* Tally Live Sync Overview Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-750">Tally Balances &amp; Movements</h3>
          </div>
          {stats?.tallySummary?.lastSyncedAt && (
            <span className="text-[11px] font-bold text-slate-400">
              Last synced from Tally: {new Date(stats.tallySummary.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-indigo-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform duration-300">
                <CreditCard className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                (stats?.tallySummary?.openingBalance || 0) >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {(stats?.tallySummary?.openingBalance || 0) >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)'}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Opening Balance</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(Math.abs(stats?.tallySummary?.openingBalance || 0))}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Starting balance in Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-emerald-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform duration-300">
                <TrendingUp className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                (stats?.tallySummary?.closingBalance || 0) >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {(stats?.tallySummary?.closingBalance || 0) >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)'}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Closing Balance</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(Math.abs(stats?.tallySummary?.closingBalance || 0))}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Net closing balance in Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-blue-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform duration-300">
                <ArrowUpRight className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-blue-600 bg-blue-50">
                Debit (Dr)
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Dr Total</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(stats?.tallySummary?.totalDebit || 0)}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Total debited movements from Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-amber-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform duration-300">
                <ArrowDownRight className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-amber-600 bg-amber-50">
                Credit (Cr)
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cr Total</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(stats?.tallySummary?.totalCredit || 0)}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Total credited movements from Tally</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-8">
          <div>
            <h3 className="font-black text-slate-850 text-lg">Monthly Sales vs Purchase Trend</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Yearly comparative posting stream</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Sales</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Purchase</span>
          </div>
        </div>

        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
              />
              <Tooltip 
                contentStyle={{
                  borderRadius: '16px', 
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
                  fontWeight: 700,
                  fontFamily: 'Outfit',
                  color: '#0f172a'
                }} 
                cursor={{stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4'}}
              />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="purchase" name="Purchase" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPurchase)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Bills Section */}
      <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="font-black text-slate-850 text-xl tracking-tight">Recent Bills</h3>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">Quickly filter, reprint, and verify print statuses</p>
          </div>
          
          {/* Quick Filters */}
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 self-start md:self-auto">
            {(['all', 'today', 'yesterday', 'week'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setRecentFilter(filter)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  recentFilter === filter
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filter === 'week' ? 'Last 7 Days' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* List of recent bills */}
        <div className="space-y-3.5">
          {getFilteredRecentEntries().length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Printer className="h-8 w-8 text-slate-350 mx-auto stroke-[1.5] mb-2.5" />
              <p className="text-sm font-bold text-slate-400">No bills found for the selected timeframe</p>
            </div>
          ) : (
            getFilteredRecentEntries().slice(0, 10).map((e: any) => (
              <div 
                key={e._id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50/30 hover:bg-indigo-50/10 rounded-2xl border border-slate-200/50 hover:border-indigo-200/60 transition-all duration-200 gap-4"
              >
                <div className="flex items-center gap-4.5 min-w-0">
                  <div className={`p-3 rounded-2xl shrink-0 ${
                    e.type === 'sales' ? 'bg-indigo-50 text-indigo-650' : 
                    e.type === 'purchase' ? 'bg-amber-50 text-amber-650' :
                    e.type === 'receipt' ? 'bg-emerald-50 text-emerald-650' :
                    e.type === 'payment' ? 'bg-rose-50 text-rose-650' :
                    e.type === 'contra' ? 'bg-purple-50 text-purple-650' :
                    'bg-slate-100 text-slate-650'
                  }`}>
                    {e.type === 'sales' || e.type === 'receipt' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    {/* Invoice Number on mobile (above party name) */}
                    <span className="sm:hidden text-[10px] font-bold text-slate-400 font-mono mb-1 tracking-wide">
                      {e.invoiceNumber || 'NO-REF'} • {e.date}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-850 truncate leading-snug">{e.partyName}</p>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        e.type === 'sales' ? 'bg-indigo-50/80 text-indigo-700' : 
                        e.type === 'purchase' ? 'bg-amber-50/80 text-amber-700' :
                        e.type === 'receipt' ? 'bg-emerald-50/80 text-emerald-700' :
                        e.type === 'payment' ? 'bg-rose-50/80 text-rose-700' :
                        e.type === 'contra' ? 'bg-purple-50/80 text-purple-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {e.type}
                      </span>
                      {e.bankLedger && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/80">
                          🏦 {e.bankLedger}
                        </span>
                      )}
                    </div>
                    {/* Invoice Number on desktop (below party name) */}
                    <p className="hidden sm:block text-[10px] font-bold text-slate-400 mt-1 font-mono tracking-wide">
                      {e.invoiceNumber || 'NO-REF'} • {e.date}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                  {/* Status & Printed Badges */}
                  <div className="flex items-center gap-3">
                    {/* Sync Status & Reason */}
                    {(() => {
                      const info = formatVoucherStatusMessage(e.status, e.syncError, e.reason);
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            e.status === 'success' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                            e.status === 'failed' ? 'text-rose-700 bg-rose-50 border border-rose-100' :
                            'text-amber-700 bg-amber-50 border border-amber-100 animate-pulse'
                          }`}>
                            {info.badgeText}
                          </span>
                          {e.status === 'failed' && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-semibold text-rose-600 max-w-[150px] truncate" title={`${info.headline} - ${info.detail}`}>
                                {info.headline}
                              </span>
                              <button
                                onClick={() => handleRetryBill(e._id)}
                                disabled={retryingBillId === e._id}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                                title="Retry sync"
                              >
                                <RotateCcw className={`h-2.5 w-2.5 ${retryingBillId === e._id ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          )}
                          {e.status === 'pending' && (
                            <span className="text-[9px] font-semibold text-amber-700 max-w-[150px] truncate" title={info.detail}>
                              {info.headline}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Printed Status */}
                    <span className={`inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                      e.printed
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100/60'
                        : 'text-slate-500 bg-slate-150 border border-slate-200'
                    }`}>
                      <Printer className="h-3 w-3 stroke-[2.2]" />
                      {e.printed ? 'Printed' : 'Not Printed'}
                    </span>
                  </div>

                  {/* Pricing and Action */}
                  <div className="flex items-center gap-4.5">
                    <p className="text-sm font-black text-slate-900 font-mono tracking-tight shrink-0">
                      {formatCurrency(e.totalAmount || 0)}
                    </p>
                    
                    <button
                      onClick={() => handlePrintBill(e)}
                      className="p-3 bg-white hover:bg-indigo-650 text-slate-600 hover:text-white border border-slate-200 hover:border-indigo-650 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                      title="Print Invoice"
                    >
                      <Printer className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center mt-6">
          <Link 
            to="/entries" 
            className="text-xs font-black text-indigo-650 hover:text-indigo-750 uppercase tracking-wider flex items-center gap-1.5 bg-indigo-50/50 hover:bg-indigo-50 px-5 py-3 rounded-2xl transition-colors"
          >
            Go to Voucher History <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>

      {/* Off-screen container for react-to-print to prevent mobile fallbacks */}
      {printData && (
        <div id="printable-invoice-root" className="print-container absolute top-[-9999px] left-[-9999px] print:static print:block font-sans text-black">
          <PrintableInvoice ref={printRef} data={printData} user={user} />
        </div>
      )}

      {/* Bank Statement Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-none">Upload Bank Statement</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Extract, review, edit, and sync bank vouchers directly to Tally</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsBankModalOpen(false);
                  setBankFile(null);
                  setBankParseResult(null);
                  setTempTransactions([]);
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleBankUpload} className="p-6 space-y-5 overflow-y-auto flex-1">
              {!bankParseResult ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bank Selection */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Bank</label>
                      <select 
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                        disabled={parsingBank}
                      >
                        {SUPPORTED_BANKS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* PDF File Upload dropzone */}
                    <div className="sm:col-span-2 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-indigo-50/5 transition-all relative">
                      <input 
                        type="file" 
                        accept=".pdf"
                        onChange={(e) => setBankFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={parsingBank}
                      />
                      <CreditCard className="h-10 w-10 text-indigo-500 mb-3 stroke-[1.5]" />
                      <span className="text-sm font-bold text-slate-700">
                        {bankFile ? bankFile.name : 'Choose bank statement PDF'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        {bankFile ? `${(bankFile.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF format only'}
                      </span>
                    </div>

                    {/* PDF Password Input */}
                    {bankFile && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PDF Password (If Encrypted)</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showBankPassword ? "text" : "password"}
                            placeholder="Enter statement password (e.g. DOB, PAN, Account No)"
                            value={bankPassword}
                            onChange={(e) => setBankPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                            disabled={parsingBank}
                          />
                          <button
                            type="button"
                            onClick={() => setShowBankPassword(!showBankPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
                            title={showBankPassword ? "Hide password" : "Show password"}
                          >
                            {showBankPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBankModalOpen(false);
                        setBankFile(null);
                      }}
                      className="px-5 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      disabled={parsingBank}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!bankFile || parsingBank}
                      className="px-6 py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parsingBank ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Extracting Statement Data...
                        </>
                      ) : (
                        'Extract & View Data'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Top Statement Info Banner */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bank Statement Info</div>
                        <div className="text-base font-black text-white flex items-center gap-2">
                          {selectedBank || targetBankLedger}
                          {bankParseResult.accountNumber && (
                            <span className="text-xs font-semibold text-slate-400">
                              (A/c: {bankParseResult.accountNumber})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 text-right">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Opening Balance</span>
                          <span className="text-xs font-black text-emerald-400">
                            ₹{cleanNum(bankParseResult.openingBalance).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Closing Balance</span>
                          <span className="text-xs font-black text-indigo-400">
                            ₹{cleanNum(bankParseResult.closingBalance).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {bankParseResult?.statementPeriod?.from && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Period</span>
                            <span className="text-xs font-bold text-slate-300">
                              {bankParseResult.statementPeriod.from} to {bankParseResult.statementPeriod.to || 'Present'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tally Bank Ledger Target Editor */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">Target Tally Ledger:</span>
                        <input 
                          type="text"
                          value={targetBankLedger}
                          onChange={(e) => handleApplyBankLedgerToAll(e.target.value)}
                          className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="text-xs font-bold text-slate-400">
                        Total Transactions: <span className="text-white font-mono">{tempTransactions.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* High Density Statement Transactions Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                    <div className="max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="p-3 w-28">Date</th>
                            <th className="p-3">Particulars / Narration</th>
                            <th className="p-3 text-right w-32">Deposits (Cr)</th>
                            <th className="p-3 text-right w-32">Withdrawals (Dr)</th>
                            <th className="p-3 text-right w-36">Balance</th>
                            <th className="p-3 text-center w-24">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {(() => {
                            let runningBal = cleanNum(bankParseResult?.openingBalance);
                            return tempTransactions.map((txn: any, idx: number) => {
                              const amt = cleanNum(txn.totalAmount);
                              const typeLower = (txn.type || '').toLowerCase();
                              let isDeposit = typeLower === 'receipt';
                              let isWithdrawal = typeLower === 'payment';
                              if (typeLower === 'contra') {
                                if ((txn.notes || '').toLowerCase().includes('deposit') || (txn.partyName || '').toLowerCase().includes('deposit')) {
                                  isDeposit = true;
                                } else {
                                  isWithdrawal = true;
                                }
                              }

                              if (isDeposit) runningBal += amt;
                              else if (isWithdrawal) runningBal -= amt;

                              const isEditing = editingTxnIdx === idx;

                              return (
                                <tr key={idx} className={isEditing ? "bg-indigo-50/50" : "hover:bg-slate-50/80 transition-colors"}>
                                  {/* Date */}
                                  <td className="p-3 align-top whitespace-nowrap font-mono text-slate-600">
                                    {isEditing ? (
                                      <input 
                                        type="date"
                                        value={txn.date}
                                        onChange={(e) => updateTempTxn(idx, 'date', e.target.value)}
                                        className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                                      />
                                    ) : (
                                      txn.date
                                    )}
                                  </td>

                                  {/* Particulars & Narration */}
                                  <td className="p-3 align-top">
                                    {isEditing ? (
                                      <div className="space-y-1">
                                        <input 
                                          type="text"
                                          value={txn.partyName}
                                          onChange={(e) => updateTempTxn(idx, 'partyName', e.target.value)}
                                          placeholder="Party Ledger Name"
                                          className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                                        />
                                        <input 
                                          type="text"
                                          value={txn.notes}
                                          onChange={(e) => updateTempTxn(idx, 'notes', e.target.value)}
                                          placeholder="Narration details..."
                                          className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] text-slate-600"
                                        />
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="font-bold text-slate-900">{txn.partyName || 'Bank Entry'}</div>
                                        <div className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">{txn.notes}</div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Deposits */}
                                  <td className="p-3 align-top text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                    {isEditing ? (
                                      <div className="space-y-1">
                                        <select
                                          value={txn.type}
                                          onChange={(e) => updateTempTxn(idx, 'type', e.target.value)}
                                          className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] font-bold uppercase"
                                        >
                                          <option value="receipt">Receipt (Cr)</option>
                                          <option value="payment">Payment (Dr)</option>
                                          <option value="contra">Contra</option>
                                        </select>
                                        <input 
                                          type="number"
                                          value={txn.totalAmount}
                                          onChange={(e) => updateTempTxn(idx, 'totalAmount', parseFloat(e.target.value) || 0)}
                                          className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-right"
                                        />
                                      </div>
                                    ) : isDeposit ? (
                                      `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                    ) : (
                                      <span className="text-slate-300 font-normal">-</span>
                                    )}
                                  </td>

                                  {/* Withdrawals */}
                                  <td className="p-3 align-top text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                    {!isEditing && (isWithdrawal ? (
                                      `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                    ) : (
                                      <span className="text-slate-300 font-normal">-</span>
                                    ))}
                                  </td>

                                  {/* Balance */}
                                  <td className="p-3 align-top text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                    `₹${runningBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                  </td>

                                  {/* Action */}
                                  <td className="p-3 align-top text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditingTxnIdx(isEditing ? null : idx)}
                                        className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                        title={isEditing ? "Save Row" : "Edit Row"}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeTempTxn(idx)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete Row"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sync to Tally Footer Action Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBankModalOpen(false);
                        setBankFile(null);
                        setBankParseResult(null);
                        setTempTransactions([]);
                      }}
                      className="px-5 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      disabled={syncSaving}
                    >
                      Discard Statement
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndSyncBank}
                      disabled={syncSaving || tempTransactions.length === 0}
                      className="px-8 py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {syncSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Syncing Vouchers to Tally...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Sync ({tempTransactions.length} Transactions) to Tally
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} />
    </Layout>
  );
};

const StatCard: React.FC<any> = ({ title, value, icon: Icon, color, change, positive, description }) => {
  const iconColors: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-indigo-300 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={`p-3.5 rounded-2xl ${iconColors[color]} group-hover:scale-105 transition-transform duration-300`}>
          <Icon className="h-5.5 w-5.5 stroke-[2.2]" />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
          positive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
        }`}>
          {change}
        </span>
      </div>
      <div className="mt-5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{title}</p>
        <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">{value}</h4>
        <p className="text-[10px] text-slate-400 font-semibold mt-1">{description}</p>
      </div>
    </div>
  );
};

export default Dashboard;