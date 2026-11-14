const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    noteDate: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
