import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true }
});

const entrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  type: { type: String, enum: ['sales', 'purchase', 'payment', 'receipt', 'contra', 'journal'], required: true },
  partyName: { type: String, default: '' },
  partyGstin: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  items: { type: [lineItemSchema], default: [] },
  taxableAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  gstType: { type: String, enum: ['cgst-sgst', 'igst'], default: 'cgst-sgst' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  bankLedger: { type: String, default: '' },
  accountType: { type: String, default: 'Current Account' },
  partyGuid: { type: String, default: '' },
  tallyGuid: { type: String, default: '' },
  action: { type: String, enum: ['create', 'alter', 'skip'], default: 'create' },
  reconStatus: { type: String, default: '' },
  bankPartyName: { type: String, default: '' },
  bankNarration: { type: String, default: '' },
  confidence: { type: Number, default: 1.0 },
  reason: { type: String, default: '' },
  idempotencyKey: { type: String, default: null },
  notes: { type: String, default: '' },
  transporterDetails: {
    vehicleNumber: String,
    transporterName: String
  },
  syncError: { type: String, default: '' },
  printed: { type: Boolean, default: false },
  printedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

entrySchema.index({ companyName: 1, idempotencyKey: 1 }, { sparse: true, unique: true });

const Entry = mongoose.model('Entry', entrySchema);
export default Entry;
