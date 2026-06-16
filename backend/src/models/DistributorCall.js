const mongoose = require('mongoose');

// A call / interaction with an EXISTING distributor (a lead that already
// converted). This is separate from the lead follow-up pipeline so distributor
// servicing work and lead-chasing work never get mixed up.
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
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    direction: { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
    note: { type: String, trim: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

distributorCallSchema.index({ lead: 1, date: -1 });
distributorCallSchema.statics.CATEGORIES = CATEGORIES;

module.exports =
  mongoose.models.DistributorCall ||
  mongoose.model('DistributorCall', distributorCallSchema);
module.exports.CATEGORIES = CATEGORIES;
