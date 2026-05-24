import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Package, Search, Plus, RefreshCcw, BarChart3, Layers, ShoppingBag, Filter, Edit, Trash2, X } from 'lucide-react';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18' });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/inventory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setItems(res.data);
    } catch (err) {
      console.error('Error fetching items', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (editingItem) {
        await axios.patch(`/api/inventory/${editingItem._id}`, newItem, { headers });
      } else {
        await axios.post('/api/inventory', newItem, { headers });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setNewItem({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18' });
      fetchItems();
    } catch (err) {
      console.error('Error processing item', err);
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
      gst: (item.gst || 18).toString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await axios.delete(`/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchItems();
    } catch (err) {
      console.error('Error deleting item', err);
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
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory Monitor</h2>
          <p className="text-slate-500 mt-1">Real-time stock valuation and tracking</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setNewItem({ name: '', category: '', rate: '', stock: '', unit: 'pcs', gst: '18' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-indigo-100 w-full sm:w-auto active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StockStat title="Total SKUs" value={items.length} icon={Layers} color="indigo" />
        <StockStat title="In Stock" value={items.filter(i => i.stock > 0).length} icon={Package} color="emerald" />
        <StockStat title="Out of Stock" value={items.filter(i => i.stock <= 0).length} icon={ShoppingBag} color="rose" />
        <StockStat title="Asset Value" value={formatCurrency(items.reduce((acc, i) => acc + (i.stock > 0 ? (i.stock * i.rate) : 0), 0))} icon={BarChart3} color="slate" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden shadow-slate-200/50">
        {/* Filters */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-sm"
            />
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative">
              <Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 appearance-none shadow-sm cursor-pointer"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="relative">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 appearance-none shadow-sm cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
            
            <button onClick={fetchItems} className="p-3 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-colors">
              <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Item Details</th>
                <th className="px-8 py-5">Category</th>
                <th className="px-8 py-5">Rate</th>
                <th className="px-8 py-5 text-center">GST</th>
                <th className="px-8 py-5 text-center">In Stock</th>
                <th className="px-8 py-5 text-right">Value</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
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
                      className="hover:bg-slate-50/50 transition-all font-semibold text-slate-700 group"
                    >
                      <td className="px-8 py-5 flex items-center gap-4">
                        <div className={`h-10 w-10 flex items-center justify-center rounded-2xl font-bold uppercase transition-colors ${
                          outOfStock ? 'bg-rose-50 text-rose-500 ring-rose-100' : 'bg-indigo-50 text-indigo-600 ring-indigo-50'
                        } ring-4`}>
                          {item.name[0]}
                        </div>
                        <span className="font-bold text-slate-900">{item.name}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-mono">{formatCurrency(item.rate)}</td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                          {item.gst || 18}%
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center font-black">
                        <span className={outOfStock ? 'text-rose-500' : 'text-slate-800'}>
                          {item.stock} {item.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 font-mono">
                        {formatCurrency(item.stock > 0 ? item.stock * item.rate : 0)}
                      </td>
                      <td className="px-8 py-5 text-center">
                        {outOfStock ? (
                          <div className="inline-block px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-wider">
                            Out of Stock
                          </div>
                        ) : (
                          <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                            In Stock
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item._id)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Package className="h-16 w-16 opacity-10 mb-4" />
              <p className="font-bold text-xl">No items match filters</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {editingItem ? 'Edit SKU' : 'Initialize SKU'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Item Name</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Product Name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</label>
                    <input 
                      type="text" 
                      placeholder="General"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unit</label>
                    <input 
                      type="text" 
                      placeholder="pcs"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Rate (INR)</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="0.00"
                      value={newItem.rate}
                      onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
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
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Stock</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="0"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 hover:bg-black transition-all text-xs"
                >
                  {editingItem ? 'Save Changes' : 'Create SKU'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const StockStat: React.FC<any> = ({ title, value, icon: Icon, color }) => {
  const colors: any = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-800'
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-3.5 rounded-2xl ${colors[color]}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-xl font-black text-slate-900 font-mono tracking-tight">{value}</h4>
      </div>
    </div>
  );
};

export default Inventory;
