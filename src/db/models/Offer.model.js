import mongoose from 'mongoose';

// offer = named bundle of products, granted by tags. Launch: ONE client offer holding everything.
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "portal-all-access"
    title: { type: String, required: true }, // "b3 Portal - All Access"
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    grantedByTags: { type: [String], default: [], index: true },
    includesUnpublished: { type: Boolean, default: false }, // true only for the Staff offer
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Offer = mongoose.models.Offer || mongoose.model('Offer', schema);
