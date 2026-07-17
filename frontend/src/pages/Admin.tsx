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
  BarChart3,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import axios from 'axios';
import { formatCurrency } from '../utils/format';
import Layout from '../components/Layout';

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
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'clients' | 'reports'>('entries');
  const [selectedCompanyForReport, setSelectedCompanyForReport] = useState<User | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Search state
  const [syncSearchTerm, setSyncSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');

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
  
  // Edit & delete states
  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [clientToDelete, setClientToDelete] = useState<User | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
      showToast(`Voucher status marked as ${status}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      showToast('Failed to update voucher status', 'error');
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
      showToast('Re-queued voucher sync job');
    } catch (error) {
      console.error('Failed to retry entry:', error);
      showToast('Failed to re-queue sync job', 'error');
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
      showToast('Firm profile updated successfully');
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

  const filteredEntries = entries.filter(e => {
    const matchesSearch = 
      e.companyName.toLowerCase().includes(syncSearchTerm.toLowerCase()) ||
      e.partyName.toLowerCase().includes(syncSearchTerm.toLowerCase()) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(syncSearchTerm.toLowerCase()));
    return matchesSearch;
  });

  const filteredClients = users.filter(u => {
    if (u.role !== 'client') return false;
    const matchesSearch = 
      u.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      (u.companyName && u.companyName.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (u.gstin && u.gstin.toLowerCase().includes(clientSearchTerm.toLowerCase()));
    return matchesSearch;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50/50">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Control Vault...</p>
    </div>
  );

  return (
    <Layout>
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 mb-8 border-b border-slate-200/60 pb-8">
        <div>
          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider font-mono">System Admin</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5 font-sans">Mainframe Dashboard</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">Oversee multi-tenant synchronization log and tenant profiles</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 max-w-full overflow-x-auto whitespace-nowrap self-start lg:self-auto">
          <button
            onClick={() => handleTabChange('entries')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'entries' ? 'bg-white text-indigo-600 shadow-md shadow-indigo-500/5' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sync Queue
          </button>
          <button
            onClick={() => handleTabChange('clients')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'clients' ? 'bg-white text-indigo-600 shadow-md shadow-indigo-500/5' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Firm Network
          </button>
          <button
            onClick={() => handleTabChange('reports')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-md shadow-indigo-500/5' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Company Reports
          </button>
        </div>
      </div>

      {activeTab === 'entries' && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] overflow-hidden">
          {/* Filters Bar */}
          <div className="p-5 border-b border-slate-150 flex flex-col sm:flex-row gap-4 items-center bg-slate-50/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search log queue by firm, party, invoice..." 
                value={syncSearchTerm}
                onChange={(e) => setSyncSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
              />
            </div>
            
            <button onClick={fetchData} className="p-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-sm transition-colors cursor-pointer self-stretch sm:self-auto flex items-center justify-center">
              <RefreshCcw className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Desktop Sync Log Table */}
          <div className="hidden lg:block overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-150">
                  <th className="px-8 py-5">Firm & Timeline</th>
                  <th className="px-8 py-5">Voucher Mapping</th>
                  <th className="px-8 py-5">Impact Value</th>
                  <th className="px-8 py-5 text-center">Tally Status</th>
                  <th className="px-8 py-5 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                <AnimatePresence>
                  {filteredEntries.map((entry, idx) => {
                    const isSuccess = entry.status === 'success';
                    const isPending = entry.status === 'pending';
                    const isFailed = entry.status === 'failed';
                    return (
                      <motion.tr 
                        key={entry._id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ delay: idx * 0.01 }}
                        className="hover:bg-slate-50/30 transition-all font-semibold text-slate-750 group"
                      >
                        <td className="px-8 py-5">
                          <span className="font-bold text-slate-900 block leading-tight">{entry.companyName || entry.userName}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 block">
                            {format(new Date(entry.createdAt), 'MMM d, HH:mm')}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              entry.type === 'sales' ? 'bg-indigo-50 text-indigo-750 border border-indigo-100' : 'bg-amber-50 text-amber-750 border border-amber-100'
                            }`}>
                              {entry.type}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">{entry.invoiceNumber || 'NO-REF'}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-semibold block">Party: {entry.partyName}</span>
                        </td>
                        <td className="px-8 py-5 font-mono text-slate-900 font-bold text-base">
                          {formatCurrency(entry.totalAmount)}
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                            isPending ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                            'bg-rose-50 text-rose-700 border border-rose-100'
                          } border`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            {isFailed && (
                              <button
                                onClick={() => handleRetry(entry._id)}
                                disabled={processingId === entry._id}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                                title="Retry synchronization"
                              >
                                <RefreshCcw className={`w-4 h-4 ${processingId === entry._id ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                            {isPending && (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => updateStatus(entry._id, 'success')}
                                  disabled={processingId === entry._id}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                                  title="Approve manual success override"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => updateStatus(entry._id, 'failed')}
                                  disabled={processingId === entry._id}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                  title="Reject sync log"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Sync Queue Card List */}
          <div className="block lg:hidden p-4 space-y-4">
            <AnimatePresence>
              {filteredEntries.map((entry, idx) => {
                const isSuccess = entry.status === 'success';
                const isPending = entry.status === 'pending';
                const isFailed = entry.status === 'failed';
                return (
                  <motion.div
                    key={entry._id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: idx * 0.01 }}
                    className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{entry.companyName || entry.userName}</h4>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase block">
                          Logged: {format(new Date(entry.createdAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                        isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        isPending ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {entry.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Voucher</span>
                        <span className="text-xs font-bold text-slate-700 uppercase">{entry.type} • {entry.invoiceNumber || 'NO-REF'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Amount</span>
                        <span className="text-xs font-black text-slate-900 font-mono">{formatCurrency(entry.totalAmount)}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Party: {entry.partyName}</span>
                      <div className="flex gap-2">
                        {isFailed && (
                          <button
                            onClick={() => handleRetry(entry._id)}
                            disabled={processingId === entry._id}
                            className="p-2 text-indigo-600 bg-white border border-slate-200 rounded-xl"
                          >
                            <RefreshCcw className={`w-4 h-4 ${processingId === entry._id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        {isPending && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateStatus(entry._id, 'success')}
                              disabled={processingId === entry._id}
                              className="p-2 text-emerald-600 bg-white border border-slate-200 rounded-xl"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStatus(entry._id, 'failed')}
                              disabled={processingId === entry._id}
                              className="p-2 text-rose-600 bg-white border border-slate-200 rounded-xl"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <FileText className="h-14 w-14 opacity-20 mb-4" />
              <p className="font-bold text-lg text-slate-700">No sync entries queued</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search firm network by name, email, GSTIN..." 
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
              />
            </div>
            <button 
              onClick={() => {
                setModalError('');
                setNewClient({ name: '', email: '', password: '', companyName: '', gstin: '', phone: '', address: '' });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-500/10 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Register New Firm
            </button>
          </div>

          {/* Firm cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredClients.map((client, idx) => (
                <motion.div 
                  key={client._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] hover:border-indigo-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-lg font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm uppercase">
                        {client.companyName?.[0] || client.name[0]}
                      </div>
                      <span className="px-3 py-1 bg-emerald-55 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50">
                        Active Tenant
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                      {client.companyName || 'Unmapped Firm'}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5 mt-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-355" /> {client.name}
                    </p>
                    
                    <div className="space-y-2.5 pt-5 border-t border-slate-100 mt-5">
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                        <Hash className="w-4 h-4 text-slate-350 shrink-0" />
                        <span className="truncate">{client.gstin || 'GST Unregistered'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                        <Phone className="w-4 h-4 text-slate-350 shrink-0" />
                        <span>{client.phone || 'No Phone Number'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                      Added {client.createdAt ? format(new Date(client.createdAt), 'MMM yyyy') : 'N/A'}
                    </span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => {
                          setSelectedCompanyForReport(client);
                          setActiveTab('reports');
                          setSearchParams({ tab: 'reports' });
                        }}
                        className="p-2 text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all"
                        title="View sync report details"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setModalError('');
                          setEditingClient({ ...client });
                        }}
                        className="p-2 text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all"
                        title="Edit profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setClientToDelete(client)}
                        className="p-2 text-rose-550 bg-slate-50 hover:bg-rose-50 border border-slate-100 rounded-xl transition-all"
                        title="Terminate client instance"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Users className="h-14 w-14 opacity-20 mb-4" />
              <p className="font-bold text-lg text-slate-700">No firm accounts found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        selectedCompanyForReport ? (
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 md:p-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] space-y-6">
            <button
              onClick={() => setSelectedCompanyForReport(null)}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-sm font-sans"
            >
              <ArrowLeft className="w-4.5 h-4.5" /> Back to Network List
            </button>
            
            <div className="border-b border-slate-150 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  {selectedCompanyForReport.companyName || 'Unmapped Firm'}
                </h2>
                <p className="text-slate-400 text-xs font-semibold mt-1">
                  Firm report & activity overview for PhotoBill synchronizations
                </p>
              </div>
              <div className="px-5 py-3.5 border border-indigo-100 rounded-2xl flex flex-col justify-center bg-indigo-50 self-start sm:self-auto min-w-[140px]">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-650">Sync Success Rate</span>
                <span className="text-2xl font-black text-indigo-700 mt-1 font-mono">
                  {(() => {
                    const compEntries = entries.filter(e => e.companyName === selectedCompanyForReport.companyName);
                    const success = compEntries.filter(e => e.status === 'success').length;
                    const total = compEntries.length;
                    return total > 0 ? Math.round((success / total) * 100) : 100;
                  })()}%
                </span>
              </div>
            </div>

            {/* Firm Info & Stats cards */}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block leading-none">Total Vouchers</span>
                      <h4 className="text-2xl font-black text-slate-800 mt-2 font-mono leading-tight">{compEntries.length}</h4>
                      <p className="text-[9px] text-slate-400 mt-1 font-semibold leading-none">All-time uploaded</p>
                    </div>
                    <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block leading-none">Total Sales Value</span>
                      <h4 className="text-2xl font-black text-emerald-700 mt-2 font-mono leading-tight">{formatCurrency(totalSales)}</h4>
                      <p className="text-[9px] text-emerald-600 mt-1 font-semibold leading-none">Successful syncs</p>
                    </div>
                    <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 block leading-none">Total Purchase Value</span>
                      <h4 className="text-2xl font-black text-amber-700 mt-2 font-mono leading-tight">{formatCurrency(totalPurchases)}</h4>
                      <p className="text-[9px] text-amber-600 mt-1 font-semibold leading-none">Successful syncs</p>
                    </div>
                    <div className="bg-rose-50/30 p-5 rounded-2xl border border-rose-100/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 block leading-none">Failed / Pending</span>
                      <h4 className="text-2xl font-black text-rose-700 mt-2 font-mono leading-tight">
                        {failedCount} <span className="text-slate-450 text-sm font-medium">/</span> {pendingCount}
                      </h4>
                      <p className="text-[9px] text-rose-600 mt-1 font-semibold leading-none">Requires attention</p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Owner / Representative</span>
                      <span className="text-sm font-bold text-slate-700 mt-1 block leading-tight">{selectedCompanyForReport.name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Official Email</span>
                      <span className="text-sm font-bold text-slate-700 mt-1 block leading-tight">{selectedCompanyForReport.email}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">GSTIN / Tax ID</span>
                      <span className="text-sm font-bold text-slate-700 mt-1 block leading-tight">{selectedCompanyForReport.gstin || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Vouchers list */}
                  <div className="border border-slate-200/60 rounded-3xl overflow-hidden bg-white shadow-sm">
                    <div className="p-5 border-b border-slate-150 bg-slate-50/50">
                      <h4 className="font-black text-slate-900 text-sm">Recent Sync History</h4>
                    </div>
                    
                    {/* Desktop Sync History Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-150">
                            <th className="px-6 py-4">Timeline</th>
                            <th className="px-6 py-4">Voucher No</th>
                            <th className="px-6 py-4">Party</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {compEntries.slice(0, 15).map(e => (
                            <tr key={e._id} className="hover:bg-slate-50/30 transition-all">
                              <td className="px-6 py-4 text-slate-400">{format(new Date(e.createdAt), 'MMM d, HH:mm')}</td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-900">{e.invoiceNumber || 'N/A'}</td>
                              <td className="px-6 py-4">{e.partyName}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                  e.type === 'sales' ? 'bg-indigo-50 text-indigo-750 border-indigo-100' : 'bg-amber-50 text-amber-755 border-amber-100'
                                }`}>
                                  {e.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono">{formatCurrency(e.totalAmount)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
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

                    {/* Mobile Sync History List */}
                    <div className="block md:hidden p-4 space-y-4">
                      {compEntries.slice(0, 15).map(e => {
                        const isSuccess = e.status === 'success';
                        const isPending = e.status === 'pending';
                        return (
                          <div key={e._id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold">{format(new Date(e.createdAt), 'MMM d, HH:mm')}</span>
                                <h5 className="text-xs font-black text-slate-900 font-mono mt-0.5">{e.invoiceNumber || 'N/A'}</h5>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                isPending ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {e.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-semibold">{e.partyName} ({e.type})</span>
                              <span className="font-black text-slate-900 font-mono">{formatCurrency(e.totalAmount)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {compEntries.length === 0 && (
                        <p className="text-center py-8 text-slate-400 font-bold text-sm">No entries found for this firm.</p>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="p-6 border-b border-slate-150 bg-slate-50/50">
              <h2 className="font-black text-slate-900 text-lg flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Company Reports Overview
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-150">
                    <th className="px-8 py-5">Company / Firm Name</th>
                    <th className="px-8 py-5 text-center">Total Vouchers</th>
                    <th className="px-8 py-5 text-center">Success</th>
                    <th className="px-8 py-5 text-center">Failed</th>
                    <th className="px-8 py-5 text-center">Sync Ratio</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-750">
                  {users.filter(u => u.role === 'client').map(client => {
                    const compEntries = entries.filter(e => e.companyName === client.companyName);
                    const success = compEntries.filter(e => e.status === 'success').length;
                    const failed = compEntries.filter(e => e.status === 'failed').length;
                    const total = compEntries.length;
                    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
                    
                    return (
                      <tr key={client._id} className="hover:bg-slate-50/30 transition-all">
                        <td className="px-8 py-5">
                          <span className="font-bold text-slate-900 block leading-tight">{client.companyName || 'Unmapped Firm'}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 block">Owner: {client.name}</span>
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-slate-700 font-mono">{total}</td>
                        <td className="px-8 py-5 text-center font-bold text-emerald-600 font-mono">{success}</td>
                        <td className="px-8 py-5 text-center font-bold text-rose-500 font-mono">{failed}</td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            successRate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                            successRate >= 50 ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {successRate}%
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button
                            onClick={() => setSelectedCompanyForReport(client)}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-650 text-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
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
      <AnimatePresence>
        {clientToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200/85 overflow-hidden"
            >
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 bg-rose-50 text-rose-550 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm border border-rose-100">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Terminate Firm Instance?</h3>
                  <p className="text-slate-505 font-semibold text-sm mt-2 leading-relaxed">
                    This will permanently delete <span className="font-extrabold text-slate-800">"{clientToDelete.companyName || clientToDelete.name}"</span> from the database. All synchronization queues and access keys will be invalidated.
                  </p>
                </div>
                <div className="flex gap-3 pt-3">
                  <button 
                    onClick={() => setClientToDelete(null)}
                    className="flex-1 py-3 bg-slate-50 border border-slate-200 font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-slate-100 transition-all cursor-pointer text-slate-500"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteClient}
                    className="flex-1 py-3 bg-rose-600 text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-rose-750 shadow-md shadow-rose-200 transition-all cursor-pointer"
                  >
                    Terminate Firm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {editingClient && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200/85 overflow-hidden my-8"
            >
              <div className="p-6 md:p-8 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Edit Firm Profile</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">Modify owner details, tax parameters, and contact coordinates</p>
                </div>
                <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateClient} className="p-6 md:p-8 space-y-5">
                {modalError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex gap-2 items-center">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                    <input 
                      required
                      type="text" 
                      value={editingClient.name}
                      onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Firm Email</label>
                    <input 
                      required
                      type="email" 
                      value={editingClient.email}
                      onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Official Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-450" />
                    <input 
                      required
                      type="text" 
                      value={editingClient.companyName || ''}
                      onChange={e => setEditingClient({...editingClient, companyName: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">GSTIN</label>
                    <input 
                      type="text" 
                      value={editingClient.gstin || ''}
                      onChange={e => setEditingClient({...editingClient, gstin: e.target.value.toUpperCase()})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350 uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
                    <input 
                      type="text" 
                      value={editingClient.phone || ''}
                      onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Billing Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-450" />
                    <input 
                      type="text" 
                      value={editingClient.address || ''}
                      onChange={e => setEditingClient({...editingClient, address: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Update Access Key (Optional)</label>
                  <input 
                    type="password" 
                    onChange={e => setEditingClient({...editingClient, password: e.target.value} as any)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all"
                    placeholder="Leave blank to preserve existing key"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="flex-1 py-4 bg-slate-50 border border-slate-200 text-slate-500 font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-100 transition-all text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={modalLoading}
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/10 hover:bg-slate-900 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Client Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200/85 overflow-hidden my-8"
            >
              <div className="p-6 md:p-8 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Provision Tenant Firm</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">Initialize a managed instance for a new corporate firm</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateClient} className="p-6 md:p-8 space-y-5">
                {modalError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex gap-2 items-center">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                    <input 
                      required
                      type="text" 
                      value={newClient.name}
                      onChange={e => setNewClient({...newClient, name: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="E.g., John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Firm Email</label>
                    <input 
                      required
                      type="email" 
                      value={newClient.email}
                      onChange={e => setNewClient({...newClient, email: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="firm@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Official Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-450" />
                    <input 
                      required
                      type="text" 
                      value={newClient.companyName}
                      onChange={e => setNewClient({...newClient, companyName: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="E.g., Acme Corporation Pvt Ltd"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">GSTIN</label>
                    <input 
                      type="text" 
                      value={newClient.gstin}
                      onChange={e => setNewClient({...newClient, gstin: e.target.value.toUpperCase()})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350 uppercase"
                      placeholder="E.g., 27AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone Number</label>
                    <input 
                      type="text" 
                      value={newClient.phone}
                      onChange={e => setNewClient({...newClient, phone: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="E.g., +91 9876543210"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Billing Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-4.5 w-4.5 text-slate-450" />
                    <input 
                      type="text" 
                      value={newClient.address}
                      onChange={e => setNewClient({...newClient, address: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="E.g., 404 Industrial Estate, Sector 7"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Access Key</label>
                    <input 
                      required
                      type="password" 
                      value={newClient.password}
                      onChange={e => setNewClient({...newClient, password: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-350"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-50 border border-slate-200 text-slate-500 font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-100 transition-all text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={modalLoading}
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/10 hover:bg-slate-900 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Profile Creation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
