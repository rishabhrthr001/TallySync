import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  isSuperAdmin: { type: Boolean, default: false },
  companyName: { type: String, default: '' },
  gstin: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  plainPassword: { type: String, default: '' },
  subscription: {
    plan: { type: String, enum: ['free', 'trial', 'pro'], default: 'free' },
    trialStartDate: { type: Date, default: null },
    trialEndDate: { type: Date, default: null },
    proStartDate: { type: Date, default: null },
    proEndDate: { type: Date, default: null },
    hasClaimedTrial: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'expired'], default: 'active' }
  },
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
