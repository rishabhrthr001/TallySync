import React, { useEffect, useState, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, CreditCard, Plus, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCcw,
  Printer, CheckCircle2, Clock, XCircle, Trash2, Check, RotateCcw, Eye, EyeOff, Users, ChevronDown, ChevronRight, Layers, ListFilter, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { formatVoucherStatusMessage } from '../utils/statusFormatter';
import { useToast } from '../contexts/ToastContext';
import PrintableInvoice from '../components/PrintableInvoice';
import { useReactToPrint } from 'react-to-print';
import ProUpgradeModal from '../components/ProUpgradeModal';

const SUPPORTED_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "State Bank of India",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "IndusInd Bank",
  "IDFC FIRST Bank",
  "Union Bank of India",
  "Indian Bank",
  "Bank of India",
  "Yes Bank",
  "Federal Bank",
  "South Indian Bank",
  "AU Small Finance Bank",
  "IDBI Bank",
  "RBL Bank",
  "Bandhan Bank"
];

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

  // Bank Statement states
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [parsingBank, setParsingBank] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [accountType, setAccountType] = useState<string>('Current Account');
  const [bankParseResult, setBankParseResult] = useState<any>(null);
  const [targetBankLedger, setTargetBankLedger] = useState<string>('');
  const [tempTransactions, setTempTransactions] = useState<any[]>([]);
  const [syncSaving, setSyncSaving] = useState(false);
  const [bankPassword, setBankPassword] = useState<string>('');
  const [showBankPassword, setShowBankPassword] = useState<boolean>(false);
  const [showProModal, setShowProModal] = useState(false);
  const [editingTxnIdx, setEditingTxnIdx] = useState<number | null>(null);

  // States for Tally ledgers, vouchers, and reconciliation
  const [tallyLedgers, setTallyLedgers] = useState<any[]>([]);
  const [tallyVouchers, setTallyVouchers] = useState<any[]>([]);
  const [suspenseGuid, setSuspenseGuid] = useState<string>('');
  const [selectedTxnIndices, setSelectedTxnIndices] = useState<number[]>([]);
  const [bulkTargetLedger, setBulkTargetLedger] = useState<string>('');
  const [reconViewMode, setReconViewMode] = useState<'grouped' | 'list'>('grouped');
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [groupFilterText, setGroupFilterText] = useState<string>('');

  const isCloseDate = (d1: string, d2: string, daysAllowed = 10) => {
    if (!d1 || !d2) return false;
    try {
      const time1 = new Date(d1).getTime();
      const time2 = new Date(d2).getTime();
      if (isNaN(time1) || isNaN(time2)) return false;
      const diffDays = Math.abs(time1 - time2) / (1000 * 60 * 60 * 24);
      return diffDays <= daysAllowed;
    } catch {
      return false;
    }
  };

  const reconcileTxns = (txns: any[], ledgers: any[], vouchers: any[], fallbackSuspenseGuid: string) => {
    return txns.map(t => {
      const rawParty = (t.partyName || t.originalPartyName || '').trim();
      const rawNotes = (t.notes || t.narration || '').trim();
      const rawRef = (t.referenceNumber || t.invoiceNumber || '').trim();
      const isSyntheticRef = !rawRef || rawRef.startsWith('TXN-');
      const amt = Math.abs(cleanNum(t.totalAmount));
      const typeLower = (t.type || 'payment').toLowerCase();
      const targetDirection = typeLower === 'receipt' ? 'receipt' : 'payment';

      // Step A: Find Existing Ledger in Tally
      let mappedParty = 'Suspense';
      let mappedGuid = fallbackSuspenseGuid || '';

      if (rawParty && rawParty.toLowerCase() !== 'suspense') {
        const exactL = ledgers.find(l => l.partyName?.toLowerCase()?.trim() === rawParty.toLowerCase());
        if (exactL) {
          mappedParty = exactL.partyName;
          mappedGuid = exactL._id || '';
        } else {
          const fuzzyL = ledgers.find(l => {
            const lName = l.partyName?.toLowerCase()?.trim();
            return lName && (rawParty.toLowerCase().includes(lName) || lName.includes(rawParty.toLowerCase()));
          });
          if (fuzzyL) {
            mappedParty = fuzzyL.partyName;
            mappedGuid = fuzzyL._id || '';
          }
        }
      }

      if (mappedParty === 'Suspense' && fallbackSuspenseGuid) {
        mappedGuid = fallbackSuspenseGuid;
      }

      // Step B: Multi-Signal Matching against Day Book Vouchers
      let matchedV: any = null;
      let matchReason = '';

      // Signal 1: By Reference/UTR (highest confidence)
      if (!isSyntheticRef) {
        matchedV = vouchers.find(v => 
          (v.reference && v.reference.toLowerCase() === rawRef.toLowerCase()) ||
          (v.voucherNumber && v.voucherNumber.toLowerCase() === rawRef.toLowerCase()) ||
          (v.narration && v.narration.toLowerCase().includes(rawRef.toLowerCase()))
        );
        if (matchedV) matchReason = 'ref';
      }

      // Signal 2: By Party + Approximate Date Range + Direction
      if (!matchedV && mappedParty !== 'Suspense') {
        matchedV = vouchers.find(v => {
          const vParty = (v.partyName || '').toLowerCase().trim();
          const vType = (v.voucherType || '').toLowerCase();
          const vDir = (vType === 'receipt' || vType === 'sales') ? 'receipt' : 'payment';
          const partyMatch = vParty === mappedParty.toLowerCase() || vParty.includes(mappedParty.toLowerCase()) || mappedParty.toLowerCase().includes(vParty);
          const dateMatch = isCloseDate(v.date, t.date, 10);
          return partyMatch && dateMatch && vDir === targetDirection;
        });
        if (matchedV) matchReason = 'party-date';
      }

      // Signal 3: By Amount + Approximate Date Range + Direction
      if (!matchedV) {
        matchedV = vouchers.find(v => {
          const vAmt = Math.abs(cleanNum(v.amount));
          const vType = (v.voucherType || '').toLowerCase();
          const vDir = (vType === 'receipt' || vType === 'sales') ? 'receipt' : 'payment';
          const amtMatch = Math.abs(vAmt - amt) < 0.01;
          const dateMatch = isCloseDate(v.date, t.date, 5);
          return amtMatch && dateMatch && vDir === targetDirection;
        });
        if (matchedV) matchReason = 'amt-date';
      }

      // Step C: Assign Classification & Smart Default Action
      let reconStatus: 'MATCHED' | 'AMOUNT MISMATCH' | 'LEDGER MISMATCH' | 'MISSING VOUCHER' | 'SUSPENSE' = 'SUSPENSE';
      let defaultAction: 'skip' | 'alter' | 'create' = 'create';
      let tallyGuid = '';
      let diffDetail = '';

      if (matchedV) {
        tallyGuid = matchedV.guid || '';
        const vAmt = Math.abs(cleanNum(matchedV.amount));
        const amtDiff = Math.abs(vAmt - amt);
        const isAmtMatch = amtDiff < 0.01;
        const isLedgerMatch = mappedParty !== 'Suspense' && (matchedV.partyName || '').toLowerCase().trim() === mappedParty.toLowerCase().trim();

        if (isAmtMatch && isLedgerMatch) {
          reconStatus = 'MATCHED';
          defaultAction = 'skip'; // Matched -> default to SKIP (keep in history, do not duplicate)
          diffDetail = `Matched with DayBook #${matchedV.voucherNumber || matchedV.reference || 'Vch'}`;
        } else if (!isAmtMatch && (isLedgerMatch || matchReason === 'ref' || matchReason === 'party-date')) {
          reconStatus = 'AMOUNT MISMATCH';
          defaultAction = 'alter'; // Soft amount matching -> default to ALTER with tallyGuid
          diffDetail = `Bank: ₹${amt.toLocaleString('en-IN')} vs Tally: ₹${vAmt.toLocaleString('en-IN')}`;
        } else if (!isLedgerMatch && (isAmtMatch || matchReason === 'ref' || matchReason === 'amt-date')) {
          reconStatus = 'LEDGER MISMATCH';
          defaultAction = 'alter'; // Existing voucher found, default to ALTER to prevent duplicate
          diffDetail = `Tally: ${matchedV.partyName || 'Unknown'} → Bank: ${mappedParty}`;
        } else {
          reconStatus = 'AMOUNT MISMATCH';
          defaultAction = 'alter';
          diffDetail = `Bank: ₹${amt.toLocaleString('en-IN')} vs Tally: ₹${vAmt.toLocaleString('en-IN')}`;
        }
      } else {
        if (mappedParty !== 'Suspense') {
          reconStatus = 'MISSING VOUCHER';
          defaultAction = 'create';
          diffDetail = `New voucher for ${mappedParty}`;
        } else {
          reconStatus = 'SUSPENSE';
          defaultAction = 'create';
          diffDetail = `Unmapped party → Posting via Suspense A/c`;
        }
      }

      return {
        ...t,
        partyName: t.partyName || mappedParty,
        partyGuid: t.partyGuid || mappedGuid,
        bankPartyName: t.bankPartyName || rawParty || mappedParty,
        bankNarration: t.bankNarration || rawNotes,
        reconStatus,
        action: t.action || defaultAction,
        tallyGuid,
        matchedVoucher: matchedV,
        diffDetail
      };
    });
  };

  const handleRowCheckboxToggle = (idx: number) => {
    setSelectedTxnIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleHeaderCheckboxChange = () => {
    if (selectedTxnIndices.length === tempTransactions.length) {
      setSelectedTxnIndices([]);
    } else {
      setSelectedTxnIndices(tempTransactions.map((_, idx) => idx));
    }
  };

  const updatePartyMapping = (idx: number, newParty: string) => {
    const matchedLedger = tallyLedgers.find(l => l.partyName === newParty);
    const newGuid = matchedLedger ? (matchedLedger._id || '') : (newParty === 'Suspense' ? suspenseGuid : '');
    setTempTransactions(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      const isSuspense = newParty === 'Suspense';
      return {
        ...t,
        partyName: newParty,
        partyGuid: newGuid,
        reconStatus: isSuspense ? 'SUSPENSE' : (t.reconStatus === 'SUSPENSE' ? 'MISSING VOUCHER' : t.reconStatus),
        diffDetail: isSuspense ? 'Unmapped party → Posting via Suspense A/c' : `Mapped to ${newParty}`
      };
    }));
  };

  const updateRowAction = (idx: number, newAction: 'create' | 'alter' | 'skip') => {
    setTempTransactions(prev => prev.map((t, i) => i === idx ? { ...t, action: newAction } : t));
  };

  const handleBulkSetAction = (newAction: 'create' | 'alter' | 'skip') => {
    if (selectedTxnIndices.length === 0) return;
    setTempTransactions(prev => prev.map((t, idx) => 
      selectedTxnIndices.includes(idx) ? { ...t, action: newAction } : t
    ));
    showToast(`Updated ${selectedTxnIndices.length} transaction(s) action to ${newAction.toUpperCase()}!`, 'success');
  };

  const handleBulkMapLedger = () => {
    if (!bulkTargetLedger) return;
    const matchedLedger = tallyLedgers.find(l => l.partyName === bulkTargetLedger);
    const newGuid = matchedLedger ? (matchedLedger._id || '') : (bulkTargetLedger === 'Suspense' ? suspenseGuid : '');
    setTempTransactions(prev => prev.map((t, idx) => {
      if (!selectedTxnIndices.includes(idx)) return t;
      const isSuspense = bulkTargetLedger === 'Suspense';
      return {
        ...t,
        partyName: bulkTargetLedger,
        partyGuid: newGuid,
        reconStatus: isSuspense ? 'SUSPENSE' : (t.reconStatus === 'SUSPENSE' ? 'MISSING VOUCHER' : t.reconStatus),
        diffDetail: isSuspense ? 'Unmapped party → Posting via Suspense A/c' : `Mapped to ${bulkTargetLedger}`
      };
    }));
    setSelectedTxnIndices([]);
    setBulkTargetLedger('');
    showToast(`Mapped ${selectedTxnIndices.length} transactions to ${bulkTargetLedger}!`, 'success');
  };

  const normalizePartyKey = (str: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\(\)\[\]\{\}\-_,.\/\\:;]/g, ' ')
      .replace(/\b(ltd|limited|pvt|private|llp|inc|corp|co|enterprises|traders|company|agency|and|&|a\/c|ac|p|to|by)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  interface PartyClusterGroup {
    groupKey: string;
    representativeName: string;
    mappedLedger: string;
    transactions: any[];
    indices: number[];
    totalDeposit: number;
    totalWithdrawal: number;
    distinctVariations: string[];
    action: 'create' | 'alter' | 'skip';
  }

  const partyGroups = React.useMemo(() => {
    const groups: { [key: string]: PartyClusterGroup } = {};

    tempTransactions.forEach((txn, idx) => {
      const raw = (txn.bankPartyName || txn.partyName || 'Unknown Party').trim();
      const isUpi = txn.isUpi || raw.toLowerCase() === 'upi' || (txn.notes && txn.notes.toLowerCase().includes('upi'));
      
      let clusterKey = isUpi ? 'UPI_CONSOLIDATED' : normalizePartyKey(raw);
      if (!clusterKey) clusterKey = 'UNMAPPED_SUSPENSE';

      // Merge short cluster prefixes (e.g. "chambal" with "chambal fertilisers")
      const existingKeys = Object.keys(groups);
      const matchedKey = existingKeys.find(k => {
        if (k === 'UPI_CONSOLIDATED' || clusterKey === 'UPI_CONSOLIDATED') return false;
        if (k === clusterKey) return true;
        const kWords = k.split(' ').filter(w => w.length > 2);
        const cWords = clusterKey.split(' ').filter(w => w.length > 2);
        if (kWords.length > 0 && cWords.length > 0 && kWords[0] === cWords[0] && kWords[0].length >= 4) return true;
        return false;
      });

      const finalKey = matchedKey || clusterKey;

      if (!groups[finalKey]) {
        groups[finalKey] = {
          groupKey: finalKey,
          representativeName: isUpi ? 'UPI Consolidated' : raw,
          mappedLedger: txn.partyName || (isUpi ? 'UPI' : 'Suspense'),
          transactions: [],
          indices: [],
          totalDeposit: 0,
          totalWithdrawal: 0,
          distinctVariations: [],
          action: txn.action || 'create'
        };
      }

      groups[finalKey].transactions.push(txn);
      groups[finalKey].indices.push(idx);

      const amt = Math.abs(cleanNum(txn.totalAmount));
      const typeLower = (txn.type || 'payment').toLowerCase();
      const isDeposit = typeLower === 'receipt' || (typeLower === 'contra' && !txn.isWithdrawal);
      if (isDeposit) {
        groups[finalKey].totalDeposit += amt;
      } else {
        groups[finalKey].totalWithdrawal += amt;
      }

      if (raw && !groups[finalKey].distinctVariations.includes(raw)) {
        groups[finalKey].distinctVariations.push(raw);
      }

      // If a group has an already resolved non-Suspense party, use it as mappedLedger
      if (txn.partyName && txn.partyName !== 'Suspense' && (!groups[finalKey].mappedLedger || groups[finalKey].mappedLedger === 'Suspense')) {
        groups[finalKey].mappedLedger = txn.partyName;
      }
    });

    return Object.values(groups).sort((a, b) => b.transactions.length - a.transactions.length);
  }, [tempTransactions]);

  const handleMapEntireGroup = (indices: number[], targetLedgerName: string) => {
    const matchedLedger = tallyLedgers.find(l => l.partyName === targetLedgerName);
    const newGuid = matchedLedger ? (matchedLedger._id || '') : (targetLedgerName === 'Suspense' ? suspenseGuid : '');
    const isSuspense = targetLedgerName === 'Suspense';

    setTempTransactions(prev => prev.map((t, idx) => {
      if (!indices.includes(idx)) return t;
      return {
        ...t,
        partyName: targetLedgerName,
        partyGuid: newGuid,
        reconStatus: isSuspense ? 'SUSPENSE' : 'MATCHED',
        diffDetail: isSuspense ? 'Unmapped party → Posting via Suspense A/c' : `Mapped group to ${targetLedgerName}`
      };
    }));

    showToast(`Mapped ${indices.length} transaction(s) in this group to "${targetLedgerName}"!`, 'success');
  };

  const handleSetGroupAction = (indices: number[], action: 'create' | 'alter' | 'skip') => {
    setTempTransactions(prev => prev.map((t, idx) => {
      if (!indices.includes(idx)) return t;
      return { ...t, action };
    }));
    showToast(`Updated ${indices.length} transaction(s) action to ${action.toUpperCase()}!`, 'success');
  };

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroupKeys(prev => 
      prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]
    );
  };
  
  // Selection mode states for clearing entries
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  const handleSelectEntry = (id: string) => {
    setSelectedEntries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllEntries = () => {
    const visibleEntries = getFilteredRecentEntries();
    const visibleIds = visibleEntries.map((e: any) => e._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedEntries.includes(id));
    if (allSelected) {
      setSelectedEntries(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedEntries(prev => {
        const newSelection = [...prev];
        visibleIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleClearSelectedEntries = async () => {
    if (selectedEntries.length === 0) {
      showToast("No entries selected", "error");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedEntries.length} selected entries?`)) {
      return;
    }
    try {
      await axios.post('/api/entries/bulk-delete', { ids: selectedEntries }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast(`Successfully deleted ${selectedEntries.length} entries`, "success");
      setSelectedEntries([]);
      setSelectionMode(false);
      fetchData();
    } catch (err: any) {
      console.error("Bulk delete failed", err);
      showToast(err.response?.data?.error || "Failed to delete entries", "error");
    }
  };

  const updateTempTxn = (index: number, field: string, value: any) => {
    setTempTransactions(prev => prev.map((t, idx) => idx === index ? { ...t, [field]: value } : t));
  };

  const removeTempTxn = (index: number) => {
    setTempTransactions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyBankLedgerToAll = (newBank: string) => {
    setTargetBankLedger(newBank);
    setTempTransactions(prev => prev.map(t => ({ ...t, bankLedger: newBank })));
  };

  const handleBankUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankFile) return;

    const isProOrTrial = user?.isSuperAdmin || user?.subscription?.isUnlimited;
    if (!isProOrTrial) {
      showToast('🔒 AI Bank Statement Parsing is a Pro feature (₹299/mo). Upgrade to Pro to unlock full potential!', 'error');
      setShowProModal(true);
      return;
    }

    setParsingBank(true);
    setBankParseResult(null);
    setTempTransactions([]);

    const formData = new FormData();
    formData.append('pdf', bankFile);
    if (selectedBank) {
      formData.append('selectedBank', selectedBank);
    }
    if (accountType) {
      formData.append('accountType', accountType);
    }
    if (bankPassword) {
      formData.append('password', bankPassword);
    }

    try {
      const res = await axios.post('/api/entries/upload-bank-statement', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const detectedBank = selectedBank || (res.data.bankName || 'Bank Account').trim();
      if (res.data.accountType) {
        setAccountType(res.data.accountType);
      }
      setBankParseResult(res.data);
      setTargetBankLedger(detectedBank);
      
      const rawData = res.data.data || [];
      const reconciled = reconcileTxns(rawData, tallyLedgers, tallyVouchers, suspenseGuid);
      setTempTransactions(reconciled);
      showToast(`Detected ${detectedBank}! Extracted ${res.data.count} transactions with full reconciliation mapping.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to parse bank statement', 'error');
    } finally {
      setParsingBank(false);
    }
  };

  const cleanNum = (val: any): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleaned = String(val).replace(/,/g, '').replace(/[^\d.\-]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const handleConfirmAndSyncBank = async () => {
    if (tempTransactions.length === 0) {
      showToast("No transactions left to sync.", "error");
      return;
    }
    setSyncSaving(true);
    try {
      const bankName = (targetBankLedger || selectedBank || 'Bank Account').trim();
      const enrichedTransactions = tempTransactions.map(t => ({
        ...t,
        bankLedger: (t.bankLedger || bankName).trim(),
        accountType: t.accountType || accountType,
        action: t.action || 'create',
        partyName: t.partyName || 'Suspense',
        partyGuid: t.partyGuid || suspenseGuid || '',
        tallyGuid: t.tallyGuid || '',
        reconStatus: t.reconStatus || '',
        bankPartyName: t.bankPartyName || t.partyName || '',
        bankNarration: t.bankNarration || t.notes || ''
      }));

      const res = await axios.post('/api/entries/bulk', { 
        transactions: enrichedTransactions,
        bankName,
        accountType
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast(`Successfully processed ${res.data.count} transactions for ${bankName}!`, 'success');
      setIsBankModalOpen(false);
      setBankFile(null);
      setBankParseResult(null);
      setTempTransactions([]);
      setTargetBankLedger('');
      setBankPassword('');
      setAccountType('Current Account');
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to save transactions to database', 'error');
    } finally {
      setSyncSaving(false);
    }
  };

  // Print setup
  const [printData, setPrintData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintAction = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setPrintData(null)
  });

  useEffect(() => {
    if (printData && printRef.current) {
      handlePrintAction();
    }
  }, [printData, handlePrintAction]);

  // Tab filter state for recent entries
  const [recentFilter, setRecentFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [retryingBillId, setRetryingBillId] = useState<string | null>(null);

  // Load Tally ledgers and existing Day Book vouchers when modal opens
  useEffect(() => {
    if (isBankModalOpen) {
      const loadTallyData = async () => {
        try {
          const [ledgersRes, vouchersRes] = await Promise.all([
            axios.get('/api/ledger', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => ({ data: [] })),
            axios.get('/api/ledger/vouchers/all', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => ({ data: [] }))
          ]);
          
          const loadedLedgers = ledgersRes.data || [];
          const loadedVouchers = vouchersRes.data || [];
          setTallyLedgers(loadedLedgers);
          setTallyVouchers(loadedVouchers);

          const foundSuspense = loadedLedgers.find((l: any) => 
            l.partyName?.toLowerCase() === 'suspense' || l.parentGroup?.toLowerCase()?.includes('suspense')
          );
          const sGuid = foundSuspense ? (foundSuspense._id || '') : '';
          setSuspenseGuid(sGuid);

          if (tempTransactions.length > 0) {
            setTempTransactions(prev => reconcileTxns(prev, loadedLedgers, loadedVouchers, sGuid));
          }
        } catch (e) {
          console.error("Failed to load Tally data for reconciliation", e);
        }
      };
      loadTallyData();
    }
  }, [isBankModalOpen]);

  const handlePrintBill = async (entry: any) => {
    const tot = Number(entry.totalAmount || 0);
    const taxableVal = Number(entry.taxableAmount || (tot > 0 ? Number((tot / 1.18).toFixed(2)) : 0));
    const taxVal = Number(entry.taxAmount || (tot > 0 ? Number((tot - taxableVal).toFixed(2)) : 0));

    const itemsArr = Array.isArray(entry.items) && entry.items.length > 0
      ? entry.items
      : [{ 
          name: entry.partyName ? `Supply - ${entry.partyName}` : 'Taxable Supply', 
          quantity: 1, 
          rate: taxableVal, 
          amount: taxableVal, 
          gst: 18,
          hsn: '9983' 
        }];

    const formattedInvoice = {
      ...entry,
      items: itemsArr,
      taxableAmount: taxableVal,
      taxAmount: taxVal,
      totalAmount: tot,
      companyName: entry.companyName || user?.companyName || 'PHOTO BILL ENTERPRISES'
    };

    try {
      // Mark as printed in the DB
      await axios.patch(`/api/entries/${entry._id}/print-status`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Update local state
      setRecentEntries(prev => prev.map(e => e._id === entry._id ? { ...e, printed: true, printedAt: new Date() } : e));
      // Set print data
      setPrintData(formattedInvoice);
      showToast("Invoice marked as printed & sent to printer", "success");
    } catch (err) {
      console.error("Failed to update print status", err);
      // Fallback print
      setPrintData(formattedInvoice);
    }
  };

  const getFilteredRecentEntries = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return recentEntries.filter((e: any) => {
      if (recentFilter === 'today') {
        return e.date === todayStr;
      }
      if (recentFilter === 'yesterday') {
        return e.date === yesterdayStr;
      }
      if (recentFilter === 'week') {
        return new Date(e.date) >= sevenDaysAgo;
      }
      return true;
    });
  };

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
      
      setRecentEntries(entriesRes.data || []);
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

  const handleRetryBill = async (id: string) => {
    setRetryingBillId(id);
    try {
      await axios.post(`/api/entries/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('Bill re-queued for Tally agent sync!', 'success');
      setRecentEntries(prev => prev.map(e => e._id === id ? { ...e, status: 'pending', syncError: '' } : e));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to retry bill', 'error');
    } finally {
      setRetryingBillId(null);
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
      <div className="print-hidden-mobile">
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

          <button
            onClick={() => setIsBankModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-tr from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/15 transition-all active:scale-95 cursor-pointer"
          >
            <CreditCard className="h-4 w-4" />
            Upload Statement
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

      {/* Tally Live Sync Overview Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-750">Tally Balances &amp; Movements</h3>
          </div>
          {stats?.tallySummary?.lastSyncedAt && (
            <span className="text-[11px] font-bold text-slate-400">
              Last synced from Tally: {new Date(stats.tallySummary.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-indigo-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform duration-300">
                <CreditCard className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                (stats?.tallySummary?.openingBalance || 0) >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {(stats?.tallySummary?.openingBalance || 0) >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)'}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Opening Balance</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(Math.abs(stats?.tallySummary?.openingBalance || 0))}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Starting balance in Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-emerald-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform duration-300">
                <TrendingUp className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                (stats?.tallySummary?.closingBalance || 0) >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {(stats?.tallySummary?.closingBalance || 0) >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)'}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Closing Balance</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(Math.abs(stats?.tallySummary?.closingBalance || 0))}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Net closing balance in Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-blue-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform duration-300">
                <ArrowUpRight className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-blue-600 bg-blue-50">
                Debit (Dr)
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Dr Total</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(stats?.tallySummary?.totalDebit || 0)}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Total debited movements from Tally</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/70 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-amber-300 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform duration-300">
                <ArrowDownRight className="h-5.5 w-5.5 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-amber-600 bg-amber-50">
                Credit (Cr)
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cr Total</p>
              <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
                {formatCurrency(stats?.tallySummary?.totalCredit || 0)}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Total credited movements from Tally</p>
            </div>
          </div>
        </div>
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

      {/* Recent Bills Section */}
      <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="font-black text-slate-850 text-xl tracking-tight">Recent Bills</h3>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">Quickly filter, reprint, and verify print statuses</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {selectionMode ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllEntries}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {getFilteredRecentEntries().map((e: any) => e._id).every(id => selectedEntries.includes(id)) ? "Deselect All" : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={handleClearSelectedEntries}
                  className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected ({selectedEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedEntries([]);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="px-3.5 py-2 text-xs font-bold border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Entries
              </button>
            )} <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 self-start md:self-auto">
            {(['all', 'today', 'yesterday', 'week'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setRecentFilter(filter)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  recentFilter === filter
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filter === 'week' ? 'Last 7 Days' : filter}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* List of recent bills */}
        <div className="space-y-3.5">
          {getFilteredRecentEntries().length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Printer className="h-8 w-8 text-slate-350 mx-auto stroke-[1.5] mb-2.5" />
              <p className="text-sm font-bold text-slate-400">No bills found for the selected timeframe</p>
            </div>
          ) : (
            getFilteredRecentEntries().slice(0, 10).map((e: any) => (
              <div 
                key={e._id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border transition-all duration-200 gap-4 ${
                  selectedEntries.includes(e._id) 
                    ? "bg-indigo-50/20 border-indigo-250 hover:border-indigo-300" 
                    : "bg-slate-50/30 hover:bg-indigo-50/10 border-slate-200/50 hover:border-indigo-200/60"
                }`}
              >
                <div className="flex items-center gap-4.5 min-w-0">
                  {selectionMode && (
                    <input 
                      type="checkbox"
                      checked={selectedEntries.includes(e._id)}
                      onChange={() => handleSelectEntry(e._id)}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mr-2"
                    />
                  )}
                  <div className={`p-3 rounded-2xl shrink-0 ${
                    e.type === 'sales' ? 'bg-indigo-50 text-indigo-650' : 
                    e.type === 'purchase' ? 'bg-amber-50 text-amber-650' :
                    e.type === 'receipt' ? 'bg-emerald-50 text-emerald-650' :
                    e.type === 'payment' ? 'bg-rose-50 text-rose-650' :
                    e.type === 'contra' ? 'bg-purple-50 text-purple-650' :
                    'bg-slate-100 text-slate-650'
                  }`}>
                    {e.type === 'sales' || e.type === 'receipt' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    {/* Invoice Number on mobile (above party name) */}
                    <span className="sm:hidden text-[10px] font-bold text-slate-400 font-mono mb-1 tracking-wide">
                      {e.invoiceNumber || 'NO-REF'} • {e.date}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-850 truncate leading-snug">{e.partyName}</p>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        e.type === 'sales' ? 'bg-indigo-50/80 text-indigo-700' : 
                        e.type === 'purchase' ? 'bg-amber-50/80 text-amber-700' :
                        e.type === 'receipt' ? 'bg-emerald-50/80 text-emerald-700' :
                        e.type === 'payment' ? 'bg-rose-50/80 text-rose-700' :
                        e.type === 'contra' ? 'bg-purple-50/80 text-purple-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {e.type}
                      </span>
                      {e.bankLedger && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/80">
                          🏦 {e.bankLedger}
                        </span>
                      )}
                    </div>
                    {/* Invoice Number on desktop (below party name) */}
                    <p className="hidden sm:block text-[10px] font-bold text-slate-400 mt-1 font-mono tracking-wide">
                      {e.invoiceNumber || 'NO-REF'} • {e.date}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                  {/* Status & Printed Badges */}
                  <div className="flex items-center gap-3">
                    {/* Sync Status & Reason */}
                    {(() => {
                      const info = formatVoucherStatusMessage(e.status, e.syncError, e.reason);
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            e.status === 'success' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                            e.status === 'failed' ? 'text-rose-700 bg-rose-50 border border-rose-100' :
                            'text-amber-700 bg-amber-50 border border-amber-100 animate-pulse'
                          }`}>
                            {info.badgeText}
                          </span>
                          {e.status === 'failed' && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-semibold text-rose-600 max-w-[150px] truncate" title={`${info.headline} - ${info.detail}`}>
                                {info.headline}
                              </span>
                              <button
                                onClick={() => handleRetryBill(e._id)}
                                disabled={retryingBillId === e._id}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                                title="Retry sync"
                              >
                                <RotateCcw className={`h-2.5 w-2.5 ${retryingBillId === e._id ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          )}
                          {e.status === 'pending' && (
                            <span className="text-[9px] font-semibold text-amber-700 max-w-[150px] truncate" title={info.detail}>
                              {info.headline}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Printed Status */}
                    <span className={`inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                      e.printed
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100/60'
                        : 'text-slate-500 bg-slate-150 border border-slate-200'
                    }`}>
                      <Printer className="h-3 w-3 stroke-[2.2]" />
                      {e.printed ? 'Printed' : 'Not Printed'}
                    </span>
                  </div>

                  {/* Pricing and Action */}
                  <div className="flex items-center gap-4.5">
                    <p className="text-sm font-black text-slate-900 font-mono tracking-tight shrink-0">
                      {formatCurrency(e.totalAmount || 0)}
                    </p>
                    
                    <button
                      onClick={() => handlePrintBill(e)}
                      className="p-3 bg-white hover:bg-indigo-650 text-slate-600 hover:text-white border border-slate-200 hover:border-indigo-650 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                      title="Print Invoice"
                    >
                      <Printer className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center mt-6">
          <Link 
            to="/entries" 
            className="text-xs font-black text-indigo-650 hover:text-indigo-750 uppercase tracking-wider flex items-center gap-1.5 bg-indigo-50/50 hover:bg-indigo-50 px-5 py-3 rounded-2xl transition-colors"
          >
            Go to Voucher History <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>

      {/* Off-screen container for react-to-print to prevent mobile fallbacks */}
      {printData && (
        <div id="printable-invoice-root" className="print-container absolute top-[-9999px] left-[-9999px] print:static print:block font-sans text-black">
          <PrintableInvoice ref={printRef} data={printData} user={user} />
        </div>
      )}

      {/* Bank Statement Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-none">Upload Bank Statement</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Extract, review, edit, and sync bank vouchers directly to Tally</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsBankModalOpen(false);
                  setBankFile(null);
                  setBankParseResult(null);
                  setTempTransactions([]);
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleBankUpload} className="p-6 space-y-5 overflow-y-auto flex-1">
              {!bankParseResult ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bank Selection */}
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Bank</label>
                      <select 
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                        disabled={parsingBank}
                      >
                        {SUPPORTED_BANKS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Account Type Selection */}
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Account Type</label>
                      <select 
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                        disabled={parsingBank}
                      >
                        <option value="Current Account">Current Account (Bank Accounts)</option>
                        <option value="Savings Account">Savings Account (Bank Accounts)</option>
                        <option value="Overdraft Account (OD)">Overdraft Account (Bank OD A/c)</option>
                        <option value="Cash Credit (CC)">Cash Credit (Bank OCC A/c)</option>
                      </select>
                    </div>

                    {/* PDF File Upload dropzone */}
                    <div className="sm:col-span-2 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-indigo-50/5 transition-all relative">
                      <input 
                        type="file" 
                        accept=".pdf"
                        onChange={(e) => setBankFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={parsingBank}
                      />
                      <CreditCard className="h-10 w-10 text-indigo-500 mb-3 stroke-[1.5]" />
                      <span className="text-sm font-bold text-slate-700">
                        {bankFile ? bankFile.name : 'Choose bank statement PDF'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        {bankFile ? `${(bankFile.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF format only'}
                      </span>
                    </div>

                    {/* PDF Password Input */}
                    {bankFile && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PDF Password (If Encrypted)</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showBankPassword ? "text" : "password"}
                            placeholder="Enter statement password (e.g. DOB, PAN, Account No)"
                            value={bankPassword}
                            onChange={(e) => setBankPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                            disabled={parsingBank}
                          />
                          <button
                            type="button"
                            onClick={() => setShowBankPassword(!showBankPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
                            title={showBankPassword ? "Hide password" : "Show password"}
                          >
                            {showBankPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBankModalOpen(false);
                        setBankFile(null);
                      }}
                      className="px-5 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      disabled={parsingBank}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!bankFile || parsingBank}
                      className="px-6 py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parsingBank ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Extracting Statement Data...
                        </>
                      ) : (
                        'Extract & View Data'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Top Statement Info Banner & Reconciliation Counters */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bank Statement Info</div>
                        <div className="text-base font-black text-white flex items-center gap-2">
                          {selectedBank || targetBankLedger}
                          {bankParseResult.accountNumber && (
                            <span className="text-xs font-semibold text-slate-400">
                              (A/c: {bankParseResult.accountNumber})
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 rounded-md text-[10px] font-bold">
                            {accountType}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-4 text-right">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Opening Balance</span>
                          <span className="text-xs font-black text-emerald-400">
                            ₹{cleanNum(bankParseResult.openingBalance).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Closing Balance</span>
                          <span className="text-xs font-black text-indigo-400">
                            ₹{cleanNum(bankParseResult.closingBalance).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {bankParseResult?.statementPeriod?.from && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Period</span>
                            <span className="text-xs font-bold text-slate-300">
                              {bankParseResult.statementPeriod.from} to {bankParseResult.statementPeriod.to || 'Present'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reconciliation Statistics Summary Bar */}
                    {(() => {
                      const total = tempTransactions.length;
                      const matched = tempTransactions.filter(t => t.reconStatus === 'MATCHED').length;
                      const amtMismatch = tempTransactions.filter(t => t.reconStatus === 'AMOUNT MISMATCH').length;
                      const ledgerMismatch = tempTransactions.filter(t => t.reconStatus === 'LEDGER MISMATCH').length;
                      const missing = tempTransactions.filter(t => t.reconStatus === 'MISSING VOUCHER').length;
                      const suspense = tempTransactions.filter(t => t.reconStatus === 'SUSPENSE').length;
                      const alterCount = tempTransactions.filter(t => t.action === 'alter').length;
                      const skipCount = tempTransactions.filter(t => t.action === 'skip').length;
                      const createCount = tempTransactions.filter(t => t.action === 'create').length;

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                          <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Items</span>
                            <span className="text-sm font-black text-white font-mono">{total}</span>
                          </div>
                          <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-800/50">
                            <span className="text-[9px] font-bold text-emerald-400 block uppercase">🟢 Matched</span>
                            <span className="text-sm font-black text-emerald-300 font-mono">{matched} <span className="text-[10px] text-emerald-400/80 font-normal">(Skip)</span></span>
                          </div>
                          <div className="bg-amber-950/40 p-2 rounded-xl border border-amber-800/50">
                            <span className="text-[9px] font-bold text-amber-400 block uppercase">🟡 Amt Mismatch</span>
                            <span className="text-sm font-black text-amber-300 font-mono">{amtMismatch} <span className="text-[10px] text-amber-400/80 font-normal">(Alter)</span></span>
                          </div>
                          <div className="bg-orange-950/40 p-2 rounded-xl border border-orange-800/50">
                            <span className="text-[9px] font-bold text-orange-400 block uppercase">🟠 Ledger Mismatch</span>
                            <span className="text-sm font-black text-orange-300 font-mono">{ledgerMismatch} <span className="text-[10px] text-orange-400/80 font-normal">(Alter)</span></span>
                          </div>
                          <div className="bg-blue-950/40 p-2 rounded-xl border border-blue-800/50">
                            <span className="text-[9px] font-bold text-blue-400 block uppercase">🔵 Missing Vch</span>
                            <span className="text-sm font-black text-blue-300 font-mono">{missing} <span className="text-[10px] text-blue-400/80 font-normal">(Create)</span></span>
                          </div>
                          <div className="bg-purple-950/40 p-2 rounded-xl border border-purple-800/50">
                            <span className="text-[9px] font-bold text-purple-400 block uppercase">🟣 Suspense</span>
                            <span className="text-sm font-black text-purple-300 font-mono">{suspense} <span className="text-[10px] text-purple-400/80 font-normal">(Create)</span></span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Target Bank Ledger & Account Type Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300">Target Tally Bank Ledger:</span>
                          <input 
                            type="text"
                            value={targetBankLedger}
                            onChange={(e) => handleApplyBankLedgerToAll(e.target.value)}
                            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300">Account Type:</span>
                          <select
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="Current Account">Current Account (Bank Accounts)</option>
                            <option value="Savings Account">Savings Account (Bank Accounts)</option>
                            <option value="Overdraft Account (OD)">Overdraft Account (Bank OD A/c)</option>
                            <option value="Cash Credit (CC)">Cash Credit (Bank OCC A/c)</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold text-slate-400">
                        Review mappings below. Click <span className="text-amber-400 font-bold">Alter</span> to update existing vouchers or <span className="text-emerald-400 font-bold">Skip</span> to ignore already synced entries.
                      </div>
                    </div>
                  </div>

                  {/* View Mode Switcher: Grouped Party Mapping vs Detailed List */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReconViewMode('grouped')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          reconViewMode === 'grouped'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Grouped Party Mapping ({partyGroups.length} Groups)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReconViewMode('list')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          reconViewMode === 'list'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <ListFilter className="h-3.5 w-3.5" />
                        All Transactions ({tempTransactions.length} Entries)
                      </button>
                    </div>

                    {reconViewMode === 'grouped' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={groupFilterText}
                          onChange={(e) => setGroupFilterText(e.target.value)}
                          placeholder="Search party groups..."
                          className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 w-52 shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* GROUPED PARTY MAPPING VIEW */}
                  {reconViewMode === 'grouped' ? (
                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {partyGroups
                        .filter(g => !groupFilterText || g.representativeName.toLowerCase().includes(groupFilterText.toLowerCase()) || g.distinctVariations.some(v => v.toLowerCase().includes(groupFilterText.toLowerCase())))
                        .map(group => {
                          const isExpanded = expandedGroupKeys.includes(group.groupKey);
                          const isSuspense = !group.mappedLedger || group.mappedLedger === 'Suspense';
                          return (
                            <div key={group.groupKey} className={`rounded-2xl border transition-all ${isSuspense ? 'bg-purple-50/20 border-purple-200' : 'bg-white border-slate-200 shadow-xs'}`}>
                              {/* Group Summary & Mapping Header */}
                              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-sm text-slate-900">{group.representativeName}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                                      {group.transactions.length} transaction{group.transactions.length > 1 ? 's' : ''}
                                    </span>
                                    {group.totalDeposit > 0 && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                        +₹{group.totalDeposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
                                      </span>
                                    )}
                                    {group.totalWithdrawal > 0 && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                        -₹{group.totalWithdrawal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Distinct Variations in statement */}
                                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 pt-0.5">
                                    <span className="font-bold text-slate-400">Variations in Statement:</span>
                                    {group.distinctVariations.map((v, i) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/60 rounded-md text-[10px] font-mono text-slate-700">
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Mapping Control for Entire Group */}
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col gap-1 min-w-[260px]">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Map all {group.transactions.length} to Tally Ledger:</span>
                                    <select
                                      value={group.mappedLedger || 'Suspense'}
                                      onChange={(e) => handleMapEntireGroup(group.indices, e.target.value)}
                                      className={`p-2 w-full bg-slate-50 border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs transition-all ${
                                        isSuspense 
                                          ? 'border-purple-300 text-purple-700 bg-purple-50/50' 
                                          : 'border-emerald-300 text-emerald-900 bg-emerald-50/40'
                                      }`}
                                    >
                                      <option value="Suspense">⚠️ Suspense (Unmapped)</option>
                                      <option value="UPI">⚡ UPI (Consolidated Ledger)</option>
                                      {tallyLedgers.map(l => (
                                        <option key={l._id} value={l.partyName}>{l.partyName} ({l.parentGroup})</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Quick Action Buttons for Group */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSetGroupAction(group.indices, 'create')}
                                      className="px-2 py-1.5 text-[10px] font-black rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                                      title="Set CREATE for all entries in group"
                                    >
                                      CREATE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetGroupAction(group.indices, 'skip')}
                                      className="px-2 py-1.5 text-[10px] font-black rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                                      title="Set SKIP for all entries in group"
                                    >
                                      SKIP
                                    </button>
                                  </div>

                                  {/* Expand/Collapse details */}
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupExpand(group.groupKey)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                                    title={isExpanded ? "Collapse entries" : "View all entries in group"}
                                  >
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>

                              {/* Expandable Transactions for this Group */}
                              {isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/70 p-3 rounded-b-2xl">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 pb-1">
                                        <th className="pb-1.5 w-24">Date</th>
                                        <th className="pb-1.5">Narration / Counterparty Details</th>
                                        <th className="pb-1.5 text-right w-28">Amount</th>
                                        <th className="pb-1.5 text-center w-24">Tally Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50">
                                      {group.transactions.map((txn, subIdx) => {
                                        const globalIdx = group.indices[subIdx];
                                        const typeLower = (txn.type || '').toLowerCase();
                                        const isDep = typeLower === 'receipt' || (typeLower === 'contra' && !txn.isWithdrawal);
                                        const amt = Math.abs(cleanNum(txn.totalAmount));
                                        return (
                                          <tr key={subIdx} className="hover:bg-white/80 transition-colors">
                                            <td className="py-2 font-mono text-slate-600">{txn.date}</td>
                                            <td className="py-2 text-slate-700">
                                              <span className="font-semibold text-slate-900">{txn.bankPartyName || txn.partyName}</span>
                                              {txn.notes && <span className="text-slate-500 ml-1.5 font-mono text-[11px]">— {txn.notes}</span>}
                                            </td>
                                            <td className={`py-2 text-right font-mono font-bold ${isDep ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {isDep ? '+' : '-'}₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2 text-center">
                                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                txn.action === 'create' ? 'bg-blue-100 text-blue-800' : (txn.action === 'alter' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700')
                                              }`}>
                                                {txn.action || 'create'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    /* DETAILED TRANSACTIONS LIST VIEW */
                    <div className="space-y-3">
                      {/* Bulk mapping and bulk action bar */}
                      {selectedTxnIndices.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200 shadow-sm animate-fade-in">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-900">
                              Selected {selectedTxnIndices.length} transaction(s):
                            </span>
                            <select
                              value={bulkTargetLedger}
                              onChange={(e) => setBulkTargetLedger(e.target.value)}
                              className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
                            >
                              <option value="">-- Map Target Ledger --</option>
                              <option value="Suspense">⚠️ Suspense (Unmapped)</option>
                              <option value="UPI">⚡ UPI (Consolidated Ledger)</option>
                              {tallyLedgers.map(l => (
                                <option key={l._id} value={l.partyName}>{l.partyName} ({l.parentGroup})</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleBulkMapLedger}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                              disabled={!bulkTargetLedger}
                            >
                              Apply Map
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">Set Action:</span>
                            <button
                              type="button"
                              onClick={() => handleBulkSetAction('create')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              CREATE
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSetAction('alter')}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              ALTER
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSetAction('skip')}
                              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              SKIP
                            </button>
                          </div>
                        </div>
                      )}

                      {/* High Density Statement Transactions Table */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                              <tr>
                                <th className="p-3 w-10 text-center">
                                  <input 
                                    type="checkbox"
                                    checked={tempTransactions.length > 0 && selectedTxnIndices.length === tempTransactions.length}
                                    onChange={handleHeaderCheckboxChange}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </th>
                                <th className="p-3 w-24">Date</th>
                                <th className="p-3 w-48">Reconciliation Status</th>
                                <th className="p-3">Particulars & Mapping</th>
                                <th className="p-3 text-right w-28">Amount</th>
                                <th className="p-3 text-center w-36">Tally Action</th>
                                <th className="p-3 text-center w-16">Row</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {tempTransactions.map((txn: any, idx: number) => {
                                const amt = cleanNum(txn.totalAmount);
                                const typeLower = (txn.type || '').toLowerCase();
                                let isDeposit = typeLower === 'receipt';
                                let isWithdrawal = typeLower === 'payment';
                                if (typeLower === 'contra') {
                                  if ((txn.notes || '').toLowerCase().includes('deposit') || (txn.partyName || '').toLowerCase().includes('deposit')) {
                                    isDeposit = true;
                                  } else {
                                    isWithdrawal = true;
                                  }
                                }

                                const isEditing = editingTxnIdx === idx;
                                const status = txn.reconStatus || 'SUSPENSE';
                                const action = txn.action || 'create';

                                // Status badge colors
                                let statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                                let statusLabel = '🟣 SUSPENSE';
                                if (status === 'MATCHED') {
                                  statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  statusLabel = '🟢 MATCHED';
                                } else if (status === 'AMOUNT MISMATCH') {
                                  statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-300';
                                  statusLabel = '🟡 AMOUNT MISMATCH';
                                } else if (status === 'LEDGER MISMATCH') {
                                  statusBadgeClass = 'bg-orange-50 text-orange-800 border-orange-300';
                                  statusLabel = '🟠 LEDGER MISMATCH';
                                } else if (status === 'MISSING VOUCHER') {
                                  statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                                  statusLabel = '🔵 MISSING VOUCHER';
                                }

                                return (
                                  <tr key={idx} className={isEditing ? "bg-indigo-50/50" : (selectedTxnIndices.includes(idx) ? "bg-indigo-50/15" : "hover:bg-slate-50/80 transition-colors")}>
                                    {/* Checkbox */}
                                    <td className="p-3 text-center align-top pt-3.5">
                                      <input 
                                        type="checkbox"
                                        checked={selectedTxnIndices.includes(idx)}
                                        onChange={() => handleRowCheckboxToggle(idx)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                                      />
                                    </td>
                                    
                                    {/* Date */}
                                    <td className="p-3 align-top whitespace-nowrap font-mono text-slate-600 pt-3.5">
                                      {isEditing ? (
                                        <input 
                                          type="date"
                                          value={txn.date}
                                          onChange={(e) => updateTempTxn(idx, 'date', e.target.value)}
                                          className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                                        />
                                      ) : (
                                        txn.date
                                      )}
                                    </td>

                                    {/* Reconciliation Status Column */}
                                    <td className="p-3 align-top pt-3.5">
                                      <div className="space-y-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border ${statusBadgeClass}`}>
                                          {statusLabel}
                                        </span>
                                        {txn.diffDetail && (
                                          <div className="text-[10px] font-bold text-slate-600 leading-tight">
                                            {txn.diffDetail}
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* Particulars & Ledger Mapping */}
                                    <td className="p-3 align-top">
                                      {isEditing ? (
                                        <div className="space-y-1">
                                          <input 
                                            type="text"
                                            value={txn.partyName}
                                            onChange={(e) => updateTempTxn(idx, 'partyName', e.target.value)}
                                            placeholder="Party Ledger Name"
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                                          />
                                          <input 
                                            type="text"
                                            value={txn.notes}
                                            onChange={(e) => updateTempTxn(idx, 'notes', e.target.value)}
                                            placeholder="Narration details..."
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] text-slate-600"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5 max-w-sm">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Map to:</span>
                                            <select
                                              value={txn.partyName || 'Suspense'}
                                              onChange={(e) => updatePartyMapping(idx, e.target.value)}
                                              className={`p-1 w-full bg-slate-50 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all cursor-pointer ${
                                                txn.partyName === 'Suspense' 
                                                  ? 'border-purple-300 text-purple-700 font-black bg-purple-50/40' 
                                                  : 'border-slate-200 text-slate-900'
                                              }`}
                                            >
                                              <option value="Suspense">⚠️ Suspense (Unmapped)</option>
                                              <option value="UPI">⚡ UPI (Consolidated Ledger)</option>
                                              {tallyLedgers.map(l => (
                                                <option key={l._id} value={l.partyName}>{l.partyName} ({l.parentGroup})</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-normal leading-tight">
                                            <span className="font-semibold text-slate-700">{txn.bankPartyName || txn.partyName}</span> {txn.notes && `— ${txn.notes}`}
                                          </div>
                                        </div>
                                      )}
                                    </td>

                                    {/* Amount Column */}
                                    <td className="p-3 align-top text-right font-mono font-bold whitespace-nowrap pt-3.5">
                                      {isEditing ? (
                                        <div className="space-y-1">
                                          <select
                                            value={txn.type}
                                            onChange={(e) => updateTempTxn(idx, 'type', e.target.value)}
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] font-bold uppercase"
                                          >
                                            <option value="receipt">Receipt (Cr)</option>
                                            <option value="payment">Payment (Dr)</option>
                                            <option value="contra">Contra</option>
                                          </select>
                                          <input 
                                            type="number"
                                            value={txn.totalAmount}
                                            onChange={(e) => updateTempTxn(idx, 'totalAmount', parseFloat(e.target.value) || 0)}
                                            className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-right"
                                          />
                                        </div>
                                      ) : isDeposit ? (
                                        <div className="text-emerald-600">
                                          +₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          <span className="block text-[9px] font-bold uppercase text-emerald-400">Receipt</span>
                                        </div>
                                      ) : (
                                        <div className="text-rose-600">
                                          -₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          <span className="block text-[9px] font-bold uppercase text-rose-400">Payment</span>
                                        </div>
                                      )}
                                    </td>

                                    {/* Tally Action Column */}
                                    <td className="p-3 align-top text-center whitespace-nowrap pt-3.5">
                                      <div className="inline-flex rounded-lg shadow-xs border border-slate-200 overflow-hidden bg-slate-50 p-0.5">
                                        <button
                                          type="button"
                                          onClick={() => updateRowAction(idx, 'create')}
                                          className={`px-2 py-1 text-[10px] font-black rounded-md transition-all ${
                                            action === 'create' 
                                              ? 'bg-blue-600 text-white shadow-xs' 
                                              : 'text-slate-500 hover:text-slate-900'
                                          }`}
                                          title="Create new Receipt/Payment voucher in Tally"
                                        >
                                          CREATE
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateRowAction(idx, 'alter')}
                                          className={`px-2 py-1 text-[10px] font-black rounded-md transition-all ${
                                            action === 'alter' 
                                              ? 'bg-amber-600 text-white shadow-xs' 
                                              : 'text-slate-500 hover:text-slate-900'
                                          }`}
                                          title="Alter/Update existing voucher in Tally"
                                        >
                                          ALTER
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateRowAction(idx, 'skip')}
                                          className={`px-2 py-1 text-[10px] font-black rounded-md transition-all ${
                                            action === 'skip' 
                                              ? 'bg-slate-700 text-white shadow-xs' 
                                              : 'text-slate-500 hover:text-slate-900'
                                          }`}
                                          title="Skip syncing to Tally (already exists)"
                                        >
                                          SKIP
                                        </button>
                                      </div>
                                    </td>

                                    {/* Row Controls */}
                                    <td className="p-3 align-top text-center whitespace-nowrap pt-3.5">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setEditingTxnIdx(isEditing ? null : idx)}
                                          className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                          title={isEditing ? "Save Row" : "Edit Row"}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeTempTxn(idx)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                          title="Delete Row"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sync to Tally Footer Action Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBankModalOpen(false);
                        setBankFile(null);
                        setBankParseResult(null);
                        setTempTransactions([]);
                      }}
                      className="px-5 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      disabled={syncSaving}
                    >
                      Discard Statement
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndSyncBank}
                      disabled={syncSaving || tempTransactions.length === 0}
                      className="px-8 py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {syncSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Syncing Reconciled Vouchers to Tally...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Confirm & Sync to Tally ({tempTransactions.filter(t => t.action !== 'skip').length} to post, {tempTransactions.filter(t => t.action === 'skip').length} skipped)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} />
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