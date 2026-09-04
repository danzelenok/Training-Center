import { checkDialogueVideoStatus } from '../lib/heygen';

async function main() {
  const jobId = process.argv[2];
  const status = await checkDialogueVideoStatus(jobId);
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
