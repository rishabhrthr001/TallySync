import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  partyName: { type: String, required: true },
  voucherNumber: { type: String, required: true },
  voucherType: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  amount: { type: Number, required: true }, // Net amount (positive/negative)
  narration: { type: String, default: '' },
  reference: { type: String, default: '' },
  guid: { type: String, unique: true, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index on companyName and partyName for quick retrieval
voucherSchema.index({ companyName: 1, partyName: 1 });

const Voucher = mongoose.model('Voucher', voucherSchema);
export default Voucher;
