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

    callCount: { type: Number, default: 0 },
    lastCallAt: { type: Date },

    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

distributorSchema.index({ assignedTo: 1, createdAt: -1 });

module.exports =
  mongoose.models.Distributor || mongoose.model('Distributor', distributorSchema);
