const mongoose = require('mongoose');

// A standalone distributor record. These are existing distributors a rep already
// works with — their data does NOT come from the lead pipeline. Reps add them and
// log every call/interaction (incoming or outgoing) with a reason.
const distributorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // If this distributor was auto-created from a converted lead, link back to
    // that lead (so we never create a duplicate distributor for the same lead).
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    fromLead: { type: Boolean, default: false },

    callCount: { type: Number, default: 0 },
    lastCallAt: { type: Date },
    // Running total of all order amounts placed by this distributor.
    totalOrderValue: { type: Number, default: 0 },
    // Distributor follow-up pipeline — SEPARATE from leads.
    nextFollowUpDate: { type: Date, index: true },
    followUpCount: { type: Number, default: 0 },

    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

distributorSchema.index({ assignedTo: 1, createdAt: -1 });

module.exports =
  mongoose.models.Distributor || mongoose.model('Distributor', distributorSchema);
