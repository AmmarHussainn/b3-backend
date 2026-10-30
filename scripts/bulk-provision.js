// Launch-day batch. Default is a DRY RUN.
//   npm run bulk-provision -- --file clients.csv                     (preview)
//   npm run bulk-provision -- --hubspot                              (preview from HubSpot Active contacts)
//   npm run bulk-provision -- --file clients.csv --execute           (create accounts, welcome emails SUPPRESSED)
//   npm run bulk-provision -- --send-welcome --emails a@x.com,b@y.com --execute   (send to a test sample)
//   npm run bulk-provision -- --send-welcome --execute               (send to everyone not yet emailed)
import { readFile } from 'node:fs/promises';
import { connectDb, disconnectDb } from '../src/db/connection.js';
import * as bulk from '../src/services/bulk.service.js';
import { parseCsv } from '../src/utils/csv.js';

const has = (n) => process.argv.includes(`--${n}`);
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const dryRun = !has('execute');
await connectDb();
if (has('send-welcome')) {
  console.log(JSON.stringify(await bulk.sendWelcomeBatch({ emails: arg('emails')?.split(','), dryRun }), null, 2));
} else {
  let rows;
  if (has('hubspot')) rows = await bulk.rowsFromHubspot();
  else if (arg('file')) { const t = await readFile(arg('file'), 'utf8'); rows = arg('file').endsWith('.json') ? JSON.parse(t) : parseCsv(t); }
  else { console.error('Use --file <csv|json> or --hubspot'); process.exit(1); }
  const r = await bulk.load(rows, { dryRun });
  console.log(JSON.stringify(r.summary, null, 2));
  for (const x of r.rows || r.results) if (x.problems?.length || x.error) console.log(' !', x.email, x.problems?.join('; ') || x.error);
  if (dryRun) console.log('\nDRY RUN: nothing was written. Re-run with --execute.');
}
await disconnectDb();
