const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    mobile: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9+()\-\s]{8,18}$/, 'Enter a valid mobile number']
    },
    location: { type: String, trim: true, default: '', maxlength: 120 },
    repaymentCategory: {
      type: String,
      required: true,
      enum: ['Standard Regular', 'SMA 0', 'SMA 1', 'SMA 2', 'NPA'],
      default: 'Standard Regular'
    },
    // Free text so you can use List 1, List 2, or your own list name.
    groupName: { type: String, required: true, trim: true, default: 'List 1', maxlength: 60 },
    status: { type: String, enum: ['Pending', 'Recovered'], default: 'Pending' },
    lastRemark: { type: String, trim: true, default: '', maxlength: 2000 },
    lastContactedAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
