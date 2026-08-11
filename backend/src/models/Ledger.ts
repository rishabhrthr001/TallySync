import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  partyName: { type: String, required: true },
  gstin: { type: String, default: '' },
  balance: { type: Number, default: 0 }, // Positive means receivable (Dr), negative means payable (Cr)
  openingBalance: { type: Number, default: 0 },
  closingBalance: { type: Number, default: 0 },
  debitTotal: { type: Number, default: 0 },
  creditTotal: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

ledgerSchema.index({ companyName: 1, partyName: 1 }, { unique: true });

const Ledger = mongoose.model('Ledger', ledgerSchema);
export default Ledger;
