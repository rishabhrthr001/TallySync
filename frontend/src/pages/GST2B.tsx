import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Filter, Calendar, RefreshCcw, FileText, CheckCircle2, 
  Clock, AlertCircle, IndianRupee, Tag, ShieldCheck, XCircle, Search,
  Upload, FileSpreadsheet, Check, AlertTriangle, FileCode, CheckSquare, Square, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Entry {
  _id: string;
  type: string;
  date: string;
  invoiceNumber: string;
  partyName: string;
  partyGstin?: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType: 'cgst-sgst' | 'igst';
  status: 'pending' | 'success' | 'failed';
}

interface PortalBill {
  invoiceNumber: string;
  date: string;
  partyGstin: string;
  partyName: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  gstType: 'cgst-sgst' | 'igst';
}

interface ReconciliationItem {
  portalBill: PortalBill;
  tallyEntry: Entry | null;
  isMatched: boolean;
  isMismatch: boolean;
  matchReason: string;
}

const GST2B = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all-bills' | 'reconciliation'>('all-bills');
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState<'all' | 'lastMonth' | 'quarterly' | 'lastYear' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [withItems, setWithItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // GSTR Data input states
  const [jsonInput, setJsonInput] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [portalBills, setPortalBills] = useState<PortalBill[]>([]);
  const [reconFilter, setReconFilter] = useState<'all' | 'matched' | 'unmatched' | 'mismatch'>('unmatched');
  const [selectedMissingInvoices, setSelectedMissingInvoices] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch entries
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/entries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data) {
        const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setEntries(dataArray.filter((e: Entry) => e.type === 'purchase'));
      }
    } catch (err: any) {
      addToast({
        title: 'Failed to fetch',
        message: err.response?.data?.message || 'Could not load purchase entries.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [addToast]);

  // Date boundaries based on timeFilter
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    let fromDate = new Date(0); // far past
    let toDate = new Date(2100, 0, 1); // far future

    if (timeFilter === 'lastMonth') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (timeFilter === 'quarterly') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      toDate = now;
    } else if (timeFilter === 'lastYear') {
      fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      toDate = now;
    } else if (timeFilter === 'custom') {
      if (customDateRange.from) fromDate = new Date(customDateRange.from);
      if (customDateRange.to) toDate = new Date(customDateRange.to + 'T23:59:59');
    }

    return { fromDate, toDate };
  }, [timeFilter, customDateRange]);

  // Filtered Local Purchase Entries from TallySync
  const filteredEntries = useMemo(() => {
    const { fromDate, toDate } = dateBoundaries;
    
    return entries.filter(e => {
      // Apply date filter
      if (timeFilter !== 'all') {
        if (!e.date) return false;
        const entryDate = new Date(e.date);
        if (entryDate < fromDate || entryDate > toDate) return false;
      }

      // Apply search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.invoiceNumber?.toLowerCase().includes(q) ||
          e.partyName?.toLowerCase().includes(q) ||
          e.partyGstin?.toLowerCase().includes(q)
        );
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, timeFilter, dateBoundaries, searchQuery]);

  // Filtered GSTR Portal Bills (using same date bounds)
  const filteredPortalBills = useMemo(() => {
    const { fromDate, toDate } = dateBoundaries;

    return portalBills.filter(b => {
      if (timeFilter !== 'all') {
        if (!b.date) return false;
        const bDate = new Date(b.date);
        if (bDate < fromDate || bDate > toDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.invoiceNumber?.toLowerCase().includes(q) ||
          b.partyName?.toLowerCase().includes(q) ||
          b.partyGstin?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [portalBills, timeFilter, dateBoundaries, searchQuery]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        acc.taxableValue += e.taxableAmount || 0;
        if (e.gstType === 'igst') {
          acc.igst += e.taxAmount || 0;
        } else {
          acc.cgst += (e.taxAmount || 0) / 2;
          acc.sgst += (e.taxAmount || 0) / 2;
        }
        return acc;
      },
      { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }
    );
  }, [filteredEntries]);

  // Sync to Tally
  const handleSync = async () => {
    const unsyncedEntries = filteredEntries.filter(e => e.status !== 'success');
    if (unsyncedEntries.length === 0) {
      addToast({
        title: 'Already in Sync',
        message: 'All visible entries are already successfully synced to Tally.',
        type: 'success'
      });
      return;
    }

    try {
      setIsSyncing(true);
      const token = localStorage.getItem('token');
      const entryIds = unsyncedEntries.map(e => e._id);
      
      await axios.post(
        '/api/entries/bulk-retry',
        { entryIds, withItems },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setEntries(prev => prev.map(e => 
        entryIds.includes(e._id) ? { ...e, status: 'pending' } : e
      ));

      addToast({
        title: 'Sync Started',
        message: `Triggered sync for ${entryIds.length} entries.`,
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'Sync Failed',
        message: err.response?.data?.message || 'Failed to trigger sync to Tally.',
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const cleanString = (str: string) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // JSON parsing logic
  const handleJsonParse = () => {
    if (!jsonInput.trim()) {
      addToast({
        title: 'Input Empty',
        message: 'Please paste GSTR-2B JSON data first.',
        type: 'error'
      });
      return;
    }

    try {
      const data = JSON.parse(jsonInput);
      let extracted: PortalBill[] = [];

      if (data.b2b && Array.isArray(data.b2b)) {
        data.b2b.forEach((supplier: any) => {
          const ctin = supplier.ctin || '';
          const name = supplier.tradeName || supplier.lgnm || `Supplier (${ctin})`;
          if (Array.isArray(supplier.inv)) {
            supplier.inv.forEach((inv: any) => {
              let formattedDate = inv.idt || '';
              const dateParts = formattedDate.split('-');
              if (dateParts.length === 3 && dateParts[0].length !== 4) {
                formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
              }

              let txval = 0;
              let taxAmt = 0;
              if (Array.isArray(inv.itms)) {
                inv.itms.forEach((itm: any) => {
                  const det = itm.itm_det;
                  if (det) {
                    txval += Number(det.txval || 0);
                    taxAmt += Number(det.iamt || 0) + Number(det.camt || 0) + Number(det.samt || 0);
                  }
                });
              }

              extracted.push({
                invoiceNumber: inv.inum || '',
                date: formattedDate,
                partyGstin: ctin,
                partyName: name,
                taxableAmount: txval || (Number(inv.val || 0) - taxAmt),
                taxAmount: taxAmt,
                totalAmount: Number(inv.val || 0),
                gstType: taxAmt > 0 && inv.itms?.[0]?.itm_det?.iamt > 0 ? 'igst' : 'cgst-sgst'
              });
            });
          }
        });
      } else if (Array.isArray(data)) {
        extracted = data.map((item: any) => ({
          invoiceNumber: item.invoiceNumber || item.inum || item.invoice_no || '',
          date: item.date || item.idt || '',
          partyGstin: item.partyGstin || item.ctin || item.gstin || '',
          partyName: item.partyName || item.tradeName || item.supplierName || 'Unknown',
          taxableAmount: Number(item.taxableAmount || item.txval || 0),
          taxAmount: Number(item.taxAmount || item.tax_amount || 0),
          totalAmount: Number(item.totalAmount || item.val || 0),
          gstType: item.gstType || 'cgst-sgst'
        }));
      } else {
        throw new Error('Unrecognized JSON format. Paste official GSTR b2b data or a flat array.');
      }

      if (extracted.length === 0) {
        throw new Error('No invoices found in JSON.');
      }

      setPortalBills(extracted);
      setSelectedMissingInvoices([]);
      addToast({
        title: 'JSON Parsed Successfully',
        message: `Extracted ${extracted.length} GSTR-2B invoices.`,
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'Parse Failed',
        message: err.message,
        type: 'error'
      });
    }
  };

  // Excel parsing logic
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const sheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('b2b') || n.toLowerCase().includes('invoice')
        ) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        
        if (rows.length === 0) {
          throw new Error('Workbook is empty.');
        }

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i];
          if (Array.isArray(row)) {
            const hasGstin = row.some(cell => String(cell).toLowerCase().includes('gstin') || String(cell).toLowerCase().includes('ctin'));
            const hasInv = row.some(cell => String(cell).toLowerCase().includes('invoice') || String(cell).toLowerCase().includes('inv'));
            if (hasGstin && hasInv) {
              headerIdx = i;
              break;
            }
          }
        }
        
        if (headerIdx === -1) headerIdx = 0;
        
        const headers = rows[headerIdx].map((h: any) => String(h || '').trim().toLowerCase());
        
        const findCol = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
        
        const gstinIdx = findCol(['gstin', 'ctin', 'supplier gstin', 'supplier\'s gstin']);
        const nameIdx = findCol(['supplier name', 'trade name', 'legal name', 'supplier', 'trade/legal']);
        const invIdx = findCol(['invoice number', 'invoice no', 'inv no', 'number', 'inum']);
        const dateIdx = findCol(['invoice date', 'date', 'idt', 'inv date']);
        const totalIdx = findCol(['invoice value', 'total amount', 'val', 'invoice value(₹)', 'amount', 'total val']);
        const taxableIdx = findCol(['taxable value', 'taxable amount', 'txval', 'taxable val']);
        const igstIdx = findCol(['igst', 'integrated tax', 'iamt']);
        const cgstIdx = findCol(['cgst', 'central tax', 'camt']);
        const sgstIdx = findCol(['sgst', 'state tax', 'samt']);

        const extracted: PortalBill[] = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const gstin = gstinIdx !== -1 ? String(row[gstinIdx] || '').trim() : '';
          const invNum = invIdx !== -1 ? String(row[invIdx] || '').trim() : '';
          
          if (!gstin || !invNum || invNum.toLowerCase().includes('total')) continue;
          
          const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : `Supplier (${gstin})`;
          
          let rawDate = dateIdx !== -1 ? row[dateIdx] : '';
          let dateStr = '';
          if (rawDate) {
            if (typeof rawDate === 'number') {
              const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
              dateStr = dateObj.toISOString().split('T')[0];
            } else {
              const cleanD = String(rawDate).trim();
              const p = cleanD.split(/[-/]/);
              if (p.length === 3) {
                if (p[2].length === 4) {
                  dateStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                } else if (p[0].length === 4) {
                  dateStr = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                }
              }
            }
          }
          
          if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

          const totalVal = totalIdx !== -1 ? Number(row[totalIdx] || 0) : 0;
          const taxableVal = taxableIdx !== -1 ? Number(row[taxableIdx] || 0) : totalVal;
          const igst = igstIdx !== -1 ? Number(row[igstIdx] || 0) : 0;
          const cgst = cgstIdx !== -1 ? Number(row[cgstIdx] || 0) : 0;
          const sgst = sgstIdx !== -1 ? Number(row[sgstIdx] || 0) : 0;
          
          const taxVal = igst || (cgst + sgst);
          const gstType = igst > 0 ? 'igst' : 'cgst-sgst';

          extracted.push({
            invoiceNumber: invNum,
            date: dateStr,
            partyGstin: gstin,
            partyName: name,
            taxableAmount: taxableVal,
            taxAmount: taxVal,
            totalAmount: totalVal || (taxableVal + taxVal),
            gstType
          });
        }

        if (extracted.length === 0) {
          throw new Error('No invoices detected. Check headers.');
        }

        setPortalBills(extracted);
        setSelectedMissingInvoices([]);
        addToast({
          title: 'Excel Upload Completed',
          message: `Imported ${extracted.length} invoices.`,
          type: 'success'
        });
      } catch (err: any) {
        addToast({
          title: 'Import Failed',
          message: err.message,
          type: 'error'
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Compare GSTR and TallySync entries
  const reconciledItems = useMemo<ReconciliationItem[]>(() => {
    if (filteredPortalBills.length === 0) return [];
    
    return filteredPortalBills.map(p => {
      const pInv = cleanString(p.invoiceNumber);
      
      // Try to find a match in TallySync entries (search all entries to be robust)
      const match = entries.find(t => {
        const tInv = cleanString(t.invoiceNumber);
        return tInv === pInv;
      });

      let isMatched = false;
      let isMismatch = false;
      let matchReason = '';

      if (match) {
        const amountDiff = Math.abs((match.totalAmount || 0) - (p.totalAmount || 0));
        const dateDiff = match.date && p.date ? Math.abs(new Date(match.date).getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24) : 0;
        
        if (amountDiff >= 15) {
          isMismatch = true;
          matchReason = `Amount mismatch: Portal ₹${p.totalAmount} vs TallySync ₹${match.totalAmount}`;
        } else if (dateDiff > 7) {
          isMismatch = true;
          matchReason = `Date mismatch: Portal ${p.date} vs TallySync ${match.date}`;
        } else {
          isMatched = true;
          matchReason = 'Matched';
        }
      } else {
        matchReason = 'Missing in TallySync';
      }

      return {
        portalBill: p,
        tallyEntry: match || null,
        isMatched,
        isMismatch,
        matchReason
      };
    });
  }, [entries, filteredPortalBills]);

  // Reconciliation summary
  const reconSummary = useMemo(() => {
    const total = reconciledItems.length;
    const matched = reconciledItems.filter(i => i.isMatched).length;
    const mismatch = reconciledItems.filter(i => i.isMismatch).length;
    const unmatched = total - matched - mismatch;
    
    const matchedAmt = reconciledItems.filter(i => i.isMatched).reduce((s, i) => s + i.portalBill.totalAmount, 0);
    const unmatchedAmt = reconciledItems.filter(i => !i.isMatched && !i.isMismatch).reduce((s, i) => s + i.portalBill.totalAmount, 0);
    const mismatchAmt = reconciledItems.filter(i => i.isMismatch).reduce((s, i) => s + i.portalBill.totalAmount, 0);

    return { total, matched, unmatched, mismatch, matchedAmt, unmatchedAmt, mismatchAmt };
  }, [reconciledItems]);

  const displayedReconItems = useMemo(() => {
    return reconciledItems.filter(item => {
      if (reconFilter === 'matched') return item.isMatched;
      if (reconFilter === 'unmatched') return !item.isMatched && !item.isMismatch;
      if (reconFilter === 'mismatch') return item.isMismatch;
      return true;
    });
  }, [reconciledItems, reconFilter]);

  const toggleSelectInvoice = (invNum: string) => {
    setSelectedMissingInvoices(prev => 
      prev.includes(invNum) ? prev.filter(n => n !== invNum) : [...prev, invNum]
    );
  };

  const toggleSelectAllMissing = () => {
    const missingInvs = reconciledItems.filter(i => !i.isMatched && !i.isMismatch).map(i => i.portalBill.invoiceNumber);
    if (selectedMissingInvoices.length === missingInvs.length) {
      setSelectedMissingInvoices([]);
    } else {
      setSelectedMissingInvoices(missingInvs);
    }
  };

  // Import selected GSTR invoices and Sync to Tally
  const handleImportAndSync = async () => {
    if (selectedMissingInvoices.length === 0) return;
    
    const billsToImport = reconciledItems
      .filter(i => !i.isMatched && !i.isMismatch && selectedMissingInvoices.includes(i.portalBill.invoiceNumber))
      .map(i => i.portalBill);

    try {
      setIsImporting(true);
      const token = localStorage.getItem('token');
      
      const res = await axios.post(
        '/api/entries/reconciled-bulk',
        { entries: billsToImport },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data?.success) {
        addToast({
          title: 'Import Success',
          message: `Successfully imported & queued ${res.data.count} GSTR entries for Tally Sync.`,
          type: 'success'
        });
        
        setSelectedMissingInvoices([]);
        setJsonInput('');
        setExcelFile(null);
        setPortalBills([]);
        
        fetchEntries();
        setActiveTab('all-bills');
      }
    } catch (err: any) {
      addToast({
        title: 'Import Failed',
        message: err.response?.data?.error || 'Failed to import GSTR bills.',
        type: 'error'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-3 w-3" /> Synced
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck className="w-48 h-48" />
          </div>
          <div className="space-y-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-black bg-teal-50 text-teal-600 px-3 py-1 rounded-full uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5" /> GST Reconciliation
            </span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">GSTR-2B Reconciliation</h1>
            <p className="text-sm font-semibold text-slate-500">Compare GSTR-2B portal files side-by-side with local TallySync purchases and sync missing entries</p>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-[0_10px_40px_-20px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2 px-2 border-r border-slate-100">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Reconcile Period</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'lastMonth', label: 'Last 1 Month' },
              { id: 'quarterly', label: 'Last 3 Months' },
              { id: 'lastYear', label: 'Last 1 Year' },
              { id: 'custom', label: 'Custom Period' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setTimeFilter(opt.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  timeFilter === opt.id 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20' 
                    : 'bg-slate-55 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-left-4">
              <input 
                type="date" 
                value={customDateRange.from}
                onChange={e => setCustomDateRange(p => ({ ...p, from: e.target.value }))}
                className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
              />
              <span className="text-slate-400 text-xs font-bold font-mono">to</span>
              <input 
                type="date" 
                value={customDateRange.to}
                onChange={e => setCustomDateRange(p => ({ ...p, to: e.target.value }))}
                className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
              />
            </div>
          )}

          <div className="relative flex-1 md:max-w-xs md:ml-auto">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by party, invoice, gstin..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 max-w-md">
          <button
            onClick={() => setActiveTab('all-bills')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'all-bills' 
                ? 'bg-white text-teal-600 shadow-md' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Local Purchase Bills ({filteredEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'reconciliation' 
                ? 'bg-white text-teal-600 shadow-md' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Reconciliation Portal {portalBills.length > 0 && `(${reconSummary.unmatched} Missing)`}
          </button>
        </div>

        {activeTab === 'all-bills' ? (
          <>
            {/* Top Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-2xl">
              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  <span className="text-teal-600 font-black">{filteredEntries.length}</span> Local Purchase Bills • <span className="text-slate-800 font-black">{formatCurrency(filteredEntries.reduce((s, e) => s + (e.totalAmount || 0), 0))}</span> Total
                </span>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setWithItems(true)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${withItems ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    With Items
                  </button>
                  <button
                    onClick={() => setWithItems(false)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${!withItems ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Without Items
                  </button>
                </div>
                
                <button
                  onClick={handleSync}
                  disabled={isSyncing || isLoading}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync to Tally'}
                </button>
              </div>
            </div>

            {/* Summary Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Taxable Value</span>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.taxableValue)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total CGST</span>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.cgst)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total SGST</span>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.sgst)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total IGST</span>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.igst)}</span>
              </div>
            </div>

            {/* Content Table */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <RefreshCcw className="h-8 w-8 animate-spin opacity-50 mb-4" />
                <p className="font-bold text-sm">Loading purchase entries...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-200/60">
                <Search className="h-12 w-12 opacity-20 mb-4" />
                <p className="font-bold text-lg text-slate-650">No purchase bills found in this period</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Invoice No.</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Supplier Name</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">GSTIN</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Taxable</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">CGST</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">SGST</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">IGST</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Total</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map(e => (
                        <tr key={e._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-slate-650">
                            {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900">{e.invoiceNumber || 'N/A'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-800 max-w-[200px] truncate">{e.partyName}</td>
                          <td className="px-6 py-4">
                            {e.partyGstin ? (
                              <span className="text-xs font-bold font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{e.partyGstin}</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-850 font-mono text-right">{formatCurrency(e.taxableAmount || 0)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right">
                            {e.gstType !== 'igst' ? formatCurrency((e.taxAmount || 0) / 2) : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right">
                            {e.gstType !== 'igst' ? formatCurrency((e.taxAmount || 0) / 2) : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono text-right">
                            {e.gstType === 'igst' ? formatCurrency(e.taxAmount || 0) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-teal-600 font-mono text-right">{formatCurrency(e.totalAmount || 0)}</td>
                          <td className="px-6 py-4 text-center">{getStatusBadge(e.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          /* GSTR-2B Reconciliation Tab */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Input Portal Data side panel */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Upload Portal Data</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Upload Excel sheet or paste GSTR-2B JSON data</p>
              </div>

              {/* Excel upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Excel GSTR-2B File</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-teal-400 transition-colors relative cursor-pointer group bg-slate-50/50">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-teal-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700">
                      {excelFile ? excelFile.name : 'Select or drag GSTR Excel'}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400">Excel format downloaded from GST Portal</span>
                  </div>
                </div>
              </div>

              {/* OR divider */}
              <div className="flex items-center text-slate-350 text-xs font-black uppercase tracking-widest gap-3">
                <div className="h-[1px] bg-slate-200 flex-1" />
                <span>OR</span>
                <div className="h-[1px] bg-slate-200 flex-1" />
              </div>

              {/* JSON Paste area */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Paste GSTR-2B JSON text</label>
                <textarea
                  placeholder='{"b2b": [{"ctin": "...", "inv": [...]}]}'
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 min-h-[160px] outline-none font-mono placeholder-slate-350 focus:border-teal-400 focus:bg-white transition-all resize-none"
                />
                <button
                  onClick={handleJsonParse}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <FileCode className="w-4.5 h-4.5 text-teal-400" />
                  Parse GSTR JSON Text
                </button>
              </div>

              {portalBills.length > 0 && (
                <button
                  onClick={() => {
                    setPortalBills([]);
                    setJsonInput('');
                    setExcelFile(null);
                    setSelectedMissingInvoices([]);
                  }}
                  className="w-full py-3 border border-rose-250 text-rose-600 bg-rose-50/50 hover:bg-rose-55 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Clear Imported Data
                </button>
              )}
            </div>

            {/* Reconciliation Comparison Results panel */}
            <div className="lg:col-span-8 space-y-6">
              {filteredPortalBills.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/60 p-12 text-center text-slate-400">
                  <Upload className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-slate-750">No Portal Data In This Period</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
                    {portalBills.length === 0 
                      ? 'Please paste GSTR JSON data or upload an Excel file on the left panel to begin side-by-side reconciliation.'
                      : 'You have imported portal data, but no records fall within the selected period filter above. Try choosing "All Time".'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Blocks */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col gap-1 shadow-2xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">GSTR Bills</span>
                      <span className="text-lg font-black text-slate-800 font-mono">{reconSummary.total}</span>
                    </div>
                    
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-150 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Matched</span>
                      <span className="text-lg font-black text-emerald-800 font-mono">{reconSummary.matched}</span>
                      <span className="text-[9px] font-bold text-emerald-600 font-mono">{formatCurrency(reconSummary.matchedAmt)}</span>
                    </div>

                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-150 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Mismatch</span>
                      <span className="text-lg font-black text-amber-800 font-mono">{reconSummary.mismatch}</span>
                      <span className="text-[9px] font-bold text-amber-600 font-mono">{formatCurrency(reconSummary.mismatchAmt)}</span>
                    </div>

                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-150 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider">Missing in Tally</span>
                      <span className="text-lg font-black text-rose-800 font-mono">{reconSummary.unmatched}</span>
                      <span className="text-[9px] font-bold text-rose-600 font-mono">{formatCurrency(reconSummary.unmatchedAmt)}</span>
                    </div>
                  </div>

                  {/* Filter and bulk action */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {[
                        { id: 'unmatched', label: `Missing in Tally (${reconSummary.unmatched})` },
                        { id: 'mismatch', label: `Mismatch (${reconSummary.mismatch})` },
                        { id: 'matched', label: `Matched (${reconSummary.matched})` },
                        { id: 'all', label: `All (${reconSummary.total})` }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setReconFilter(f.id as any)}
                          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                            reconFilter === f.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {reconFilter === 'unmatched' && reconSummary.unmatched > 0 && (
                      <button
                        onClick={handleImportAndSync}
                        disabled={selectedMissingInvoices.length === 0 || isImporting}
                        className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-750 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${isImporting ? 'animate-spin' : ''}`} />
                        Import & Sync ({selectedMissingInvoices.length}) to Tally
                      </button>
                    )}
                  </div>

                  {/* Side-by-side comparison Table */}
                  <div className="bg-white rounded-3xl border border-slate-200/60 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-550 tracking-wider">
                            {reconFilter === 'unmatched' && (
                              <th className="pl-4 py-4 w-10 text-center border-r border-slate-200 bg-slate-100/50">
                                <button
                                  onClick={toggleSelectAllMissing}
                                  className="text-slate-400 hover:text-teal-600 transition-colors"
                                >
                                  {selectedMissingInvoices.length === reconciledItems.filter(i => !i.isMatched && !i.isMismatch).length ? (
                                    <CheckSquare className="w-4 h-4 text-teal-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                            )}
                            <th className="px-4 py-4 border-r border-slate-200 bg-teal-50/20 text-teal-850" colSpan={3}>GST Portal Invoices</th>
                            <th className="px-4 py-4 border-r border-slate-200 bg-slate-50 text-slate-800" colSpan={3}>TallySync Database Matches</th>
                            <th className="px-4 py-4 text-center">Status</th>
                          </tr>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-405 uppercase tracking-wider">
                            {reconFilter === 'unmatched' && <th className="border-r border-slate-200"></th>}
                            <th className="px-4 py-2">Invoice No / Date</th>
                            <th className="px-4 py-2">Supplier / GSTIN</th>
                            <th className="px-4 py-2 border-r border-slate-200 text-right">Amount</th>
                            <th className="px-4 py-2">Invoice No / Date</th>
                            <th className="px-4 py-2">Supplier Name</th>
                            <th className="px-4 py-2 border-r border-slate-200 text-right">Amount</th>
                            <th className="px-4 py-2 text-center">Reconcile Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedReconItems.length === 0 ? (
                            <tr>
                              <td colSpan={reconFilter === 'unmatched' ? 8 : 7} className="py-16 text-center text-slate-400 font-bold text-sm bg-white">
                                No entries match this criteria.
                              </td>
                            </tr>
                          ) : (
                            displayedReconItems.map(item => {
                              const b = item.portalBill;
                              const t = item.tallyEntry;
                              const isSelected = selectedMissingInvoices.includes(b.invoiceNumber);
                              
                              return (
                                <tr 
                                  key={b.invoiceNumber} 
                                  className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                                    item.isMatched 
                                      ? 'bg-emerald-50/5' 
                                      : item.isMismatch 
                                      ? 'bg-amber-50/10' 
                                      : 'bg-rose-50/10 hover:bg-rose-50/20'
                                  }`}
                                >
                                  {reconFilter === 'unmatched' && (
                                    <td className="pl-4 py-4 text-center border-r border-slate-100">
                                      <button
                                        onClick={() => toggleSelectInvoice(b.invoiceNumber)}
                                        className="text-slate-400 hover:text-teal-600 transition-colors"
                                      >
                                        {isSelected ? (
                                          <CheckSquare className="w-4 h-4 text-teal-600" />
                                        ) : (
                                          <Square className="w-4 h-4" />
                                        )}
                                      </button>
                                    </td>
                                  )}
                                  
                                  {/* Portal details */}
                                  <td className="px-4 py-4 bg-teal-50/5">
                                    <div className="font-black text-slate-900 leading-tight">{b.invoiceNumber}</div>
                                    <div className="text-[10px] font-semibold text-slate-450 mt-0.5">
                                      {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 bg-teal-50/5">
                                    <div className="font-bold text-slate-800 truncate max-w-[140px]" title={b.partyName}>{b.partyName}</div>
                                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">{b.partyGstin}</div>
                                  </td>
                                  <td className="px-4 py-4 text-right border-r border-slate-100 font-mono font-black text-slate-800 bg-teal-50/5">
                                    {formatCurrency(b.totalAmount)}
                                  </td>

                                  {/* TallySync Matches details */}
                                  {t ? (
                                    <>
                                      <td className="px-4 py-4">
                                        <div className="font-bold text-slate-800 leading-tight">{t.invoiceNumber || 'N/A'}</div>
                                        <div className="text-[10px] font-semibold text-slate-450 mt-0.5">
                                          {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="font-bold text-slate-850 truncate max-w-[140px]" title={t.partyName}>{t.partyName}</div>
                                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{t.partyGstin || 'No GSTIN'}</div>
                                      </td>
                                      <td className="px-4 py-4 text-right border-r border-slate-100 font-mono font-bold text-slate-700">
                                        {formatCurrency(t.totalAmount)}
                                        <div className="mt-0.5">{getStatusBadge(t.status)}</div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-4 text-slate-400 italic font-semibold text-center" colSpan={2}>
                                        Not found in local records
                                      </td>
                                      <td className="px-4 py-4 border-r border-slate-100 text-slate-400 font-mono text-right">-</td>
                                    </>
                                  )}

                                  {/* Reconcile Info Status */}
                                  <td className="px-4 py-4 text-center whitespace-nowrap">
                                    {item.isMatched ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                          <Check className="w-3 h-3" /> Reconciled
                                        </span>
                                      </div>
                                    ) : item.isMismatch ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                                          <AlertTriangle className="w-3 h-3" /> Discrepancy
                                        </span>
                                        <div className="text-[9px] font-bold text-rose-500 max-w-[130px] break-words whitespace-normal leading-normal">
                                          {item.matchReason}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                                          <AlertCircle className="w-3 h-3" /> Missing
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
};

export default GST2B;
