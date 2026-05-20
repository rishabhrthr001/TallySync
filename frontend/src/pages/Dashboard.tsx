import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, CreditCard
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [stockValue, setStockValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, inventoryRes] = await Promise.all([
          axios.get('/api/entries/dashboard-stats', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }),
          axios.get('/api/inventory', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        setStats(statsRes.data);
        
        // Calculate stock value
        const totalStockValue = inventoryRes.data.reduce((acc: number, item: any) => {
          return acc + (item.stock > 0 ? item.stock * item.rate : 0);
        }, 0);
        setStockValue(totalStockValue);
        
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = stats?.monthlySales.map((val: number, i: number) => ({
    name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    sales: val,
    purchase: stats.monthlyPurchase[i]
  })) || [];

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  const netProfit = (stats?.totalSales || 0) - (stats?.totalPurchase || 0);

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h2>
          <p className="text-slate-500 mt-1 font-medium">{user?.companyName} - Real-time metrics</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Sales" 
          value={formatCurrency(stats?.totalSales || 0)} 
          icon={TrendingUp} 
          color="indigo" 
        />
        <StatCard 
          title="Total Purchase" 
          value={formatCurrency(stats?.totalPurchase || 0)} 
          icon={TrendingDown} 
          color="amber" 
        />
        <StatCard 
          title="Net Profit" 
          value={formatCurrency(netProfit)} 
          icon={CreditCard} 
          color={netProfit >= 0 ? "emerald" : "rose"} 
        />
        <StatCard 
          title="Stock Value" 
          value={formatCurrency(stockValue)} 
          icon={Package} 
          color="slate" 
        />
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
        <h3 className="font-bold text-slate-800 mb-6">Monthly Sales vs Purchase Trend</h3>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
              <Tooltip 
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', fontWeight: 700}} 
                cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}}
              />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="purchase" name="Purchase" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorPurchase)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
};

const StatCard: React.FC<any> = ({ title, value, icon: Icon, color }) => {
  const colors: any = {
    indigo: 'bg-indigo-600 shadow-indigo-200 text-white',
    amber: 'bg-amber-500 shadow-amber-200 text-white',
    rose: 'bg-rose-500 shadow-rose-200 text-white',
    emerald: 'bg-emerald-500 shadow-emerald-200 text-white',
    slate: 'bg-slate-800 shadow-slate-200 text-white'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 group hover:border-indigo-200 transition-colors">
      <div className={`p-4 rounded-2xl ${colors[color]} group-hover:scale-105 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-1">{value}</h4>
      </div>
    </div>
  );
};

export default Dashboard;
