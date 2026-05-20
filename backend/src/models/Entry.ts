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
  type: { type: String, enum: ['sales', 'purchase'], required: true },
  partyName: { type: String, required: true },
  partyGstin: { type: String, default: '' },
  invoiceNumber: { type: String, required: true },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  items: [lineItemSchema],
  taxableAmount: { type: Number, required: true },
  taxAmount: { type: Number, default: 18 }, // Default 18% or specific amount
  totalAmount: { type: Number, required: true },
  gstType: { type: String, enum: ['cgst-sgst', 'igst'], default: 'cgst-sgst' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  idempotencyKey: { type: String, unique: true },
  notes: { type: String, default: '' },
  transporterDetails: {
    vehicleNumber: String,
    transporterName: String
  },
  syncError: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Entry = mongoose.model('Entry', entrySchema);
export default Entry;
