# b3 Growth Portal: Backend Build Guide

Covers the backend milestones (auth, entitlements, HubSpot provisioning, email, Bunny video and files, content admin, member content, search and progress, admin operations) built against the Business Requirements, the Technical Build Scope and your STRUCTURE.md.

**Read section 1 first.** Several things must be true before the code will start.

---

## 1. Honest status

| Item | State |
|---|---|
| Code written | All 115 routes (34 member, 79 admin, 2 integrations), services, jobs, integrations, seeds, scripts. This includes the five endpoints that were added in a later patch (see section 4.2: dashboard activity, container delete, course list, admin download URL, completions report) |
| Static check | Passed: all 166 files parse, 459 relative imports resolve, every named import exists |
| Run against real MongoDB / HubSpot / Bunny | **Not done.** The sandbox I built this in has no network, so I could not `npm install` or start the server |
| Tests | Written (unit + one integration flow) but **not executed**. Run `npm test` first |
| Files I could not see | `middleware/*`, `utils/*`, `entitlement.service.js`, `jobs/queue.js`, route index files were not uploaded, so I wrote them all. Yours are listed in the section 2 table as "kept" |

The five late-added endpoints have no automated tests yet (see section 11). Expect a small number of runtime fixes on the first boot (typos or a package version). Everything is plain JavaScript with no build step, so they will be quick.

---

## 2. What to paste where

Everything is in `b3-portal-api.zip` with the same paths as your project. **Unzip over your project root.** This version of the zip and this guide already include the five late-added endpoints. If you pasted those in by hand from `B3_5_MISSING_ENDPOINTS.md`, you do not need to do anything more.

### Replace these (they existed and I changed them)

| File | Change |
|---|---|
| `package.json` | **`"type": "module"`** (your code uses `import`, but your package.json said `commonjs`: nothing would have started), scripts, all dependencies |
| `src/config/env.js` | Your file plus 5 new optional variables: `LOG_LEVEL`, `RUN_JOBS`, `RECONCILE_ENABLED`, `UPLOAD_MAX_MB`, `BUNNY_STREAM_CDN_HOSTNAME` |
| `src/db/models/Lesson.model.js` | **One added line:** `pendingBunnyVideoId: String` (lets a video be replaced while the old one keeps playing) |

### Kept exactly as you wrote them

`src/config/constants.js`, all other models in `src/db/models/`, `src/db/models/index.js`, and your three route index files: `api/v1/member/index.js`, `api/v1/admin/index.js`, `api/v1/integrations/index.js`. The zip contains copies so the project is complete; they are byte-identical.

### New: grouped by folder

| Folder | What is in it |
|---|---|
| `src/utils/` | `ApiError, response, asyncHandler, crypto, jwt, password, logger, pagination, slug, dates, zodHelpers, csv, naming` |
| `src/config/cors.js`, `src/db/connection.js` | CORS (the two frontends only) and Mongo connect/health |
| `src/middleware/` | `requestId, notFound, errorHandler, validate, rateLimit, auditLog, requireRole, authMember, authAdmin, loadEntitlements, hubspotAuth, bunnyWebhookAuth` |
| `src/services/` | `auth, token, entitlement, email, audit, settings, provisioning, reconcile, bulk, client, sync, content, progress, lesson, replay, training, video, resource, team, structure, report, dashboard` |
| `src/integrations/bunny/` | `http, stream.client, storage.client, webhook.handler` |
| `src/integrations/hubspot/` | `properties, client, events, writeback` |
| `src/integrations/email/` | `provider.js` + `templates/welcome.html, reset.html, access-ended.html` |
| `src/jobs/` | `queue, scheduler, reconcile.job, cleanup.job, workers/{provision,writeback,index}` |
| `src/api/v1/{member,admin,integrations}/<feature>/` | `*.routes.js`, `*.controller.js`, `*.validators.js` per feature (the admin `dashboard` feature gained a `dashboard.validators.js`) |
| `src/api/v1/index.js`, `src/app.js`, `src/server.js` | Wiring. If you already had working `app.js`/`server.js`, diff them: mine adds raw-body capture (HubSpot signatures), the worker start and graceful shutdown |
| `src/db/seeds/` | `seed.js`, `data/products.js`, `data/offers.js` (idempotent) |
| `scripts/` | `generate-keys.js, create-owner.js, bulk-provision.js` |
| `tests/` | Unit tests, one integration flow, `setup.js`, `helpers.js`; `vitest.config.js` in the root |

### First-run steps

```bash
npm install
cp .env.example .env            # fill CLIENT_URL, ADMIN_URL, MONGODB_URI
npm run keys                    # paste the 4 JWT lines into .env
npm run seed                    # products + offers + settings (add -- --with-advanced for the 2nd training container)
npm run create-owner -- --email kristi@consultb3.com --first Kristi --last Stanbery-Bedgood --password 'Use-a-long-one-1'
npm test                        # needs internet the first time (downloads an in-memory MongoDB)
npm run dev                     # http://localhost:4000/health
```

With no `REDIS_URL` the queue runs in-process (fine for development). With no email key, emails are printed to the log instead of sent. With no HubSpot or Bunny keys, those calls fail with a clear `UPSTREAM_ERROR` or skip.

---

## 3. How it fits together

### The access chain (Technical Build Scope section 5)

```
HubSpot b3_portal_access = Active
  -> POST /v1/integrations/hubspot            (authenticated, stored, de-duplicated, queued, 202 in milliseconds)
  -> provision worker (5 attempts, exponential backoff)
  -> User upserted by email, tags written: portal-access-active + tier-*
  -> entitlement.service: tags -> offers.grantedByTags -> product ids
  -> content queries all filtered by those product ids
  -> write-back job sets b3_portal_sync_status / message / dates in HubSpot
```

- **Nothing in the code mentions a tier name for permissions.** Tier tags are written but grant nothing until an Offer lists them. `tests/unit/entitlement.test.js` proves tiering later is a data change: remove a container from the base offer, add a tier offer, no code touched.
- Members see **404, not 403**, for content outside their offers. That avoids confirming that hidden content exists.
- Every request re-reads the user from the database, so Removed/Suspended takes effect on the next request, not when the token expires.

### Layering (as in STRUCTURE.md)

`routes -> validators (zod) -> controller -> service -> models / integrations`. Controllers contain no business logic. Only services and integrations talk to Mongo, HubSpot, Bunny or email. (One small controller, `me.controller.js`, reads a model directly: easy to move into a service.)

### Response and error envelope

```json
{ "data": ..., "meta": { "page": 1, "limit": 25, "total": 80, "totalPages": 4 } }
{ "error": { "code": "ACCESS_ENDED", "message": "…", "details": {…}, "requestId": "…" } }
```

Error codes come from your `ERROR_CODES`. HTTP mapping: `BAD_REQUEST 400`, `VALIDATION_ERROR 422`, `UNAUTHORIZED / INVALID_CREDENTIALS / TOKEN_* 401`, `LINK_EXPIRED 410`, `PASSWORD_NOT_SET / ACCESS_ENDED / FORBIDDEN 403`, `NOT_FOUND 404`, `CONFLICT 409`, `ACCOUNT_LOCKED 423`, `RATE_LIMITED 429`, `UPSTREAM_ERROR 502`.

### Auth contract for the Next.js BFF

- Send `Authorization: Bearer <accessToken>` on every call. Access tokens: RS256, 15 min. Member and admin use **different keys and audiences**.
- `login`, `set-password` and `change-password` return `{ accessToken, expiresIn, refreshToken, refreshExpiresAt, user }`. Put the refresh token in an httpOnly cookie in the BFF.
- `refresh` rotates the refresh token. **If the response has `refreshToken: null` (`graceReuse: true`), keep the cookie you already have.** That happens when two parallel requests refresh within 10 seconds. Reusing an old refresh token after the grace window destroys the whole session family.
- On `ACCESS_ENDED` (login or any request) the error `details` carry `supportEmail`. The message text is editable in Settings. The public `GET /member/auth/support-info` serves the same data to the access-ended page.
- Forward the end user's IP in `X-Forwarded-For`. Login rate limiting is keyed by IP **and** email so the BFF cannot lock everyone out at once.
- Accounts are created only by HubSpot or an owner. **There is no register endpoint.**

---

## 4. API reference

Roles: `member` = any active client; admin roles are `owner`, `content_admin`, `developer`. "Admin" routes need an admin bearer token. All lists accept `?page=&limit=`.

### 4.1 Member: `/v1/member`

**Auth (public unless noted; login-type routes are rate limited)**

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email,password}` -> tokens. Errors: `INVALID_CREDENTIALS`, `PASSWORD_NOT_SET`, `ACCOUNT_LOCKED` (5 fails -> 15 min), `ACCESS_ENDED` |
| POST | `/auth/refresh` | `{refreshToken}` -> new access (+ rotated refresh) |
| POST | `/auth/logout` | `{refreshToken}`: ends the session family |
| POST | `/auth/set-password` | `{token,password}`: invite link; signs the client in. Password policy is checked before the link is consumed |
| POST | `/auth/forgot-password` | `{email}`: always the same answer (no account enumeration) |
| POST | `/auth/reset-password` | `{token,password}`: single-use, ends all sessions |
| POST | `/auth/link-status` | `{token, type: invite or reset}` -> `{valid}` (for the "link expired" page) |
| GET | `/auth/support-info` | Support email, access-ended message, booking links |
| POST | `/auth/change-password` | **member token** `{currentPassword,newPassword}` -> fresh tokens |

**Profile and dashboard**

| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | `/me` | Profile; PATCH edits first/last name (email is changed through support) |
| GET | `/me/links` | Support email, Slack, Facebook group, booking links |
| POST | `/me/support` | `{subject,message}` emails the support address |
| GET | `/dashboard` | `{firstName, continue, latestReplay, overall, showNewHere}` |

**Content**

| Method | Path | Purpose |
|---|---|---|
| GET | `/start-here`, `/start-here/:slug` | Welcome area list + links; one page with resources |
| GET | `/replays` | `{years:[{year, replays:[…]}]}`: newest first, **with** session dates, attachments, watched flag |
| GET | `/replays/:slug` | One replay (lesson detail) |
| GET | `/training` | `{heading, courses:[{slug,title,courseNumber,lessonCount,progress}]}`: all containers merged under one heading, ordered by course number, **no dates** |
| GET | `/training/courses/:courseSlug` | `{course, welcome, lessons[], progress, nextLesson}`: welcome first, numbered lessons in order |
| GET | `/training/courses/:courseSlug/lessons/:lessonSlug` | Lesson detail with `prev` / `next` |
| GET | `/lessons/resolve?category=&lesson=` | Lesson by slugs (any product) |
| GET | `/lessons/:id` | Lesson detail: resources, captions, progress |
| GET | `/lessons/:id/playback` | Signed, expiring Bunny embed URL. Only for an entitled lesson with a ready video |
| GET | `/resources` | Resource Library: `?type=&topic=&q=&productKey=`; meta carries `facets:{types,topics}`; each item links to its lesson |
| GET | `/resources/:id` | Metadata |
| GET | `/resources/:id/download` | `{url,expiresAt,fileName}`: signed CDN URL, 5 minutes |
| GET | `/resources/:id/file` | Streams the file with `Content-Disposition: attachment` (always downloads) |
| GET | `/search?q=` | Lesson titles + descriptions. Text index first, then a partial-word fallback |

**Progress**

| Method | Path | Purpose |
|---|---|---|
| GET | `/progress/summary` | `{completed,total,percent}` across training |
| GET | `/progress/continue` | Resume the last unfinished lesson, or the next one |
| PUT | `/progress/lessons/:lessonId/position` | `{positionSeconds}` |
| POST / DELETE | `/progress/lessons/:lessonId/complete` | Mark complete / not complete; returns course percent + next lesson |

### 4.2 Admin: `/v1/admin`

**Auth (public except `me` and `change-password`):** `login, refresh, logout, set-password, forgot-password, reset-password, link-status`, `GET /auth/me`, `POST /auth/change-password`. Same behaviour as member auth, separate keys.

**Dashboard (any admin)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard`, `/dashboard/stats` | Active clients, failed/pending syncs, draft counts, last replay, and the **48-hour publishing clock** (state `on-track`, `at-risk` or `overdue` per recent draft replay; deadline = end of Friday after a Wednesday session, in UTC). `/stats` is an alias of `/` |
| GET | `/dashboard/activity` | Recent operational events from the audit log: publishes, uploads, grants, revokes, sync failures, team and settings changes. Logins and email deliveries are left out. Each item has a ready-made `summary`, a `severity` (`info`, `warning`, `error`) and the actor. `?limit=20` (1-100) and `?before=<ISO date>`; to load older events pass the previous response's `nextBefore` |

**Replays (`owner, content_admin`)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/replays` | Every year, newest first, drafts included, with deadline info |
| POST | `/replays` | `{sessionDate:'YYYY-MM-DD', topic, description?}`: builds the title `YYYY-MM Growth Lab - Topic`, creates the year category if missing |
| GET / PATCH | `/replays/:id` | Detail with publish checks; edit date/topic/description (re-files into the right year) |
| POST | `/replays/:id/:action` | `publish`, `unpublish`, `archive`, `restore` or `remove`. `remove` needs `{confirm:true}`. `publish` returns `{lesson, warnings}` or `409` with `details.errors` |

**Training (`owner, content_admin`; owner-only where marked)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/training/containers` | Containers with courses and lesson counts |
| POST | `/training/containers` | **owner** `{title,navGroup?}`. Auto-added to the All Access and Staff offers. Rejects tier/price words in the name |
| DELETE | `/training/containers/:id` | **owner** `?mode=archive` (default) or `?mode=delete`. Only an **empty** container (no courses); the last training container can never be removed (`409`). `delete` also pulls it out of every offer. If removed courses still point at it, only `archive` is allowed |
| GET | `/training/courses` | Flat, paginated list of every course with its parent container and `lessons: {total, live, draft, archived}` (totals include the 00 welcome lesson). Filters: `?productId=&status=draft|live|archived&q=` |
| POST | `/training/courses` | `{productId,courseNumber,name,description?}` -> title `Course N - Name`, no dates allowed, number unique across containers |
| GET / PATCH | `/training/courses/:id` | Course with lessons; edit |
| POST | `/training/courses/:id/move` | **owner** `{productId}`: move to another container (updates the denormalised product id on lessons and resources; progress untouched) |
| PUT | `/training/courses/:id/lessons/order` | `{lessonIds}` drag-and-drop: renumbers and rewrites the `Nn - ` title prefixes; welcome stays 00 |
| POST | `/training/courses/:id/:action` | `publish, unpublish, archive, restore, remove`. `publish` accepts `{includeLessons:true}` and reports which lessons were published or blocked and why |

**Lessons (training + Start Here)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/lessons` | `?categoryId=&productId=&status=&q=` |
| POST | `/lessons` | `{categoryId,title,description?}` (training: title must be `NN - Title` or exactly `00 - Welcome to this course`) **or** `{productKey:'start-here',title}` |
| GET / PATCH | `/lessons/:id` | Detail incl. resources, video state, `publishChecks:{errors,warnings}` |
| POST | `/lessons/:id/:action` | `publish, unpublish, archive, restore, remove` |
| PUT | `/lessons/categories/:categoryId/order` | Start Here ordering |
| GET / POST / DELETE | `/lessons/:id/captions[/:srclang]` | Captions (`{srclang,label,vtt}`) pushed to Bunny |

**Publish rules enforced:** description present; video ready (if any); training lessons need a video **and captions** (override with `{allowMissingCaptions:true}`); replays need a video. Terminology warnings (missing ™, "customers", "webinar", `Consult B3`) come back as non-blocking `warnings`.

**Videos (`owner, content_admin`)**

| Method | Path | Purpose |
|---|---|---|
| POST | `/videos/lessons/:lessonId/upload` | Creates the Bunny video, returns **TUS credentials**: the browser uploads straight to Bunny |
| POST | `/videos/lessons/:lessonId/replace` | New video; the old one keeps playing until the new one is encoded, then swaps. Captions must be re-uploaded afterwards |
| GET | `/videos/lessons/:lessonId/status` | Polls Bunny (works even without the webhook) |
| GET | `/videos/lessons/:lessonId/preview` | Signed player URL for admin preview, including drafts |
| DELETE | `/videos/lessons/:lessonId` | Only on a non-live lesson |

**Resources (`owner, content_admin`)**: multipart for uploads, field name `file`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/resources` | `?lessonId=&type=&topic=&q=&status=` |
| POST | `/resources` | multipart `file + lessonId + title (+ topic)`. File must be named `b3-topic-assettype-v1.ext` |
| GET | `/resources/:id` | Includes every version |
| GET | `/resources/:id/download-url` | `{url,expiresAt,fileName,version,current}`: signed CDN URL valid 5 minutes. Current version by default; `?version=N` for an older one. Needs the Bunny Edge Rule below to force a download |
| POST | `/resources/:id/versions` | Replace the file: must be named `…-v2.ext` (next number). Same id, same lesson, nothing breaks |
| PUT | `/resources/:id/current-version` | `{version}` rollback |
| PATCH / DELETE | `/resources/:id` | Edit/re-attach to another lesson (no copy); remove (soft) |

Uploads are checked for extension, allowed type and **file signature** (magic bytes), limited by `UPLOAD_MAX_MB` (default 50).

**Clients (`owner, content_admin, developer`; actions restricted as marked)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/clients` | `?q=&status=&tier=&tag=&syncStatus=`; each row shows a derived sync status |
| GET | `/clients/:id` | Profile, provisioning event timeline, audit trail, engagement |
| POST | `/clients/comp` | **owner** `{email,...}`: manual/exception access (tag `portal-comp`) |
| POST | `/clients/:id/revoke` | **owner** `{status,confirm:true}`: also sets HubSpot to Removed so a reconcile does not put access back |
| POST | `/clients/:id/resend-welcome` | owner, developer |
| POST | `/clients/:id/retry-writeback` | owner, developer |
| POST | `/clients/:id/reconcile` | owner, developer `{dryRun?}` |

**Provisioning (`owner, developer`; bulk load/send are owner-only)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/provisioning/status` | Event counts |
| GET | `/provisioning/events`, `/events/:id` | Sync log |
| POST | `/provisioning/events/:id/retry` | Re-queue a failed event |
| GET | `/provisioning/errors` | Failed events with no later success |
| POST | `/provisioning/reconcile` | `{full?,dryRun:true,force?}` |
| POST | `/provisioning/bulk/preview` | `{rows}` or `{csv}` -> per-row create/reactivate/noop/invalid |
| GET | `/provisioning/bulk/hubspot-rows` | Active contacts from HubSpot as rows |
| POST | `/provisioning/bulk/load` | **owner** `{rows|csv, dryRun:false, confirm:true}`: creates accounts with welcome emails **suppressed** |
| POST | `/provisioning/bulk/send-welcome` | **owner** `{emails?, limit, dryRun:false, confirm:true}`: send to a test sample first, then everyone |

**Owner only:** `GET /structure` (products, offers, tag map; `PATCH /structure/products/:id`), `GET/POST/PATCH /team` (+ `/invite`, `/:id/resend-invite`; last owner cannot be demoted; role change ends that admin's sessions), `GET /settings`, `PUT /settings/:key` (`supportEmail, slackUrl, facebookGroupUrl, bookingLinks, accessEndedMessage, sendAccessEndedEmail`).

**Reports**

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/reports/engagement?months=` | owner, content_admin | Active clients, logins per month, completions per course, by tier |
| GET | `/reports/inactive?days=` | owner, content_admin | Active clients who have not logged in |
| GET | `/reports/export?format=csv or json` | owner, content_admin | Per-client export including `hubspotContactId` |
| GET | `/reports/completions` | **owner only** | Per course: `startedClients`, `completedClients`, `startedRate`, `completionRate`, `averageProgressPct`, `lessonCount`, parent container. `?lessons=true` adds the per-lesson breakdown; `?courseId=` and `?productId=` filter |

The `/reports` mount in `admin/index.js` lets `content_admin` in, so `/reports/completions` adds `requireRole('owner')` on the route itself.
**Audit (`owner, developer`):** `GET /audit?action=&entity=&entityId=&actorEmail=&from=&to=`.

### 4.3 Integrations: `/v1/integrations`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/hubspot` | HubSpot v3 signature **or** `x-webhook-secret` header | The handoff. `202 {eventId, duplicate}` |
| POST | `/bunny?secret=…` | `BUNNY_WEBHOOK_SECRET` in the URL | Video status updates (Bunny cannot send custom headers) |

---

## 5. Setting up the two external systems

### HubSpot workflow webhook (Workflows 1-3)

POST to `https://<api>/v1/integrations/hubspot` with header `x-webhook-secret: <HUBSPOT_WEBHOOK_SECRET>` (or use the signed-request option with `HUBSPOT_CLIENT_SECRET`). Send a JSON body with the fields from Technical Build Scope 6.3:

```json
{ "action": "grant", "email": "…", "first_name": "…", "last_name": "…", "company": "…",
  "tier": "b3 Growth Lab", "hubspot_contact_id": "…", "start_date": "…" }
```

- `action` is `grant`, `revoke` or `update`. For revoke, add `"access": "Suspended"` or `"Removed"`.
- The nested `{ "properties": { "email": { "value": "…" } } }` shape HubSpot's "include properties" produces is also accepted.
- **Add `event_id` if you can.** Without it, an identical payload is treated as a duplicate for 10 minutes and as a new event afterwards. That window is what lets "grant, revoke, grant again" work while HubSpot retries are still absorbed. Provisioning is idempotent either way: no second account, no second welcome email.
- The tier string must be exactly one of the three names in `constants.js` (`TIERS`). Anything else fails that event as a permanent error: no retries, HubSpot `b3_portal_sync_status = Error`, and Workflow 4 makes the task.
- Create a HubSpot **private app** token with read/write on contacts for `HUBSPOT_ACCESS_TOKEN`. Create the 7 `b3_*` properties exactly as named in section 6.1.

### Bunny

- **Stream library:** enable token authentication, set `BUNNY_STREAM_TOKEN_KEY`, and add the webhook `https://<api>/v1/integrations/bunny?secret=<BUNNY_WEBHOOK_SECRET>`.
- **Storage zone + pull zone:** set the four `BUNNY_STORAGE_*` / `BUNNY_PULLZONE_*` variables and enable pull-zone token authentication. For `/download` signed URLs to *download* rather than preview, add a Bunny **Edge Rule** on the pull zone: for path `/resources/*`, set response header `Content-Disposition: attachment`. If you do not want to configure that, use `/file` (the API streams it with the right header).

### Email

`integrations/email/provider.js` uses **Resend** over plain `fetch`. For Postmark or SES, replace the body of `send()`; nothing else changes. Set SPF/DKIM/DMARC on the sending domain. The three templates use the brand palette (pink `#ff0073`, `#111111`, `#e7e7e7`, white; pink button with black text) and contain a placeholder comment where Consult b3's copy goes. **No logo is drawn or approximated**: add the supplied asset when you have it. No new-content email exists by design.

---

## 6. Background jobs

| Job | When | What |
|---|---|---|
| provision | on every webhook | 5 attempts, backoff 5/10/20/40 s. Bad data fails at once. Final failure -> event `failed` + HubSpot `Error` |
| writeback | after every grant/revoke/tier change | Retried the same way |
| reconcile (incremental) | every 15 min | Contacts changed in the last 45 min, plus **anything Pending for over an hour is flagged Error** (backstop for Workflow 4) |
| reconcile (full) | nightly 02:30 | Whole HubSpot scan, both directions: HubSpot Active but no access -> grant; HubSpot Removed but access -> revoke; portal access HubSpot no longer lists -> revoke. **Safety brake:** refuses to revoke more than 20% of active clients (min 5) without `force`, so one bad HubSpot read cannot wipe the portal. Comp and staff are exempt |
| cleanup | weekly | Trims old processed events. Expired tokens purge via a Mongo TTL index |

`RECONCILE_ENABLED` is **false by default**. Turn it on after the launch-day batch, otherwise reconcile would send welcome emails ahead of your launch date.

---

## 7. Launch-day sequence (Technical Build Scope 7.2)

1. Export active clients from HubSpot, Kristi confirms the list.
2. `npm run bulk-provision -- --file clients.csv` (dry run: check invalid rows and unknown tiers).
3. Same command with `--execute`: accounts created, **no emails**.
4. Test on a sample: `--send-welcome --emails a@x.com,b@y.com --execute`, then log in and check content.
5. On the agreed date: `--send-welcome --execute`.
6. Set `RECONCILE_ENABLED=true`.

All of 2-5 are also available as admin API calls under `/provisioning/bulk/*`.

---

## 8. Decisions I made that you may want to change

1. **Start Here** is a flat list, but `Lesson.categoryId` is required, so the seed creates one hidden holding category (slug `general`). Use `POST /admin/lessons {productKey:'start-here'}`. `GET /admin/structure` exposes its id as `defaultCategoryId` for ordering.
2. **Course progress** counts numbered lessons only; the welcome lesson (00) and archived lessons are excluded from the percentage. "Next lesson" can still be the welcome.
3. **Publishing clock** deadline is the start of Saturday UTC after the Wednesday session. Change `publishDeadline()` in `utils/dates.js` if you want your timezone.
4. **Reconcile** is the safety net, not the primary path. The webhook is primary.
5. **Revoke** removes `portal-access-active` and `portal-comp`, sets status `removed` or `suspended` (identical behaviour at launch), bumps the token version, and deletes all tokens. The account and progress are kept. The access-ended email is off by default (a Setting).
6. **Replacing a video** drops that lesson's captions (they belong to the Bunny video). Re-upload them.
7. **Download counts are not tracked**: there is no field for them on `Resource`.
8. **Logins are recorded in the audit log** (`member.login`) because the User model only keeps the last login; that is what powers the monthly-logins report.
9. **Completions report:** the denominator is all active clients (everyone sees everything at launch); the welcome lesson (00), non-live lessons and draft courses are not counted. When tiering is switched on, change `eligible` in `report.service.js` to count only clients whose offers include that course's container. The data model has no *modules* between a course and its lessons, so "module" means lesson (`?lessons=true`).
10. **Container removal** is deliberately strict: owner only, empty only, never the last one. Archiving an empty container changes nothing members can see.
11. **Activity feed** reads from the audit log, so it shows exactly what is audited and nothing else. Logins and email deliveries are excluded as noise.
12. Cron runs inside the API process. If you run more than one API instance, either run jobs on one (`RUN_JOBS=false` on the rest) or move the schedule into BullMQ repeatable jobs.

## 9. Not built / out of scope

- Email bounce/complaint webhook handling (provider-specific).
- Sentry wiring (`SENTRY_DSN` exists in env; add `@sentry/node` in `server.js` if wanted).
- Offer editing UI/API: `structure` is read-only for offers. Tiering later needs one new Offer row, which `tests/unit/entitlement.test.js` demonstrates.
- Watch-time analytics and per-resource download counts: the data model stores only completion and last position, and nothing records downloads. Add fields (and write them on `/position` and download) before building those reports.
- Anything FUTURE in the documents: certificates, quizzes, drip, team seats, prospect courses.

## 10. Questions from the Technical Build Scope that code cannot answer

These still need answers from GoHighLevel/Bunny, not from this repo: plan limits for storage and bandwidth, maximum attachment size, container/lesson limits, whether moving a course keeps completion history (in **this** build it does: progress is keyed by lesson id), and a realistic sync window (webhook to access is normally seconds; the worst case with retries is about 75 seconds, then Error + task).

> Note: your documents were written for GoHighLevel's LMS, but the structure you gave me (Mongo models, Bunny, Next.js frontends) is a **custom** portal. I built to the structure. If GoHighLevel is still meant to be the membership engine, tell me: the HubSpot-to-access chain would change materially.

## 11. Tests

`npm test` runs: naming rules, the entitlement matrix (including the future-tiering proof), HubSpot payload parsing, Bunny signing, and one end-to-end flow (webhook auth, grant, duplicate handoff, failed handoff, invite -> password -> content access, entitlement hiding, progress, revocation, login message, progress retained). The five late-added endpoints (activity feed, container delete, course list, admin download URL, completions report) are not covered by tests yet. Not yet executed: see section 1.