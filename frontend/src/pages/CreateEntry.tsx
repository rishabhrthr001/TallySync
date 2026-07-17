import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Send, Printer, User, CreditCard, Upload, CheckCircle2, ExternalLink, Camera } from 'lucide-react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import PrintableInvoice, { InvoiceData } from '../components/PrintableInvoice';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';
import ProductRecognitionModal from '../components/ProductRecognitionModal';

interface ItemRow {
  name: string;
  quantity: number;
  rate: number;
  gst: number;
  amount: number;
}

const CreateEntry: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState<'sales' | 'purchase'>('sales');
  const [partyName, setPartyName] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ItemRow[]>([{ name: '', quantity: 1, rate: 0, gst: 18, amount: 0 }]);
  const [gstType, setGstType] = useState<'cgst-sgst' | 'igst'>('cgst-sgst');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isRecognitionOpen, setIsRecognitionOpen] = useState(false);
  const [activeRecognitionIndex, setActiveRecognitionIndex] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [existingParties, setExistingParties] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);

  const fetchMetadata = async () => {
    try {
      const token = localStorage.getItem('token');
      const [partiesRes, itemsRes] = await Promise.all([
        axios.get('/api/ledger', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/inventory', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setExistingParties(partiesRes.data);
      setInventoryItems(itemsRes.data);
    } catch (err) {
      console.error('Failed to load ledger/inventory metadata', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    const trimmed = partyGstin.trim();
    if (trimmed.length === 15) {
      const stateCode = trimmed.substring(0, 2);
      if (stateCode !== '27') { // 27 is Maharashtra
        setGstType('igst');
      } else {
        setGstType('cgst-sgst');
      }
    }
  }, [partyGstin]);

  const processDocumentUpload = async (file: File) => {
    setUploadingPdf(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await axios.post('/api/entries/upload-document', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }
      });
      
      const { data } = response.data;
      if (data) {
        setReviewData(data);
        setShowReviewModal(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to parse document', 'error');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processDocumentUpload(file);
    e.target.value = '';
  };

  // Focus ref for keyboard-friendly input
  const lastItemInputRef = useRef<HTMLInputElement>(null);

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: 1, rate: 0, gst: 18, amount: 0 }]);
    setTimeout(() => {
      lastItemInputRef.current?.focus();
    }, 10);
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      const item = { ...newItems[index] };
      
      if (field === 'name') {
        item.name = value;
        // Autofill from inventory
        const matched = inventoryItems.find(i => i.name === value);
        if (matched) {
          item.rate = Number(matched.rate) || 0;
          item.gst = Number(matched.gst) || 18;
        }
      } else {
        (item as any)[field] = Number(value) || 0;
      }
      
      item.amount = Number((item.quantity * item.rate).toFixed(2));
      newItems[index] = item;
      return newItems;
    });
  };

  const calculateTotals = () => {
    let taxableAmount = 0;
    let taxAmount = 0;
    items.forEach(item => {
      const lineTotal = Number((item.quantity * item.rate).toFixed(2));
      taxableAmount += lineTotal;
      taxAmount += Number((lineTotal * (item.gst / 100)).toFixed(2));
    });
    
    taxableAmount = Number(taxableAmount.toFixed(2));
    taxAmount = Number(taxAmount.toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));
    
    return { taxableAmount, taxAmount, totalAmount };
  };

  const { taxableAmount, taxAmount, totalAmount } = calculateTotals();

  // Print Setup
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef });

  const getInvoiceData = (): InvoiceData => ({
    type, partyName, partyGstin, invoiceNumber, date, items, taxableAmount, taxAmount, totalAmount, gstType, notes, companyName: user?.companyName || ''
  });

  const handleSaveToTallyFromModal = async () => {
    if (!reviewData?.partyName) {
      showToast("Please enter party name.", 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: reviewData.type || 'purchase',
        partyName: reviewData.partyName,
        partyGstin: reviewData.partyGstin || '',
        invoiceNumber: reviewData.invoiceNumber,
        date: reviewData.date,
        items: (reviewData.items || []).map((i: any) => ({
          name: i.name || 'Extracted Bill Item',
          quantity: Number(i.quantity) || 1,
          rate: Number(i.rate) || reviewData.taxableAmount,
          amount: Number(((Number(i.quantity) || 1) * (Number(i.rate) || reviewData.taxableAmount)).toFixed(2))
        })),
        taxableAmount: reviewData.taxableAmount,
        taxAmount: reviewData.taxAmount,
        totalAmount: reviewData.totalAmount,
        gstType: reviewData.gstType || 'cgst-sgst',
        notes: reviewData.notes || 'Automatically parsed from PDF',
        idempotencyKey: `${reviewData.type || 'purchase'}-${reviewData.invoiceNumber}-${Date.now()}`
      };

      await axios.post('/api/entries', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setShowReviewModal(false);
      setShowSuccess(true);
      showToast('Bill Saved Successfully!', 'success');
      fetchMetadata();
      // Reset main form
      setPartyName('');
      setPartyGstin('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setItems([{ name: '', quantity: 1, rate: 0, gst: 18, amount: 0 }]);
      setNotes('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!partyName || items.filter(i => i.name).length === 0) {
      showToast("Please enter party name and at least one item.", 'error');
      return;
    }

    // Safety check for totals
    const calc = calculateTotals();
    if (Math.abs((calc.taxableAmount + calc.taxAmount) - calc.totalAmount) > 0.01) {
      showToast("Calculation error detected. Please refresh the page.", 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type, partyName, partyGstin, invoiceNumber, date, 
        items: items.filter(i => i.name).map(i => ({
          ...i, 
          quantity: Number(i.quantity),
          rate: Number(i.rate),
          amount: Number((i.quantity * i.rate).toFixed(2))
        })),
        taxableAmount: calc.taxableAmount, 
        taxAmount: calc.taxAmount, 
        totalAmount: calc.totalAmount, 
        gstType,
        notes,
        idempotencyKey: `${type}-${invoiceNumber}-${Date.now()}`
      };

      await axios.post('/api/entries', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowSuccess(true);
      showToast('Bill Saved Successfully!', 'success');
      // Reset main form
      setPartyName('');
      setPartyGstin('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setItems([{ name: '', quantity: 1, rate: 0, gst: 18, amount: 0 }]);
      setNotes('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 border-b border-slate-200/50 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rapid Billing</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">{user?.companyName} • Fast Invoice Engine</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 w-full sm:w-auto">
            <button 
              onClick={() => setType('sales')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'sales' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sales Bill
            </button>
            <button 
              onClick={() => setType('purchase')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'purchase' ? 'bg-amber-500 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Purchase Entry
            </button>
          </div>
          <label className={`cursor-pointer flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white shadow-md w-full sm:w-auto ${uploadingPdf ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            <Upload className="h-4 w-4" />
            {uploadingPdf ? 'Parsing...' : 'Upload PDF / Image'}
            <input type="file" accept=".pdf, image/*" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.03)] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-5 w-5 text-indigo-400" />
                <input 
                  required autoFocus
                  type="text" 
                  value={partyName} 
                  onChange={(e) => setPartyName(e.target.value)}
                  onFocus={() => setPartyDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setPartyDropdownOpen(false), 200)}
                  placeholder="Cash / Search Party Name..."
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
                />
                {partyDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                    {[{name: 'Cash'}, ...existingParties]
                      .filter(p => (p.name || '').toLowerCase().includes((partyName || '').toLowerCase()))
                      .map((p, i) => (
                      <button
                        type="button"
                        key={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setPartyName(p.name);
                          setPartyDropdownOpen(false);
                          if (p.gstin) setPartyGstin(p.gstin);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span className="font-bold text-slate-700">{p.name}</span>
                        {p.gstin && <span className="block text-[10px] font-mono text-slate-400 mt-0.5">{p.gstin}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party GSTIN</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-3.5 h-5 w-5 text-indigo-400" />
                <input 
                  type="text" 
                  value={partyGstin} 
                  onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                  placeholder="GSTIN (Optional)"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm placeholder:text-slate-350"
                />
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
              <input 
                required type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all shadow-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Treatment</label>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
                <button 
                  type="button"
                  onClick={() => setGstType('cgst-sgst')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${gstType === 'cgst-sgst' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Intrastate (CGST + SGST)
                </button>
                <button 
                  type="button"
                  onClick={() => setGstType('igst')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${gstType === 'igst' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Interstate (IGST)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200/70 overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-slate-200 bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="col-span-5">Item Name</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">Rate</div>
              <div className="col-span-1 text-center">GST%</div>
              <div className="col-span-2 text-right pr-4">Total</div>
            </div>
            
            <div className="p-3 md:p-2 space-y-4 md:space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-3 md:items-center bg-white p-4 md:p-2 rounded-xl border border-slate-200 md:border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="md:col-span-5 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase md:hidden mb-1.5 block">Item Name</label>
                    <div className="flex items-center gap-1 bg-slate-50 md:bg-transparent rounded-t-sm border-b-2 border-transparent focus-within:border-indigo-400 transition-all focus-within:bg-indigo-50/30">
                      <input 
                        ref={index === items.length - 1 ? lastItemInputRef : null}
                        required type="text" value={item.name} 
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(index, 'name', val);
                        }}
                        onFocus={() => setActiveDropdown(index)}
                        onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                        placeholder="Item name..."
                        className="w-full px-3 py-2 text-sm font-bold text-slate-800 placeholder-slate-300 outline-none bg-transparent"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); lastItemInputRef.current?.blur(); }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRecognitionIndex(index);
                          setIsRecognitionOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="AI Product Recognition"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    {activeDropdown === index && inventoryItems.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                        {inventoryItems
                          .filter(inv => (inv.name || '').toLowerCase().includes((item.name || '').toLowerCase()))
                          .map((inv, i) => (
                          <button
                            type="button"
                            key={i}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              updateItem(index, 'name', inv.name);
                              updateItem(index, 'rate', inv.rate);
                              updateItem(index, 'gst', inv.gst || 18);
                              setActiveDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex justify-between items-center group border-b border-slate-50 last:border-0"
                          >
                            <span className="font-semibold text-slate-700 group-hover:text-indigo-700 truncate mr-2">{inv.name}</span>
                            <div className="flex flex-col items-end text-xs whitespace-nowrap">
                              <span className="font-mono font-bold text-indigo-600">{formatCurrency(inv.rate)}</span>
                              <span className="text-slate-400">GST {inv.gst}%</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 md:contents gap-3 w-full">
                    <div className="md:col-span-2 flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase md:hidden mb-1.5 block text-center">Qty</label>
                      <input 
                        required type="number" min="1" value={item.quantity === 0 ? '' : item.quantity} 
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-2 text-center text-sm font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-indigo-400 bg-slate-50 focus:bg-white rounded"
                      />
                    </div>
                    <div className="md:col-span-2 flex-1 relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase md:hidden mb-1.5 block text-center">Rate</label>
                      <span className="absolute left-2 top-[30px] md:top-2.5 text-[10px] text-slate-400 font-bold hidden md:block">INR</span>
                      <input 
                        required type="number" value={item.rate === 0 ? '' : item.rate} 
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 md:pl-6 md:pr-2 py-2 text-center md:text-left text-sm font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-indigo-400 bg-slate-50 focus:bg-white rounded"
                      />
                    </div>
                    <div className="md:col-span-1 flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase md:hidden mb-1.5 block text-center">GST%</label>
                      <input 
                        required type="number" value={item.gst} 
                        onChange={(e) => updateItem(index, 'gst', parseFloat(e.target.value) || 0)}
                        className="w-full px-1 py-2 text-center text-sm font-bold text-slate-600 outline-none border-b-2 border-transparent focus:border-indigo-400 bg-slate-50 focus:bg-white rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2 flex justify-between items-center md:pl-2 mt-2 md:mt-0 pt-4 md:pt-0 border-t border-slate-100 md:border-t-0">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase md:hidden mb-1 block">Line Total</span>
                      <div className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                    <button 
                      type="button" onClick={() => removeItemRow(index)}
                      className="p-2 md:p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors focus:outline-none"
                    >
                      <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50/50 border-t border-slate-200">
              <button 
                type="button" onClick={addItemRow}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-all w-fit"
              >
                <Plus className="h-4 w-4 stroke-[3]" /> Add Row (Tab)
              </button>
            </div>
          </div>
        </form>

        {/* Right Preview & Sidebar Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
            
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Voucher Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-slate-300 font-medium text-sm">
                  <span>Taxable Value</span>
                  <span className="font-mono">{formatCurrency(taxableAmount)}</span>
                </div>
                {gstType === 'cgst-sgst' ? (
                  <>
                    <div className="flex justify-between text-slate-350 font-medium text-sm">
                      <span>CGST ({(items[0]?.gst || 18)/2}%)</span>
                      <span className="font-mono">{formatCurrency(taxAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-350 font-medium text-sm">
                      <span>SGST ({(items[0]?.gst || 18)/2}%)</span>
                      <span className="font-mono">{formatCurrency(taxAmount / 2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-350 font-medium text-sm">
                    <span>IGST ({items[0]?.gst || 18}%)</span>
                    <span className="font-mono">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center">
                  <span className="font-bold text-slate-200">Grand Total</span>
                  <span className="text-3xl font-black text-white font-mono tracking-tight">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3 relative z-10">
              <button 
                onClick={() => handleSubmit()} 
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm uppercase tracking-wider"
              >
                {loading ? 'Saving to Tally...' : <><Save className="h-5 w-5" /> Save to Tally</>}
              </button>
              
              <button 
                type="button"
                onClick={() => handlePrint()}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/10 transition-colors text-sm uppercase tracking-wider"
              >
                <Printer className="h-5 w-5" /> Print Voucher
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Invoice # Reference</label>
            <input 
              type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-400"
            />
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-5 space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Narration / Internal Notes</label>
            <textarea 
              placeholder="Terms, transaction context, or notes..." 
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 p-4 border border-slate-200 rounded-xl text-sm min-h-[90px] outline-none resize-none placeholder-slate-350 font-medium text-slate-700 focus:border-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Bar */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 px-5 py-3.5 flex items-center justify-between z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        <div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Amount</span>
          <span className="text-xl font-black text-slate-900 font-mono leading-none">{formatCurrency(totalAmount)}</span>
        </div>
        <button 
          onClick={() => handleSubmit()} 
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save to Tally'}
        </button>
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-4 left-4 right-4 sm:top-8 sm:right-8 sm:left-auto sm:w-auto z-[110] animate-slide-in">
          <div className="bg-emerald-500 text-white p-6 rounded-[2rem] shadow-2xl shadow-emerald-200/50 flex items-center gap-4 border border-emerald-400">
            <div className="bg-white/20 p-2 rounded-full shadow-inner">
              <CheckCircle2 className="h-6 w-6 stroke-[3]" />
            </div>
            <div>
              <p className="font-black text-lg leading-tight">Bill Saved Successfully!</p>
              <button 
                onClick={() => navigate('/entries')}
                className="text-emerald-100 text-xs font-bold flex items-center gap-1 hover:text-white transition-colors mt-0.5"
              >
                View in History <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <button onClick={() => setShowSuccess(false)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
              <Plus className="h-5 w-5 rotate-45" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Review Modal */}
      {showReviewModal && reviewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Review PDF Extraction</h3>
                <p className="text-slate-500 font-medium mt-1">Verify parsed data before saving to Tally</p>
              </div>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Type and GST Treatment Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher Type</label>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-full">
                    <button 
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, type: 'sales' })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${reviewData.type === 'sales' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Sales Bill
                    </button>
                    <button 
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, type: 'purchase' })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${reviewData.type === 'purchase' ? 'bg-amber-500 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Purchase Entry
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Treatment</label>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-full">
                    <button 
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, gstType: 'cgst-sgst' })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${reviewData.gstType === 'cgst-sgst' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Intrastate (CGST + SGST)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, gstType: 'igst' })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${reviewData.gstType === 'igst' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Interstate (IGST)
                    </button>
                  </div>
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
                  <input 
                    type="text" 
                    value={reviewData.partyName}
                    list="party-list"
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = existingParties.find(p => p.name.toLowerCase() === val.toLowerCase());
                      setReviewData({
                        ...reviewData,
                        partyName: val,
                        partyGstin: matched?.gstin || reviewData.partyGstin
                      });
                    }}
                    placeholder="Search/Enter Party Name..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party GSTIN</label>
                  <input 
                    type="text" 
                    value={reviewData.partyGstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      const stateCode = val.substring(0, 2);
                      const gstType = val.length === 15 && stateCode !== '27' ? 'igst' : 'cgst-sgst';
                      setReviewData({
                        ...reviewData,
                        partyGstin: val,
                        gstType
                      });
                    }}
                    placeholder="GSTIN (Optional)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice #</label>
                  <input 
                    type="text" 
                    value={reviewData.invoiceNumber}
                    onChange={(e) => setReviewData({ ...reviewData, invoiceNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    type="date" 
                    value={reviewData.date}
                    onChange={(e) => setReviewData({ ...reviewData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Amounts Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-200/50">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Taxable Value (INR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={reviewData.taxableAmount === 0 ? '' : reviewData.taxableAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const tax = Number((val * 0.18).toFixed(2));
                      const total = Number((val + tax).toFixed(2));
                      setReviewData({
                        ...reviewData,
                        taxableAmount: val,
                        taxAmount: tax,
                        totalAmount: total,
                        items: (reviewData.items || []).map((item: any, idx: number) => 
                          idx === 0 ? { ...item, rate: val, amount: val } : item
                        )
                      });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold font-mono text-slate-800 outline-none focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total GST (INR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={reviewData.taxAmount === 0 ? '' : reviewData.taxAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const total = Number((reviewData.taxableAmount + val).toFixed(2));
                      setReviewData({
                        ...reviewData,
                        taxAmount: val,
                        totalAmount: total
                      });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold font-mono text-slate-800 outline-none focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grand Total (INR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={reviewData.totalAmount === 0 ? '' : reviewData.totalAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const taxable = Number((val / 1.18).toFixed(2));
                      const tax = Number((val - taxable).toFixed(2));
                      setReviewData({
                        ...reviewData,
                        taxableAmount: taxable,
                        taxAmount: tax,
                        totalAmount: val,
                        items: (reviewData.items || []).map((item: any, idx: number) => 
                          idx === 0 ? { ...item, rate: taxable, amount: taxable } : item
                        )
                      });
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black font-mono text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Line Items</label>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Description</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-24">Qty</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-32">Rate</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reviewData.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="bg-white">
                          <td className="px-4 py-3">
                            <input 
                              type="text" 
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...reviewData.items];
                                newItems[idx].name = e.target.value;
                                setReviewData({ ...reviewData, items: newItems });
                              }}
                              className="w-full bg-transparent font-bold text-slate-800 outline-none focus:text-indigo-600 transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="number" 
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...reviewData.items];
                                newItems[idx].quantity = parseFloat(e.target.value) || 0;
                                newItems[idx].amount = Number((newItems[idx].quantity * newItems[idx].rate).toFixed(2));
                                const newTaxable = newItems.reduce((sum: number, it: any) => sum + (it.quantity * it.rate), 0);
                                const newTax = Number((newTaxable * 0.18).toFixed(2));
                                const newTotal = Number((newTaxable + newTax).toFixed(2));
                                setReviewData({
                                  ...reviewData,
                                  items: newItems,
                                  taxableAmount: newTaxable,
                                  taxAmount: newTax,
                                  totalAmount: newTotal
                                });
                              }}
                              className="w-full bg-transparent text-center font-bold text-slate-800 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="number" 
                              value={item.rate}
                              onChange={(e) => {
                                const newItems = [...reviewData.items];
                                newItems[idx].rate = parseFloat(e.target.value) || 0;
                                newItems[idx].amount = Number((newItems[idx].quantity * newItems[idx].rate).toFixed(2));
                                const newTaxable = newItems.reduce((sum: number, it: any) => sum + (it.quantity * it.rate), 0);
                                const newTax = Number((newTaxable * 0.18).toFixed(2));
                                const newTotal = Number((newTaxable + newTax).toFixed(2));
                                setReviewData({
                                  ...reviewData,
                                  items: newItems,
                                  taxableAmount: newTaxable,
                                  taxAmount: newTax,
                                  totalAmount: newTotal
                                });
                              }}
                              className="w-full bg-transparent text-center font-bold text-slate-800 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                            {formatCurrency(item.quantity * item.rate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Narration / Notes */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Narration / Internal Notes</label>
                <textarea 
                  placeholder="Terms, transaction context, or notes..." 
                  value={reviewData.notes || ''} 
                  onChange={(e) => setReviewData({ ...reviewData, notes: e.target.value })}
                  className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl text-sm min-h-[90px] outline-none resize-none placeholder-slate-350 font-medium text-slate-700 focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 justify-between items-center">
              <button 
                onClick={() => setShowReviewModal(false)}
                className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Discard
              </button>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setType(reviewData.type || 'purchase');
                    setPartyName(reviewData.partyName);
                    setPartyGstin(reviewData.partyGstin || '');
                    setInvoiceNumber(reviewData.invoiceNumber);
                    setDate(reviewData.date);
                    setGstType(reviewData.gstType || 'cgst-sgst');
                    setNotes(reviewData.notes || '');
                    setItems(reviewData.items.map((i: any) => {
                      const q = Number(i.quantity) || 1;
                      const r = Number(i.rate) || 0;
                      const g = Number(i.gst) || 18;
                      return { 
                        ...i, 
                        quantity: q,
                        rate: r,
                        gst: g, 
                        amount: Number((q * r).toFixed(2)) 
                      };
                    }));
                    setShowReviewModal(false);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-bold transition-all"
                >
                  Import to Editor
                </button>

                <button 
                  onClick={handleSaveToTallyFromModal}
                  disabled={loading}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" /> {loading ? 'Saving...' : 'Save to Tally'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for party names */}
      <datalist id="party-list">
        {existingParties.map((p, idx) => (
          <option key={idx} value={p.name} />
        ))}
      </datalist>

      {/* Hidden layout for printing */}
      <div className="hidden">
        <PrintableInvoice ref={contentRef} data={getInvoiceData()} user={user} />
      </div>

      <ProductRecognitionModal
        isOpen={isRecognitionOpen}
        onClose={() => {
          setIsRecognitionOpen(false);
          setActiveRecognitionIndex(null);
        }}
        onSelectProduct={(product) => {
          if (activeRecognitionIndex !== null) {
            updateItem(activeRecognitionIndex, 'name', product.name);
            updateItem(activeRecognitionIndex, 'rate', product.rate);
            updateItem(activeRecognitionIndex, 'gst', product.gst);
          }
        }}
      />
    </Layout>
  );
};

export default CreateEntry;
