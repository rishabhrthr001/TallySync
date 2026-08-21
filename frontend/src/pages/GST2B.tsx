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

const STATE_CODE_TO_NAME: { [code: string]: string } = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
};

interface LineItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  hsn?: string;
  unit?: string;
}

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
  items?: LineItem[];
  notes?: string;
}

interface PortalBill {
  invoiceNumber: string;
  date: string;
  partyGstin: string;
  partyName: string;
  state?: string;
  pos?: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
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

  const companyState = useMemo(() => {
    return (user?.gstin || '08').trim().substring(0, 2);
  }, [user?.gstin]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        const partyState = (e.partyGstin || '').trim().substring(0, 2);
        const isSameState = partyState ? partyState === companyState : e.gstType !== 'igst';
        const taxAmt = Number(e.taxAmount || 0);
        const taxable = Number(e.taxableAmount || (e.totalAmount ? e.totalAmount - taxAmt : 0));

        acc.taxableValue += taxable;
        if (!isSameState) {
          acc.igst += taxAmt > 0 ? taxAmt : taxable * 0.18;
        } else {
          const half = taxAmt > 0 ? taxAmt / 2 : taxable * 0.09;
          acc.cgst += half;
          acc.sgst += half;
        }
        return acc;
      },
      { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }
    );
  }, [filteredEntries, companyState]);

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
        message: 'Please paste GSTR JSON data first.',
        type: 'error'
      });
      return;
    }

    try {
      const data = JSON.parse(jsonInput.trim());
      let extracted: PortalBill[] = [];

      // Recursive finder for B2B array
      const findB2bArray = (obj: any): any[] | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.b2b && Array.isArray(obj.b2b)) return obj.b2b;
        for (const key of Object.keys(obj)) {
          const found = findB2bArray(obj[key]);
          if (found) return found;
        }
        return null;
      };

      const b2bArray = findB2bArray(data);

      if (b2bArray && Array.isArray(b2bArray)) {
        b2bArray.forEach((supplier: any) => {
          const ctin = (supplier.ctin || '').trim().toUpperCase();
          const partyState = ctin.substring(0, 2);
          const stateName = STATE_CODE_TO_NAME[partyState] || '';
          const name = (supplier.tradeName || supplier.lgnm || supplier.cname || supplier.legalName || supplier.name || '').trim() || (ctin ? `Supplier (${ctin})` : 'Supplier');
          
          if (Array.isArray(supplier.inv)) {
            supplier.inv.forEach((inv: any) => {
              let formattedDate = inv.idt || '';
              const dateParts = formattedDate.split('-');
              if (dateParts.length === 3 && dateParts[0].length !== 4) {
                formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
              }

              const pos = inv.pos || inv.placeOfSupply || (partyState ? `${partyState}-${stateName}` : '');
              const posCode = String(pos || '').trim().substring(0, 2);
              const isSameState = partyState ? partyState === companyState : (posCode ? posCode === companyState : true);

              let txval = 0;
              let rawCgst = 0;
              let rawSgst = 0;
              let rawIgst = 0;
              let itemRate = 0;

              if (Array.isArray(inv.itms)) {
                inv.itms.forEach((itm: any) => {
                  const det = itm.itm_det || itm;
                  if (det) {
                    txval += Number(det.txval || 0);
                    rawIgst += Number(det.iamt || det.igst || 0);
                    rawCgst += Number(det.camt || det.cgst || 0);
                    rawSgst += Number(det.samt || det.sgst || 0);
                    if (det.rt != null && !isNaN(Number(det.rt)) && Number(det.rt) > 0) {
                      itemRate = Number(det.rt);
                    }
                  }
                });
              }

              const taxableAmount = txval || (Number(inv.val || 0) - (rawIgst + rawCgst + rawSgst));
              let rate = itemRate;
              if (!rate) {
                const totalTax = rawIgst + rawCgst + rawSgst;
                rate = totalTax > 0 && taxableAmount > 0 ? Math.round((totalTax / taxableAmount) * 100) : 18;
              }

              let cgst = 0;
              let sgst = 0;
              let igst = 0;
              let taxAmount = 0;

              if (isSameState) {
                cgst = rawCgst > 0 ? rawCgst : (taxableAmount * (rate / 2)) / 100;
                sgst = rawSgst > 0 ? rawSgst : (taxableAmount * (rate / 2)) / 100;
                igst = 0;
                taxAmount = cgst + sgst;
              } else {
                igst = rawIgst > 0 ? rawIgst : (taxableAmount * rate) / 100;
                cgst = 0;
                sgst = 0;
                taxAmount = igst;
              }

              const totalAmount = Number(inv.val || (taxableAmount + taxAmount));

              extracted.push({
                invoiceNumber: inv.inum || '',
                date: formattedDate,
                partyGstin: ctin,
                partyName: name,
                state: stateName,
                pos: String(pos),
                rate: rate,
                taxableAmount: Number(taxableAmount.toFixed(2)),
                taxAmount: Number(taxAmount.toFixed(2)),
                cgst: Number(cgst.toFixed(2)),
                sgst: Number(sgst.toFixed(2)),
                igst: Number(igst.toFixed(2)),
                totalAmount: Number(totalAmount.toFixed(2)),
                gstType: isSameState ? 'cgst-sgst' : 'igst'
              });
            });
          }
        });
      } else if (Array.isArray(data)) {
        extracted = data.map((item: any) => {
          const gstin = (item.partyGstin || item.ctin || item.gstin || '').trim().toUpperCase();
          const partyState = gstin.substring(0, 2);
          const stateName = STATE_CODE_TO_NAME[partyState] || '';
          const pos = item.pos || item.placeOfSupply || (partyState ? `${partyState}-${stateName}` : '');
          const posCode = String(pos || '').trim().substring(0, 2);
          const isSameState = partyState ? partyState === companyState : (posCode ? posCode === companyState : true);
          
          const taxableAmount = Number(item.taxableAmount || item.txval || 0);
          let rate = Number(item.rate || item.taxRate || 0);
          let rawIgst = Number(item.igst || item.iamt || 0);
          let rawCgst = Number(item.cgst || item.camt || 0);
          let rawSgst = Number(item.sgst || item.samt || 0);
          const explicitTax = rawIgst + rawCgst + rawSgst || Number(item.taxAmount || 0);

          if (!rate) {
            rate = explicitTax > 0 && taxableAmount > 0 ? Math.round((explicitTax / taxableAmount) * 100) : 18;
          }

          let cgst = 0;
          let sgst = 0;
          let igst = 0;
          let taxAmount = 0;

          if (isSameState) {
            cgst = rawCgst > 0 ? rawCgst : (taxableAmount * (rate / 2)) / 100;
            sgst = rawSgst > 0 ? rawSgst : (taxableAmount * (rate / 2)) / 100;
            igst = 0;
            taxAmount = cgst + sgst;
          } else {
            igst = rawIgst > 0 ? rawIgst : (taxableAmount * rate) / 100;
            cgst = 0;
            sgst = 0;
            taxAmount = igst;
          }

          const totalAmount = Number(item.totalAmount || item.val || (taxableAmount + taxAmount));

          return {
            invoiceNumber: item.invoiceNumber || item.inum || item.invoice_no || '',
            date: item.date || item.idt || '',
            partyGstin: gstin,
            partyName: item.partyName || item.tradeName || item.supplierName || 'Unknown',
            state: stateName,
            pos: String(pos),
            rate: rate,
            taxableAmount: Number(taxableAmount.toFixed(2)),
            taxAmount: Number(taxAmount.toFixed(2)),
            cgst: Number(cgst.toFixed(2)),
            sgst: Number(sgst.toFixed(2)),
            igst: Number(igst.toFixed(2)),
            totalAmount: Number(totalAmount.toFixed(2)),
            gstType: isSameState ? 'cgst-sgst' : 'igst'
          };
        });
      } else {
        throw new Error('Unrecognized GSTR JSON structure. Paste official GSTR return data.');
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

  // Excel parsing logic with SheetJS CE
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Find relevant sheet (b2b, b2ba, invoice, or first sheet)
        const sheetName = workbook.SheetNames.find(n => {
          const lower = n.toLowerCase();
          return lower.includes('b2b') || lower.includes('invoice') || lower.includes('gstr');
        }) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[];
        
        if (rows.length === 0) {
          throw new Error('Workbook is empty.');
        }

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const row = rows[i];
          if (Array.isArray(row)) {
            const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
            const hasGstin = rowStr.includes('gstin') || rowStr.includes('ctin') || rowStr.includes('supplier');
            const hasInv = rowStr.includes('invoice') || rowStr.includes('inv') || rowStr.includes('taxable');
            if (hasGstin && hasInv) {
              headerIdx = i;
              break;
            }
          }
        }
        
        if (headerIdx === -1) headerIdx = 0;
        
        const headers = rows[headerIdx].map((h: any) => String(h || '').trim().toLowerCase());
        
        const findCol = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
        
        const gstinIdx = findCol(['gstin of supplier', 'supplier gstin', 'gstin', 'ctin', "supplier's gstin"]);
        const nameIdx = findCol(['trade/legal name', 'legal name', 'trade name', 'supplier name', 'name of supplier', 'party name', 'supplier', 'cname']);
        const invIdx = findCol(['invoice number', 'invoice no', 'inv no', 'inum', 'invoice no.']);
        const dateIdx = findCol(['invoice date', 'date', 'idt', 'inv date']);
        const totalIdx = findCol(['invoice value', 'invoice value (₹)', 'invoice value(₹)', 'val', 'total amount', 'invoice amount']);
        const posIdx = findCol(['place of supply', 'place of supply (pos)', 'place of supply(pos)', 'pos', 'state name', 'state']);
        const rateIdx = findCol(['rate', 'rate (%)', 'rate(%)', 'tax rate', 'gst rate', 'applicable % of tax rate']);
        const taxableIdx = findCol(['taxable value', 'taxable value (₹)', 'taxable value(₹)', 'taxable val', 'txval', 'taxable amount']);
        const igstIdx = findCol(['integrated tax', 'integrated tax (₹)', 'integrated tax(₹)', 'igst', 'iamt']);
        const cgstIdx = findCol(['central tax', 'central tax (₹)', 'central tax(₹)', 'cgst', 'camt']);
        const sgstIdx = findCol(['state/ut tax', 'state tax', 'state tax (₹)', 'state tax(₹)', 'state/ut tax (₹)', 'sgst', 'samt', 'utgst']);

        const extracted: PortalBill[] = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const gstin = gstinIdx !== -1 ? String(row[gstinIdx] || '').trim().toUpperCase() : '';
          const invNum = invIdx !== -1 ? String(row[invIdx] || '').trim() : '';
          
          if (!gstin || !invNum || invNum.toLowerCase().includes('total') || gstin.toLowerCase().includes('total')) continue;
          
          const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
          const name = rawName || `Supplier (${gstin})`;
          
          // Place of Supply / State detection
          const rawPos = posIdx !== -1 ? String(row[posIdx] || '').trim() : '';
          const partyState = gstin.length >= 2 ? gstin.substring(0, 2) : '';
          const stateName = STATE_CODE_TO_NAME[partyState] || rawPos || '';
          const pos = rawPos || (partyState ? `${partyState}-${stateName}` : '');

          // Date formatting
          let rawDate = dateIdx !== -1 ? row[dateIdx] : '';
          let dateStr = '';
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
            dateStr = dateObj.toISOString().split('T')[0];
          } else if (rawDate) {
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
          if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

          const totalVal = totalIdx !== -1 ? Number(row[totalIdx] || 0) : 0;
          const taxableVal = taxableIdx !== -1 ? Number(row[taxableIdx] || 0) : totalVal;
          const rawIgst = igstIdx !== -1 ? Number(row[igstIdx] || 0) : 0;
          const rawCgst = cgstIdx !== -1 ? Number(row[cgstIdx] || 0) : 0;
          const rawSgst = sgstIdx !== -1 ? Number(row[sgstIdx] || 0) : 0;
          const explicitTax = rawIgst + rawCgst + rawSgst;

          // Rate calculation
          let rate = rateIdx !== -1 && row[rateIdx] != null && !isNaN(Number(row[rateIdx])) && Number(row[rateIdx]) > 0
            ? Number(row[rateIdx])
            : 0;

          if (!rate) {
            if (explicitTax > 0 && taxableVal > 0) {
              rate = Math.round((explicitTax / taxableVal) * 100);
            } else {
              rate = 18;
            }
          }

          // State matching
          const isSameState = partyState ? partyState === companyState : (rawIgst === 0 && (rawCgst > 0 || rawSgst > 0));
          
          let cgst = 0;
          let sgst = 0;
          let igst = 0;
          let finalTax = 0;

          if (isSameState) {
            cgst = rawCgst > 0 ? rawCgst : (taxableVal * (rate / 2)) / 100;
            sgst = rawSgst > 0 ? rawSgst : (taxableVal * (rate / 2)) / 100;
            igst = 0;
            finalTax = cgst + sgst;
          } else {
            igst = rawIgst > 0 ? rawIgst : (taxableVal * rate) / 100;
            cgst = 0;
            sgst = 0;
            finalTax = igst;
          }

          const finalTotal = totalVal > 0 ? totalVal : (taxableVal + finalTax);

          extracted.push({
            invoiceNumber: invNum,
            date: dateStr,
            partyGstin: gstin,
            partyName: name,
            state: stateName,
            pos: pos,
            rate: rate,
            taxableAmount: Number(taxableVal.toFixed(2)),
            taxAmount: Number(finalTax.toFixed(2)),
            cgst: Number(cgst.toFixed(2)),
            sgst: Number(sgst.toFixed(2)),
            igst: Number(igst.toFixed(2)),
            totalAmount: Number(finalTotal.toFixed(2)),
            gstType: isSameState ? 'cgst-sgst' : 'igst'
          });
        }

        if (extracted.length === 0) {
          throw new Error('No invoices detected. Please check sheet columns.');
        }

        setPortalBills(extracted);
        setSelectedMissingInvoices([]);
        addToast({
          title: 'SheetJS Excel Upload Success',
          message: `Parsed ${extracted.length} GSTR-2B purchase vouchers with exact rates and state tax breakdown.`,
          type: 'success'
        });
      } catch (err: any) {
        addToast({
          title: 'Excel Import Failed',
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

  // Import selected GSTR invoices and Sync to Tally (Bulk)
  const handleImportAndSync = async () => {
    if (selectedMissingInvoices.length === 0) return;
    
    const billsToImport = reconciledItems
      .filter(i => !i.isMatched && !i.isMismatch && selectedMissingInvoices.includes(i.portalBill.invoiceNumber))
      .map(i => i.portalBill);

    await handleExecutionSync(billsToImport);
  };

  // Import single GSTR invoice and Sync to Tally
  const handleSingleImportAndSync = async (bill: PortalBill) => {
    await handleExecutionSync([bill]);
  };

  const handleExecutionSync = async (bills: PortalBill[]) => {
    try {
      setIsImporting(true);
      const token = localStorage.getItem('token');
      
      const res = await axios.post(
        '/api/entries/reconciled-bulk',
        { entries: bills },
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

  // Update existing TallySync entry with GSTR details and sync to Tally
  const handleSingleUpdateAndSync = async (item: ReconciliationItem) => {
    if (!item.tallyEntry) return;
    try {
      setIsImporting(true);
      const token = localStorage.getItem('token');
      
      const res = await axios.post(
        '/api/entries/reconciled-update',
        { 
          updates: [{
            entryId: item.tallyEntry._id,
            totalAmount: item.portalBill.totalAmount,
            taxableAmount: item.portalBill.taxableAmount,
            taxAmount: item.portalBill.taxAmount,
            date: item.portalBill.date,
            partyGstin: item.portalBill.partyGstin,
            partyName: item.portalBill.partyName
          }] 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data?.success) {
        addToast({
          title: 'Update Success',
          message: `Successfully updated and queued invoice ${item.portalBill.invoiceNumber} for Tally Sync.`,
          type: 'success'
        });
        
        fetchEntries();
      }
    } catch (err: any) {
      addToast({
        title: 'Update Failed',
        message: err.response?.data?.error || 'Failed to update entry.',
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
                : 'text-slate-505 hover:text-slate-800'
            }`}
          >
            Local Purchase Bills ({filteredEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'reconciliation' 
                ? 'bg-white text-teal-600 shadow-md' 
                : 'text-slate-505 hover:text-slate-800'
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
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-705 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total CGST</span>
                  <span className="text-[9px] font-black bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">9%</span>
                </div>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.cgst)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total SGST</span>
                  <span className="text-[9px] font-black bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">9%</span>
                </div>
                <span className="text-xl font-black text-slate-800 font-mono">{formatCurrency(summary.sgst)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total IGST</span>
                  <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">18%</span>
                </div>
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
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Date</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Invoice No.</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Supplier Name</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">GSTIN</th>
                        {withItems && (
                          <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Item Details & Breakdown</th>
                        )}
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Taxable</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">CGST (9%)</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">SGST (9%)</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">IGST (18%)</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Total Price</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredEntries.map(e => {
                        const partyState = (e.partyGstin || '').trim().substring(0, 2);
                        const isSameState = partyState ? partyState === companyState : e.gstType !== 'igst';
                        const taxAmt = Number(e.taxAmount || 0);
                        const taxable = Number(e.taxableAmount || (e.totalAmount ? e.totalAmount - taxAmt : 0));
                        const cgstVal = isSameState ? (taxAmt > 0 ? taxAmt / 2 : taxable * 0.09) : 0;
                        const sgstVal = isSameState ? (taxAmt > 0 ? taxAmt / 2 : taxable * 0.09) : 0;
                        const igstVal = !isSameState ? (taxAmt > 0 ? taxAmt : taxable * 0.18) : 0;

                        return (
                          <tr key={e._id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-4 text-xs font-bold text-slate-655 align-top whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-4 text-xs font-black text-slate-900 align-top whitespace-nowrap">{e.invoiceNumber || 'N/A'}</td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-800 max-w-[180px] truncate align-top">{e.partyName}</td>
                            <td className="px-5 py-4 align-top">
                              {e.partyGstin ? (
                                <span className="text-xs font-bold font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{e.partyGstin}</span>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 italic">N/A</span>
                              )}
                            </td>
                            {withItems && (
                              <td className="px-5 py-3.5 align-top">
                                {e.items && e.items.length > 0 ? (
                                  <div className="space-y-1.5 min-w-[240px] max-w-sm">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                                        {e.items.length} Item{e.items.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                      {e.items.map((item, iIdx) => (
                                        <div key={iIdx} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                                          <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-slate-800 truncate" title={item.name}>{item.name}</span>
                                            {item.hsn && <span className="text-[9px] text-slate-400 font-mono">HSN: {item.hsn}</span>}
                                          </div>
                                          <div className="flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap text-right">
                                            <span className="text-slate-500 font-semibold">{item.quantity} {item.unit || 'Nos'} × ₹{item.rate}</span>
                                            <span className="font-black text-slate-900">= {formatCurrency(item.amount)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400 italic py-1">
                                    No item details (Single Total Price: {formatCurrency(e.totalAmount || 0)})
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="px-5 py-4 text-xs font-black text-slate-850 font-mono text-right align-top">{formatCurrency(taxable)}</td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-650 font-mono text-right align-top">
                              {isSameState ? (
                                <div>
                                  <span>{formatCurrency(cgstVal)}</span>
                                  <span className="block text-[9px] text-emerald-600 font-bold">9%</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-650 font-mono text-right align-top">
                              {isSameState ? (
                                <div>
                                  <span>{formatCurrency(sgstVal)}</span>
                                  <span className="block text-[9px] text-emerald-600 font-bold">9%</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-650 font-mono text-right align-top">
                              {!isSameState ? (
                                <div>
                                  <span>{formatCurrency(igstVal)}</span>
                                  <span className="block text-[9px] text-indigo-600 font-bold">18%</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-sm font-black text-teal-600 font-mono text-right align-top whitespace-nowrap">{formatCurrency(e.totalAmount || (taxable + (isSameState ? cgstVal + sgstVal : igstVal)))}</td>
                            <td className="px-5 py-4 text-center align-top whitespace-nowrap">{getStatusBadge(e.status)}</td>
                          </tr>
                        );
                      })}
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
                <p className="text-xs font-semibold text-slate-505 mt-0.5">Upload Excel sheet or paste GSTR-2B JSON data</p>
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
                  className="w-full bg-slate-50 p-4 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-705 min-h-[160px] outline-none font-mono placeholder-slate-350 focus:border-teal-400 focus:bg-white transition-all resize-none"
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
                  <p className="text-xs font-semibold text-slate-505 mt-1 max-w-sm mx-auto">
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
                            reconFilter === f.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-505'
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
                        Create & Sync Selected ({selectedMissingInvoices.length}) to Tally
                      </button>
                    )}
                  </div>

                  {/* Side-by-side comparison Table */}
                  <div className="bg-white rounded-3xl border border-slate-200/60 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-555 tracking-wider">
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
                            <th className="px-4 py-4 border-r border-slate-200 bg-slate-50 text-slate-805" colSpan={3}>TallySync Database Matches</th>
                            <th className="px-4 py-4 text-center">Status</th>
                          </tr>
                          <tr className="bg-slate-55 border-b border-slate-200 text-[9px] font-bold text-slate-405 uppercase tracking-wider">
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
                                  className={`border-b border-slate-100 hover:bg-slate-55/50 transition-colors ${
                                    item.isMatched 
                                      ? 'bg-emerald-50/5' 
                                      : item.isMismatch 
                                      ? 'bg-amber-55/10' 
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
                                    {b.pos && (
                                      <div className="mt-1">
                                        <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                          POS: {b.pos}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 bg-teal-50/5">
                                    <div className="font-bold text-slate-800 truncate max-w-[150px]" title={b.partyName}>{b.partyName}</div>
                                    <div className="text-[10px] font-mono text-slate-505 mt-0.5">{b.partyGstin}</div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                        b.gstType === 'cgst-sgst' 
                                          ? 'bg-teal-50 text-teal-700 border-teal-200' 
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      }`}>
                                        {b.rate}% {b.gstType === 'cgst-sgst' ? 'CGST+SGST' : 'IGST'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-right border-r border-slate-100 font-mono bg-teal-50/5">
                                    <div className="font-black text-slate-900 text-sm">{formatCurrency(b.totalAmount)}</div>
                                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Taxable: {formatCurrency(b.taxableAmount)}</div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">
                                      {b.gstType === 'cgst-sgst' ? (
                                        <span>CGST: {formatCurrency(b.cgst)} | SGST: {formatCurrency(b.sgst)}</span>
                                      ) : (
                                        <span>IGST: {formatCurrency(b.igst)}</span>
                                      )}
                                    </div>
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
                                        <div className="font-bold text-slate-855 truncate max-w-[140px]" title={t.partyName}>{t.partyName}</div>
                                        <div className="text-[10px] font-mono text-slate-505 mt-0.5">{t.partyGstin || 'No GSTIN'}</div>
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
                                      <div className="flex flex-col items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                                          <AlertTriangle className="w-2.5 h-2.5" /> Discrepancy
                                        </span>
                                        <div className="text-[9px] font-bold text-rose-505 max-w-[140px] text-center mb-1">
                                          {item.matchReason}
                                        </div>
                                        <button
                                          onClick={() => handleSingleUpdateAndSync(item)}
                                          disabled={isImporting}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        >
                                          <RefreshCcw className="w-2.5 h-2.5" /> Update & Sync to Tally
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleSingleImportAndSync(b)}
                                        disabled={isImporting}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-teal-650 hover:bg-teal-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                      >
                                        <RefreshCcw className={`w-3 h-3 ${isImporting ? 'animate-spin' : ''}`} /> Create & Sync to Tally
                                      </button>
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
