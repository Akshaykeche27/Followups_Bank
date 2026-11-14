const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    outcome: { type: String, enum: ['Pending', 'Recovered'], required: true },
    remark: { type: String, trim: true, default: '', maxlength: 2000 },
    followedAt: { type: Date, default: Date.now, index: true },
    nextFollowUpAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FollowUp', followUpSchema);
