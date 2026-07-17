import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  stock: { type: Number, default: 0 },
  status: { type: String, enum: ['In Stock', 'Out of Stock'], default: 'In Stock' },
  rate: { type: Number, default: 0 },
  gst: { type: Number, default: 18 },
  unit: { type: String, default: 'pcs' },
  sku: { type: String, default: '' },
  images: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure item name is unique per company
itemSchema.index({ companyName: 1, name: 1 }, { unique: true });

const Item = mongoose.model('Item', itemSchema);
export default Item;
