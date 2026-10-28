import mongoose from 'mongoose';

// key/value: supportEmail, slackUrl, facebookGroupUrl, bookingLinks, accessEndedMessage ...
const schema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, value: mongoose.Schema.Types.Mixed }, { timestamps: true });

export const Setting = mongoose.models.Setting || mongoose.model('Setting', schema);
