import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCcw,
  Plus,
  Search,
  Building2,
  Phone,
  MapPin,
  Hash,
  Loader2,
  AlertCircle,
  Building,
  Trash2,
  Edit,
  CheckCircle,
  Info,
  LogOut,
  ArrowLeft,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import axios from 'axios';
import { formatCurrency } from '../utils/format';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  companyName?: string;
  gstin?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
}

interface Entry {
  _id: string;
  userId: any;
  userName: string;
  companyName: string;
  type: string;
  partyName: string;
  totalAmount: number;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  invoiceNumber: string;
}

export default function Admin() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'clients' | 'reports'>('entries');
  const [selectedCompanyForReport, setSelectedCompanyForReport] = useState<User | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    gstin: '',
    phone: '',
    address: ''
  });
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  
  // New states for Manage Firm functionality
  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [clientToDelete, setClientToDelete] = useState<User | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExit = () => {
    logout();
    navigate('/login');
  };

  const handleTabChange = (tab: 'entries' | 'clients' | 'reports') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSelectedCompanyForReport(null); // Clear active report when switching tabs
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (tabParam === 'reports') {
      setActiveTab('reports');
    } else if (tabParam === 'clients') {
      setActiveTab('clients');
    } else if (tabParam === 'entries') {
      setActiveTab('entries');
    }
  }, [tabParam]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [usersRes, entriesRes] = await Promise.all([
        axios.get('/api/users', { headers }),
        axios.get('/api/entries', { headers })
      ]);
      setUsers(usersRes.data);
      setEntries(entriesRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      await axios.patch(`/api/entries/${id}/status`, { status }, { headers });
      setEntries(prev => prev.map(e => e._id === id ? { ...e, status: status as any } : e));
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setProcessingId(id);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      await axios.post(`/api/entries/${id}/retry`, {}, { headers });
      setEntries(prev => prev.map(e => e._id === id ? { ...e, status: 'pending' } : e));
    } catch (error) {
      console.error('Failed to retry entry:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.post('/api/admin/clients', newClient, { headers });
      setUsers(prev => [...prev, res.data]);
      setIsModalOpen(false);
      setNewClient({ name: '', email: '', password: '', companyName: '', gstin: '', phone: '', address: '' });
      showToast('New firm provisioned successfully');
    } catch (error: any) {
      setModalError(error.response?.data?.error || 'Failed to create client');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setModalLoading(true);
    setModalError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.patch(`/api/admin/clients/${editingClient._id}`, editingClient, { headers });
      setUsers(prev => prev.map(u => u._id === editingClient._id ? res.data : u));
      setEditingClient(null);
      showToast('Firm profile updated');
    } catch (error: any) {
      setModalError(error.response?.data?.error || 'Failed to update client');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setProcessingId(clientToDelete._id);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      await axios.delete(`/api/admin/clients/${clientToDelete._id}`, { headers });
      setUsers(prev => prev.filter(u => u._id !== clientToDelete._id));
      setClientToDelete(null);
      showToast('Firm terminated from network');
    } catch (error) {
      console.error('Failed to delete client:', error);
      showToast('Failed to delete firm', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing Control Vault...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">System Admin</div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Mainframe Dashboard</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">Oversee multi-tenant synchronization and firm accounts</p>
        </div>
        <div className="flex flex-col sm:flex-row md:flex-row items-center gap-4 w-full md:w-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-600 font-black uppercase tracking-widest text-[10px] rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm active:scale-95 w-full sm:w-auto"
          >
            <Building2 className="w-4 h-4" />
            Go to Main Dashboard
          </button>
          <button
            onClick={handleExit}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 font-black uppercase tracking-widest text-[10px] rounded-xl border border-rose-100 hover:bg-rose-100 transition-all shadow-sm active:scale-95 w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full whitespace-nowrap w-full sm:w-auto">
            <button
              onClick={() => handleTabChange('entries')}
              className={`flex-shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'entries' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Entry Stream
            </button>
            <button
              onClick={() => handleTabChange('clients')}
              className={`flex-shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'clients' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Firm Network
            </button>
            <button
              onClick={() => handleTabChange('reports')}
              className={`flex-shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Company Reports
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'entries' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-black text-slate-900 text-xl flex items-center gap-3">
              <RefreshCcw className="w-6 h-6 text-indigo-600" />
              Real-time Sync Queue
            </h2>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100">Live Agent Active</div>
            </div>
          </div>
          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-10 py-6">Firm & Timeline</th>
                  <th className="px-10 py-6">Voucher Mapping</th>
                  <th className="px-10 py-6">Impact Value</th>
                  <th className="px-10 py-6 text-center">Tally Status</th>
                  <th className="px-10 py-6 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map(entry => (
                  <tr key={entry._id} className="hover:bg-indigo-50/30 transition-all group">
                    <td className="px-10 py-8">
                      <div className="text-base font-black text-slate-900 leading-tight">{entry.companyName || entry.userName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Logged: {format(new Date(entry.createdAt), 'MMM d, HH:mm')}</div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${entry.type === 'sales' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                          {entry.type}
                        </span>
                        <span className="text-sm font-bold text-slate-800 italic">{entry.invoiceNumber || 'NO-REF'}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium">Party: {entry.partyName}</div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="text-xl font-black text-slate-900">{formatCurrency(entry.totalAmount)}</div>
                      <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Hash className="w-3 h-3" /> Ledger Posting</div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col items-center">
                        <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-2xl ${
                          entry.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                          entry.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                          'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {entry.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(entry._id)}
                            disabled={processingId === entry._id}
                            className="p-3 text-indigo-600 hover:bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:scale-110"
                          >
                            <RefreshCcw className={`w-5 h-5 ${processingId === entry._id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        {entry.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(entry._id, 'success')}
                              className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => updateStatus(entry._id, 'failed')}
                              className="p-3 text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-5 top-4 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search firm network by name, email, or company..." 
                className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none shadow-xl shadow-slate-200/30"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-[2rem] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Register New Firm
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {users.filter(u => u.role === 'client').map(client => (
              <div key={client._id} className="bg-white p-8 rounded-[3rem] border border-slate-200 hover:border-indigo-400 transition-all group shadow-xl shadow-slate-200/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-center text-2xl font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 rotate-6 group-hover:rotate-0 shadow-lg">
                      {client.companyName?.[0] || client.name[0]}
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                      Standard Firm
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1 leading-tight group-hover:text-indigo-600 transition-colors">{client.companyName || 'Unmapped Firm'}</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-6">
                    <Building className="w-3 h-3" /> {client.name}
                  </div>
                  
                  <div className="space-y-3 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                      <Hash className="w-4 h-4 text-slate-300" />
                      <span>{client.gstin || 'No GST Mapping'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                      <Phone className="w-4 h-4 text-slate-300" />
                      <span>{client.phone || 'No Contact'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-300 italic">Member since {format(new Date(client.createdAt || Date.now()), 'MMM yyyy')}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedCompanyForReport(client);
                        setActiveTab('reports');
                        setSearchParams({ tab: 'reports' });
                      }}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="View Report"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setEditingClient(client)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Edit Firm"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setClientToDelete(client)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Delete Firm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        selectedCompanyForReport ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-2xl shadow-slate-200/50 space-y-8">
            <button
              onClick={() => setSelectedCompanyForReport(null)}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Back to Company List
            </button>
            
            <div className="border-b border-slate-100 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">
                  {selectedCompanyForReport.companyName || 'Unmapped Firm'}
                </h2>
                <p className="text-slate-500 font-medium text-sm mt-1">
                  Firm report & activity overview for Tally synchronizations.
                </p>
              </div>
              <div className="px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sync Success Rate</span>
                <span className="text-2xl font-black text-indigo-700 mt-1">
                  {(() => {
                    const compEntries = entries.filter(e => e.companyName === selectedCompanyForReport.companyName);
                    const success = compEntries.filter(e => e.status === 'success').length;
                    const total = compEntries.length;
                    return total > 0 ? Math.round((success / total) * 100) : 100;
                  })()}%
                </span>
              </div>
            </div>

            {/* Firm info & Stats */}
            {(() => {
              const compEntries = entries.filter(e => e.companyName === selectedCompanyForReport.companyName);
              const successCount = compEntries.filter(e => e.status === 'success').length;
              const pendingCount = compEntries.filter(e => e.status === 'pending').length;
              const failedCount = compEntries.filter(e => e.status === 'failed').length;
              
              const totalSales = compEntries
                .filter(e => e.type === 'sales' && e.status === 'success')
                .reduce((sum, e) => sum + (e.totalAmount || 0), 0);
              
              const totalPurchases = compEntries
                .filter(e => e.type === 'purchase' && e.status === 'success')
                .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Vouchers</div>
                      <div className="text-3xl font-black text-slate-800 mt-2">{compEntries.length}</div>
                      <div className="text-[10px] text-slate-400 mt-1 font-bold">All-time uploaded</div>
                    </div>
                    <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Sales Value</div>
                      <div className="text-3xl font-black text-emerald-700 mt-2">{formatCurrency(totalSales)}</div>
                      <div className="text-[10px] text-emerald-600 mt-1 font-bold">Successful syncs</div>
                    </div>
                    <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100/50">
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total Purchase Value</div>
                      <div className="text-3xl font-black text-amber-700 mt-2">{formatCurrency(totalPurchases)}</div>
                      <div className="text-[10px] text-amber-600 mt-1 font-bold">Successful syncs</div>
                    </div>
                    <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100/50">
                      <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">Failed / Pending</div>
                      <div className="text-3xl font-black text-rose-700 mt-2">
                        {failedCount} <span className="text-slate-400 text-sm font-bold">/</span> {pendingCount}
                      </div>
                      <div className="text-[10px] text-rose-600 mt-1 font-bold">Requires attention</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Owner / Representative</div>
                      <div className="text-base font-black text-slate-700 mt-1">{selectedCompanyForReport.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Official Email</div>
                      <div className="text-base font-black text-slate-700 mt-1">{selectedCompanyForReport.email}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">GSTIN / Tax ID</div>
                      <div className="text-base font-black text-slate-700 mt-1">{selectedCompanyForReport.gstin || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Table of company entries */}
                  <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                      <h4 className="font-black text-slate-900">Recent Sync History</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Timeline</th>
                            <th className="px-6 py-4">Voucher No</th>
                            <th className="px-6 py-4">Party</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                          {compEntries.slice(0, 15).map(e => (
                            <tr key={e._id} className="hover:bg-slate-50/30 transition-all">
                              <td className="px-6 py-4 text-xs text-slate-400">{format(new Date(e.createdAt), 'MMM d, HH:mm')}</td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-900">{e.invoiceNumber || 'N/A'}</td>
                              <td className="px-6 py-4">{e.partyName}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${e.type === 'sales' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {e.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(e.totalAmount)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                  e.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                                  e.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                                  'bg-rose-50 text-rose-700 border border-rose-100'
                                } border`}>
                                  {e.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {compEntries.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-slate-400 font-bold">No entries found for this firm.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900 text-xl flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Company-Wise Report Overview
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-10 py-6">Company / Firm Name</th>
                    <th className="px-10 py-6 text-center">Total Vouchers</th>
                    <th className="px-10 py-6 text-center">Success Vouchers</th>
                    <th className="px-10 py-6 text-center">Failed Vouchers</th>
                    <th className="px-10 py-6 text-center">Success Rate</th>
                    <th className="px-10 py-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => u.role === 'client').map(client => {
                    const compEntries = entries.filter(e => e.companyName === client.companyName);
                    const success = compEntries.filter(e => e.status === 'success').length;
                    const failed = compEntries.filter(e => e.status === 'failed').length;
                    const total = compEntries.length;
                    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
                    
                    return (
                      <tr key={client._id} className="hover:bg-indigo-50/30 transition-all group">
                        <td className="px-10 py-8">
                          <div className="text-base font-black text-slate-900 leading-tight">{client.companyName || 'Unmapped Firm'}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Owner: {client.name}</div>
                        </td>
                        <td className="px-10 py-8 text-center font-bold text-slate-700">{total}</td>
                        <td className="px-10 py-8 text-center font-bold text-emerald-600">{success}</td>
                        <td className="px-10 py-8 text-center font-bold text-rose-500">{failed}</td>
                        <td className="px-10 py-8 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                            successRate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                            successRate >= 50 ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {successRate}%
                          </span>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <button
                            onClick={() => setSelectedCompanyForReport(client)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {users.filter(u => u.role === 'client').length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 font-bold">No firms registered on this network.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Terminate Firm?</h3>
                <p className="text-slate-500 font-medium mt-2">
                  This will permanently remove <span className="font-bold text-slate-700">"{clientToDelete.companyName || clientToDelete.name}"</span> and all associated access. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setClientToDelete(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteClient}
                  className="flex-1 py-4 bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-rose-600 shadow-xl shadow-rose-200"
                >
                  Yes, Terminate
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full max-w-2xl rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Edit Firm Profile</h3>
                <p className="text-slate-400 text-sm font-medium">Update configurations for {editingClient.companyName}</p>
              </div>
              <button 
                onClick={() => setEditingClient(null)} 
                className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-2xl hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-7 h-7 text-slate-300" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateClient} className="p-10 space-y-8">
              {modalError && (
                <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-2xl flex items-center gap-3 font-bold">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {modalError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                  <input 
                    required
                    type="text" 
                    value={editingClient.name}
                    onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Firm Email</label>
                  <input 
                    required
                    type="email" 
                    value={editingClient.email}
                    onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Official Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    value={editingClient.companyName}
                    onChange={e => setEditingClient({...editingClient, companyName: e.target.value})}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">GSTIN</label>
                  <input 
                    type="text" 
                    value={editingClient.gstin}
                    onChange={e => setEditingClient({...editingClient, gstin: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Update Password (Optional)</label>
                  <input 
                    type="password" 
                    onChange={e => setEditingClient({...editingClient, password: e.target.value} as any)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-8 py-5 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-3xl hover:bg-slate-200 transition-all flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={modalLoading}
                  className="px-8 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-3xl hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all flex-[2] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Provision Firm Profile</h3>
                <p className="text-slate-400 text-sm font-medium">Create a managed instance for a new firm</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-2xl hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-7 h-7 text-slate-300" />
              </button>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-10 space-y-8">
              {modalError && (
                <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-2xl flex items-center gap-3 font-bold">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {modalError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                  <input 
                    required
                    type="text" 
                    value={newClient.name}
                    onChange={e => setNewClient({...newClient, name: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                    placeholder="Full Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Firm Email</label>
                  <input 
                    required
                    type="email" 
                    value={newClient.email}
                    onChange={e => setNewClient({...newClient, email: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                    placeholder="firm@domain.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Official Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    value={newClient.companyName}
                    onChange={e => setNewClient({...newClient, companyName: e.target.value})}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                    placeholder="PhotoBill Private Limited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">GSTIN</label>
                  <input 
                    type="text" 
                    value={newClient.gstin}
                    onChange={e => setNewClient({...newClient, gstin: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                    placeholder="27ABCDE..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Access Key</label>
                  <input 
                    required
                    type="password" 
                    value={newClient.password}
                    onChange={e => setNewClient({...newClient, password: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-5 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-3xl hover:bg-slate-200 transition-all flex-1"
                >
                  Terminate Request
                </button>
                <button 
                  type="submit"
                  disabled={modalLoading}
                  className="px-8 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-3xl hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all flex-[2] flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Profile Creation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
