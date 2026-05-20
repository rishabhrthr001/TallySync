import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Users, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  RefreshCcw,
  BarChart3,
  Layers,
  ShoppingBag,
  CreditCard,
  History
} from 'lucide-react';
import Layout from '../components/Layout';
import { motion } from 'motion/react';
import { formatCurrency } from '../utils/format';

const Ledgers: React.FC = () => {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLedgers();
  }, []);

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

  const filteredLedgers = ledgers.filter(l => l.partyName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600 mb-6 shadow-[0_0_20px_rgba(79,70,229,0.3)]"></div>
      <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">CALCULATING BALANCES...</p>
    </div>
  );

  return (
    <Layout>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Party Balances</h2>
          <p className="text-slate-500 mt-1">Real-time receivables and payables tracking</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 text-sm font-bold bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
          <Plus className="h-4 w-4" />
          <span>Add New Party</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatNode title="Total Parties" value={ledgers.length} icon={Users} color="indigo" />
        <StatNode title="Total Receivables" value={formatCurrency(ledgers.reduce((acc, l) => l.balance > 0 ? acc + l.balance : acc, 0))} icon={ArrowUpRight} color="emerald" positive={true} />
        <StatNode title="Total Payables" value={formatCurrency(Math.abs(ledgers.reduce((acc, l) => l.balance < 0 ? acc + l.balance : acc, 0)))} icon={ArrowDownRight} color="rose" positive={false} />
        <StatNode title="Net Outstanding" value={formatCurrency(ledgers.reduce((acc, l) => acc + l.balance, 0))} icon={CreditCard} color="indigo" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden shadow-slate-200/50">
        <div className="p-6 border-b border-slate-100 flex items-center bg-slate-50/50 backdrop-blur-md">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-4 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search party by name or GSTIN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          <button onClick={fetchLedgers} className="ml-4 p-4 text-slate-500 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100">
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-10 py-6">Party Identity</th>
                <th className="px-10 py-6 text-center">Closing Balance</th>
                <th className="px-10 py-6 text-right">Accounting Status</th>
                <th className="px-10 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLedgers.map((l, idx) => (
                <motion.tr 
                  key={l._id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-indigo-50/50 transition-all cursor-pointer group"
                >
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 bg-white flex items-center justify-center rounded-2xl shadow-sm text-lg font-black text-indigo-700 uppercase border border-slate-100 group-hover:scale-110 transition-transform">
                        {l.partyName[0]}
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">{l.partyName}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">GST: {l.gstin || 'UNREGISTERED'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center font-black text-2xl">
                    <span className={l.balance > 0 ? 'text-emerald-600' : l.balance < 0 ? 'text-rose-600' : 'text-slate-900 opacity-20'}>
                      {formatCurrency(Math.abs(l.balance))}
                      <small className="text-[10px] ml-1 opacity-50">{l.balance >= 0 ? 'Dr' : 'Cr'}</small>
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${
                      l.balance > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      l.balance < 0 ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                      'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {l.balance > 0 ? 'Receivable' : l.balance < 0 ? 'Payable' : 'Cleared'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm">
                      <History className="h-5 w-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {ledgers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="h-24 w-24 bg-slate-50 flex items-center justify-center rounded-full mb-6">
                <Users className="h-12 w-12 opacity-10" />
              </div>
              <p className="font-black text-2xl tracking-tighter text-slate-900">No parties added yet</p>
              <p className="text-sm font-semibold mt-1">Start entering vouchers to automatically build your ledger.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const StatNode: React.FC<any> = ({ title, value, icon: Icon, color, positive }) => {
  const colors: any = {
    indigo: 'bg-indigo-600',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500'
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-all h-full">
      <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-500`}>
        <Icon className="h-24 w-24" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{title}</p>
      <div className="flex items-center gap-3">
        <h4 className={`text-2xl font-black ${positive === true ? 'text-emerald-600' : positive === false ? 'text-rose-600' : 'text-slate-900'}`}>{value}</h4>
      </div>
    </div>
  );
};

export default Ledgers;
