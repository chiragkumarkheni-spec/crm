const mongoose = require('mongoose');

// A call / interaction with an existing distributor (a standalone record — these
// distributors are NOT leads and their data does not live in the lead pipeline).
const CATEGORIES = [
  'new_order',
  'payment',
  'marketing',
  'complaint',
  'rate',
  'product_info',
  'general', // gappa / casual talk
  'other',
];

const distributorCallSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      required: true,
      index: true,
    },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    direction: { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
    note: { type: String, trim: true },
    // Order amount the distributor placed during this call (0 if none).
    orderValue: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

distributorCallSchema.index({ distributor: 1, date: -1 });
distributorCallSchema.statics.CATEGORIES = CATEGORIES;

module.exports =
  mongoose.models.DistributorCall ||
  mongoose.model('DistributorCall', distributorCallSchema);
module.exports.CATEGORIES = CATEGORIES;
