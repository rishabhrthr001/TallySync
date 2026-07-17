import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Package, Search, Plus, RefreshCcw, BarChart3, Layers, ShoppingBag, Filter, Edit, Trash2, X } from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';
import { Navigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const Inventory: React.FC = () => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18', sku: '', images: [] as string[] });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Sync inventory states
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [syncError, setSyncError] = useState<string>('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchItems();
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const res = await axios.get('/api/inventory/sync-status', {
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

  const handleSyncInventory = async () => {
    setSyncLoading(true);
    try {
      await axios.post('/api/inventory/sync-request', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('Inventory sync request queued in agent.', 'success');
      setSyncStatus('pending');
      setSyncError('');
    } catch (err: any) {
      console.error('Error initiating sync', err);
      showToast(err.response?.data?.error || 'Failed to initiate inventory sync', 'error');
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
        showToast('Inventory synchronized with Tally successfully!', 'success');
        fetchItems();
        clearInterval(intervalId);
      } else if (status === 'failed') {
        showToast('Tally inventory synchronization failed.', 'error');
        clearInterval(intervalId);
      }
    };

    if (syncStatus === 'pending' || syncStatus === 'syncing') {
      intervalId = setInterval(checkStatus, 3000);
      // Run once immediately
      checkStatus();
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncStatus]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/inventory?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setItems(res.data);
    } catch (err: any) {
      console.error('Error fetching items', err);
      showToast('Failed to fetch inventory items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (editingItem) {
        await axios.patch(`/api/inventory/${editingItem._id}`, newItem, { headers });
        showToast('SKU updated successfully!', 'success');
      } else {
        await axios.post('/api/inventory', newItem, { headers });
        showToast('SKU created successfully!', 'success');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setNewItem({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18', sku: '', images: [] });
      fetchItems();
    } catch (err: any) {
      console.error('Error processing item', err);
      showToast(err.response?.data?.error || 'Failed to save SKU profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      category: item.category || '',
      rate: item.rate.toString(),
      stock: item.stock.toString(),
      unit: item.unit || 'pcs',
      gst: (item.gst || 18).toString(),
      sku: item.sku || '',
      images: item.images || []
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`/api/inventory/${itemToDelete._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('SKU deleted successfully!', 'success');
      setItemToDelete(null);
      fetchItems();
    } catch (err: any) {
      console.error('Error deleting item', err);
      showToast(err.response?.data?.error || 'Failed to delete SKU', 'error');
    }
  };

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category || 'General')))];

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || (i.category || 'General') === categoryFilter;
    
    // Derived status if backend status isn't reliable yet
    const derivedStatus = i.stock > 0 ? 'In Stock' : 'Out of Stock';
    const matchesStatus = statusFilter === 'All' || derivedStatus === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-10">
        <div>
          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider">SKU Control</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">Inventory Monitor</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">
            {lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : 'Real-time stock valuation and tracking'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSyncInventory}
            disabled={syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 border rounded-2xl text-xs font-bold uppercase tracking-wider transition-all w-full sm:w-auto cursor-pointer ${
              syncStatus === 'pending' || syncStatus === 'syncing'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : syncStatus === 'failed'
                ? 'bg-rose-50 hover:bg-rose-100/80 text-rose-600 border-rose-200 hover:border-rose-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
            title={syncStatus === 'failed' ? `Last sync failed: ${syncError}` : 'Sync inventory from Tally'}
          >
            <RefreshCcw className={`h-4 w-4 ${syncStatus === 'pending' || syncStatus === 'syncing' || syncLoading ? 'animate-spin' : ''}`} />
            {syncStatus === 'pending' || syncStatus === 'syncing' 
              ? 'Syncing Tally...' 
              : syncStatus === 'failed'
              ? 'Sync Failed (Retry)'
              : 'Sync from Tally'}
          </button>
          
          <button 
            onClick={() => {
              setEditingItem(null);
              setNewItem({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18', sku: '', images: [] });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-500/10 w-full sm:w-auto active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Add Item
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
            onClick={handleSyncInventory}
            className="text-[10px] tracking-wider uppercase bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm shadow-rose-600/10 active:scale-95 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StockStat title="Total SKUs" value={items.length} icon={Layers} color="indigo" description="Registered products" />
        <StockStat title="In Stock" value={items.filter(i => i.stock > 0).length} icon={Package} color="emerald" description="Available units" />
        <StockStat title="Out of Stock" value={items.filter(i => i.stock <= 0).length} icon={ShoppingBag} color="rose" description="Reorder required" />
        <StockStat title="Asset Value" value={formatCurrency(items.reduce((acc, i) => acc + (i.stock > 0 ? (i.stock * i.rate) : 0), 0))} icon={BarChart3} color="slate" description="Net asset assessment" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Filters */}
        <div className="p-5 border-b border-slate-150 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items by name or keywords..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Filter className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 appearance-none shadow-sm cursor-pointer"
              >
                {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
              </select>
            </div>
            
            <div className="relative flex-1 md:flex-none">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 appearance-none shadow-sm cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
            
            <button onClick={fetchItems} className="p-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl shadow-sm transition-colors cursor-pointer">
              <RefreshCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-150">
                <th className="px-8 py-5">SKU Name</th>
                <th className="px-8 py-5">Category</th>
                <th className="px-8 py-5">Rate</th>
                <th className="px-8 py-5 text-center">GST Rate</th>
                <th className="px-8 py-5 text-center">Closing Stock</th>
                <th className="px-8 py-5 text-right">Valuation</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <AnimatePresence>
                {filteredItems.map((item, idx) => {
                  const outOfStock = item.stock <= 0;
                  return (
                    <motion.tr 
                      key={item._id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-slate-50/30 transition-all font-semibold text-slate-750 group"
                    >
                      <td className="px-8 py-5 flex items-center gap-4">
                        {item.images && item.images.length > 0 ? (
                          <img src={item.images[0]} alt={item.name} className="h-9 w-9 object-cover rounded-xl border border-slate-200 shadow-sm" />
                        ) : (
                          <div className={`h-9 w-9 flex items-center justify-center rounded-xl font-bold uppercase transition-colors ${
                            outOfStock ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {item.name[0]}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.name}</span>
                          {item.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider border border-slate-200/40">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-mono text-xs text-slate-600">{formatCurrency(item.rate)}</td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-2 py-1 bg-slate-50 border border-slate-200/50 text-slate-600 rounded-lg text-xs font-bold font-mono">
                          {item.gst || 18}%
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center font-bold">
                        <span className={outOfStock ? 'text-rose-500' : 'text-slate-800'}>
                          {item.stock} <span className="text-slate-400 font-medium text-xs">{item.unit || 'pcs'}</span>
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 font-mono text-xs">
                        {formatCurrency(item.stock > 0 ? item.stock * item.rate : 0)}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          outOfStock ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        } border`}>
                          {outOfStock ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(item)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Grid */}
        <div className="block lg:hidden p-4 space-y-4">
          <AnimatePresence>
            {filteredItems.map((item, idx) => {
              const outOfStock = item.stock <= 0;
              return (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {item.images && item.images.length > 0 ? (
                        <img src={item.images[0]} alt={item.name} className="w-9 h-9 object-cover rounded-xl border border-slate-200 shadow-sm" />
                      ) : (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm uppercase ${
                          outOfStock ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {item.name[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{item.name}</h4>
                        {item.sku && <span className="text-[9px] text-slate-400 font-mono block">SKU: {item.sku}</span>}
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase block">{item.category || 'General'}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      outOfStock ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {outOfStock ? 'Out' : 'In Stock'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Rate</span>
                      <span className="text-xs font-bold text-slate-700 font-mono">{formatCurrency(item.rate)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Closing</span>
                      <span className="text-xs font-bold text-slate-700">{item.stock} {item.unit || 'pcs'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">GST</span>
                      <span className="text-xs font-bold text-slate-750 font-mono">{item.gst || 18}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Asset Value</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(item.stock > 0 ? item.stock * item.rate : 0)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-indigo-600 bg-white border border-slate-200 rounded-xl"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(item)}
                        className="p-2 text-rose-600 bg-white border border-slate-200 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Package className="h-14 w-14 opacity-20 mb-4" />
            <p className="font-bold text-lg">No items match filters</p>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200/80 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {editingItem ? 'Edit SKU Profile' : 'Initialize New SKU'}
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">Define item rate, tax treatment, and inventory status</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Item Name</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="E.g., Matte Coated Paper A4"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">SKU</label>
                    <input 
                      type="text" 
                      placeholder="E.g., PAP-A4-COAT"
                      value={newItem.sku}
                      onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Product Images</label>
                  <div className="flex flex-wrap gap-2 items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50">
                    {(newItem.images || []).length < 3 && (
                      <label className="h-16 w-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50/80 transition-colors">
                        <Plus className="h-6 w-6 text-slate-400" />
                        <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Upload</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const files = e.target.files;
                            if (!files) return;
                            
                            const currentImages = newItem.images || [];
                            const remainingSlots = 3 - currentImages.length;
                            const filesToAdd = Array.from(files).slice(0, remainingSlots);
                            
                            if (files.length > remainingSlots) {
                              alert(`You can only upload up to 3 images. Adding the first ${remainingSlots} selected image(s).`);
                            }

                            filesToAdd.forEach(async (file: any) => {
                              try {
                                const compressedDataUrl = await compressImage(file);
                                setNewItem(prev => {
                                  const prevImages = prev.images || [];
                                  if (prevImages.length >= 3) return prev;
                                  return {
                                    ...prev,
                                    images: [...prevImages, compressedDataUrl]
                                  };
                                });
                              } catch (err) {
                                console.error('Error compressing image:', err);
                              }
                            });
                          }}
                        />
                      </label>
                    )}
                    {(newItem.images || []).map((img, idx) => (
                      <div key={idx} className="relative h-16 w-16 group border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <img src={img} alt="preview" className="h-full w-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setNewItem(prev => ({
                            ...prev,
                            images: (prev.images || []).filter((_, i) => i !== idx)
                          }))}
                          className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <input 
                      type="text" 
                      placeholder="General"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unit</label>
                    <input 
                      type="text" 
                      placeholder="pcs"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Rate (INR)</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="0"
                      value={newItem.rate}
                      onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">GST (%)</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="18"
                      value={newItem.gst}
                      onChange={(e) => setNewItem({ ...newItem, gst: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Stock Qty</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="0"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>
                 <button 
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-4 mt-2 bg-indigo-600 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/10 hover:bg-slate-900 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {editingItem ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    editingItem ? 'Save Changes' : 'Create SKU'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200/80 overflow-hidden p-6 md:p-8 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 bg-rose-50 text-rose-600 rounded-full">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Delete SKU Profile</h3>
                <p className="text-slate-400 text-sm font-semibold">
                  Are you sure you want to delete <span className="font-extrabold text-slate-800">"{itemToDelete.name}"</span>? This will permanently remove it from the inventory database.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-rose-500/10 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const StockStat: React.FC<any> = ({ title, value, icon: Icon, color, description }) => {
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

export default Inventory;
