const mongoose = require('mongoose');

// Each call / follow-up event against a lead. Every follow-up records the
// outcome and the "development" (what progressed) so we keep full history.
const followUpSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The day this follow-up/call happened (set to today, not back-dated).
    date: { type: Date, required: true, index: true },

    // Outcome of this call — same vocabulary as Lead.status.
    outcome: {
      type: String,
      enum: [
        'in_progress',
        'no_pickup',
        'high_rate',
        'no_capacity',
        'retail_enquiry',
        'converted',
        'lost',
      ],
      required: true,
    },

    // The development that occurred on this follow-up (free text, required).
    development: { type: String, required: true, trim: true },

    // What got scheduled next from this call.
    nextFollowUpDate: { type: Date },

    // Order value captured if this follow-up converted the lead.
    orderValue: { type: Number },

    // Snapshot of actions taken on this call (for richer reporting).
    catalogueSent: { type: Boolean, default: false },
    sampleSent: { type: Boolean, default: false },
    whatsAppSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

followUpSchema.index({ employee: 1, date: 1 });

module.exports =
  mongoose.models.FollowUp || mongoose.model('FollowUp', followUpSchema);
