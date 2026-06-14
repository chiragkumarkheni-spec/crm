const mongoose = require('mongoose');

// Outcomes an employee can record. `converted` ends the inquiry.
const LEAD_STATUSES = [
  'new', // freshly added, not yet worked
  'in_progress', // talking / interested, ongoing follow-ups
  'no_pickup', // did not pick up the call
  'high_rate', // says our rate is too high
  'no_capacity', // no capacity to work with us (sell/retail volume)
  'retail_enquiry', // only a retail enquiry, not distributor material
  'converted', // converted to distributor — END of inquiry
  'lost', // dropped / not interested
];

const INDIAN_STATES = undefined; // free text for now; validated on the client

const leadSchema = new mongoose.Schema(
  {
    // --- Core lead detail (matches an IndiaMart enquiry) ---
    name: {
      type: String,
      required: [true, 'Buyer name is required'],
      trim: true,
    }, // buyer / contact person name
    companyName: { type: String, trim: true }, // firm / company name
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },

    // --- What the lead enquired about (the IndiaMart requirement) ---
    product: { type: String, trim: true }, // product the buyer wants
    quantity: { type: String, trim: true }, // e.g. "200 Litre" (free text + unit)
    requirement: { type: String, trim: true }, // the enquiry / requirement message
    source: { type: String, trim: true, default: 'IndiaMart' }, // where the lead came from

    // --- Ownership ---
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The business "lead date" — set to the creation day, never back-dated.
    leadDate: { type: Date, required: true },

    // --- Pipeline state ---
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    nextFollowUpDate: { type: Date, index: true },
    followUpCount: { type: Number, default: 0 },
    lastFollowUpAt: { type: Date },

    // --- One-time catalogue / sample tracking ---
    catalogue: {
      sent: { type: Boolean, default: false },
      date: { type: Date },
    },
    sample: {
      sent: { type: Boolean, default: false },
      date: { type: Date },
      description: { type: String, trim: true }, // what sample was sent
    },
    // A sample the lead *requested* (recorded as lead detail).
    sampleRequest: {
      requested: { type: Boolean, default: false },
      description: { type: String, trim: true },
      date: { type: Date },
    },

    // --- One-time automated WhatsApp (sent on the 2nd follow-up) ---
    whatsApp: {
      sent: { type: Boolean, default: false },
      date: { type: Date },
      messageId: { type: String },
    },

    // --- Conversion ---
    convertedAt: { type: Date },
    order: {
      value: { type: Number, default: 0 }, // order amount in money
      currency: { type: String, default: 'INR' },
      note: { type: String, trim: true },
    },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

leadSchema.index({ assignedTo: 1, nextFollowUpDate: 1 });
leadSchema.index({ createdBy: 1, leadDate: 1 });

leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports =
  mongoose.models.Lead || mongoose.model('Lead', leadSchema);
module.exports.LEAD_STATUSES = LEAD_STATUSES;
