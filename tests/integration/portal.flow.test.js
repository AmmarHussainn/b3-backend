import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startDb, stopDb, seedBasics, app, hubspot } from '../helpers.js';

let api, ids, M;
const grant = { action: 'grant', email: 'client@example.com', first_name: 'Casey', last_name: 'Client', company: 'Acme', tier: 'b3 Growth Lab', hubspot_contact_id: '101' };

beforeAll(async () => {
  await startDb();
  ids = await seedBasics();
  api = await app();
  M = await import('../../src/db/models/index.js');
});
afterAll(stopDb);

describe('HubSpot -> portal provisioning', () => {
  it('rejects unauthenticated webhooks', async () => { expect((await api.post('/v1/integrations/hubspot').send(grant)).status).toBe(401); });

  it('grants access, writes tier tag, sends exactly one welcome', async () => {
    const r = await hubspot(api, grant);
    expect(r.status).toBe(202);
    const u = await M.User.findOne({ email: 'client@example.com' });
    expect(u.status).toBe('active');
    expect(u.tags).toEqual(expect.arrayContaining(['portal-access-active', 'tier-growth-lab']));
    expect(u.welcomeEmailSentAt).toBeTruthy();
    expect(await M.AuditLog.countDocuments({ action: 'email.welcome' })).toBe(1);
  });

  it('a duplicate handoff creates no second account and no second welcome email', async () => {
    const r = await hubspot(api, grant);
    expect(r.body.data.duplicate).toBe(true);
    expect(await M.User.countDocuments({ email: 'client@example.com' })).toBe(1);
    expect(await M.AuditLog.countDocuments({ action: 'email.welcome' })).toBe(1);
  });

  it('a deliberately failed handoff is recorded as failed', async () => {
    await hubspot(api, { ...grant, email: 'bad@example.com', tier: 'Platinum Plan' });
    const ev = await M.HubspotEvent.findOne({ email: 'bad@example.com' });
    expect(ev.status).toBe('failed');
    expect(ev.error).toMatch(/tier/i);
  });
});

describe('member auth + content access + revocation', () => {
  let access;
  it('cannot log in before choosing a password', async () => {
    const r = await api.post('/v1/member/auth/login').send({ email: 'client@example.com', password: 'whatever123' });
    expect(r.body.error.code).toBe('PASSWORD_NOT_SET');
  });
  it('invite link sets the password and signs in; link is single-use', async () => {
    const { issueInvite } = await import('../../src/services/token.service.js');
    const u = await M.User.findOne({ email: 'client@example.com' });
    const token = await issueInvite(u._id, 'member');
    const weak = await api.post('/v1/member/auth/set-password').send({ token, password: 'short' });
    expect(weak.status).toBe(422); // policy failure does not burn the link
    const r = await api.post('/v1/member/auth/set-password').send({ token, password: 'a-long-password-1' });
    expect(r.status).toBe(200);
    access = r.body.data.accessToken;
    expect((await api.post('/v1/member/auth/set-password').send({ token, password: 'a-long-password-1' })).body.error.code).toBe('LINK_EXPIRED');
  });
  it('requires a token for content', async () => { expect((await api.get('/v1/member/training')).status).toBe(401); });

  it('serves entitled content, hides drafts and products outside the offer', async () => {
    const cat = await M.Category.create({ productId: ids['growth-system-training-core'], kind: 'course', title: 'Course 1 - The Basics', slug: 'course-1-the-basics', courseNumber: 1, status: 'live' });
    const live = await M.Lesson.create({ productId: ids['growth-system-training-core'], categoryId: cat._id, title: '00 - Welcome to this course', slug: '00-welcome-to-this-course', number: 0, status: 'live' });
    await M.Lesson.create({ productId: ids['growth-system-training-core'], categoryId: cat._id, title: '01 - Reading your numbers weekly', slug: '01-reading-your-numbers-weekly', number: 1, status: 'draft' });
    const hidden = await M.Product.create({ key: 'not-in-any-offer', title: 'Hidden', presentation: 'course_library', status: 'live' });
    const hcat = await M.Category.create({ productId: hidden._id, kind: 'course', title: 'Course 2 - Secret', slug: 'course-2-secret', courseNumber: 2, status: 'live' });
    const hl = await M.Lesson.create({ productId: hidden._id, categoryId: hcat._id, title: '01 - Secret', slug: '01-secret', number: 1, status: 'live' });

    const lib = await api.get('/v1/member/training').set('authorization', `Bearer ${access}`);
    expect(lib.body.data.courses.map((c) => c.slug)).toEqual(['course-1-the-basics']);
    expect(lib.body.data.courses[0].lessonCount).toBe(0); // the draft is not counted
    expect(JSON.stringify(lib.body)).not.toMatch(/sessionDate|createdAt/); // training carries no dates
    expect((await api.get(`/v1/member/lessons/${live._id}`).set('authorization', `Bearer ${access}`)).status).toBe(200);
    expect((await api.get(`/v1/member/lessons/${hl._id}`).set('authorization', `Bearer ${access}`)).status).toBe(404);
    const done = await api.post(`/v1/member/progress/lessons/${live._id}/complete`).set('authorization', `Bearer ${access}`);
    expect(done.body.data.completed).toBe(true);
  });

  it('revokes via HubSpot: sessions die, login shows the access-ended message, account + progress remain', async () => {
    const r = await hubspot(api, { action: 'revoke', email: 'client@example.com', hubspot_contact_id: '101', access: 'Removed' });
    expect(r.status).toBe(202);
    const u = await M.User.findOne({ email: 'client@example.com' });
    expect(u.status).toBe('removed');
    expect(u.tags).not.toContain('portal-access-active');
    expect((await api.get('/v1/member/training').set('authorization', `Bearer ${access}`)).status).toBe(401);
    const login = await api.post('/v1/member/auth/login').send({ email: 'client@example.com', password: 'a-long-password-1' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCESS_ENDED');
    expect(login.body.error.details.supportEmail).toBeTruthy();
    expect(await M.Progress.countDocuments({ userId: u._id })).toBe(1);
  });
});
