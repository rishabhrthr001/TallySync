import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  companyName: { type: String, default: '' },
  gstin: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  inventorySyncStatus: { type: String, enum: ['idle', 'pending', 'syncing', 'success', 'failed'], default: 'idle' },
  inventorySyncError: { type: String, default: '' },
  lastInventorySync: { type: Date, default: null },
  ledgerSyncStatus: { type: String, enum: ['idle', 'pending', 'syncing', 'success', 'failed'], default: 'idle' },
  ledgerSyncError: { type: String, default: '' },
  lastLedgerSync: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
export default User;
