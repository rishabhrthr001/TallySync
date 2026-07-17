import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, CreditCard, Plus, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCcw
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';

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
      
      setRecentEntries((entriesRes.data || []).slice(0, 5));
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

      {/* Recent Entries Section */}
      <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-black text-slate-850 text-lg">Recent Entries</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Quick status monitoring</p>
          </div>
          <Link 
            to="/entries" 
            className="text-xs font-black text-indigo-650 hover:text-indigo-750 uppercase tracking-wider flex items-center gap-1"
          >
            View All <ArrowUpRight className="h-4.5 w-4.5" />
          </Link>
        </div>

        {/* Mobile-optimized list of recent entries */}
        <div className="space-y-3.5">
          {recentEntries.length === 0 ? (
            <p className="text-center text-sm font-semibold text-slate-405 py-6">No recent entries found</p>
          ) : (
            recentEntries.map((e: any) => (
              <div 
                key={e._id} 
                className="flex items-center justify-between p-4 bg-slate-50/40 hover:bg-slate-50/80 rounded-2xl border border-slate-100/80 hover:border-indigo-100 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl hidden sm:block ${
                    e.type === 'sales' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {e.type === 'sales' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate leading-snug">{e.partyName}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 font-mono">
                      {e.invoiceNumber || 'NO-REF'} • {e.date}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(e.totalAmount || 0)}</p>
                    <span className={`inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-md ${
                      e.status === 'success' ? 'text-emerald-600 bg-emerald-50' :
                      e.status === 'failed' ? 'text-rose-600 bg-rose-50' :
                      'text-amber-600 bg-amber-55 animate-pulse'
                    }`}>
                      {e.status || 'pending'}
                    </span>
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

