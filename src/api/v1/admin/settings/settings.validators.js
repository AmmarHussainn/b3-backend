import { z } from 'zod';
const url = z.union([z.literal(''), z.string().url().max(500)]);
export const SCHEMAS = {
  supportEmail: z.string().email().max(254),
  slackUrl: url,
  facebookGroupUrl: url,
  bookingLinks: z.array(z.object({ label: z.string().trim().min(1).max(100), url: z.string().url().max(500) })).max(20),
  accessEndedMessage: z.string().trim().min(10).max(1000),
  sendAccessEndedEmail: z.boolean(),
};
export const keyParams = z.object({ key: z.enum(Object.keys(SCHEMAS)) });
export const body = z.object({ value: z.any() });
