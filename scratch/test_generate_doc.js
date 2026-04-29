import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: tpls } = await sb.from('document_templates').select('id, name, file_path');
  console.log("Templates:", tpls);
  if (!tpls || tpls.length === 0) { console.log("No templates."); return; }
  
  // Pick the first template
  const tpl = tpls[0];
  console.log("Using template:", tpl.name);
  
  const { data: blob, error: dlErr } = await sb.storage.from("templates").download(tpl.file_path)
  if (dlErr || !blob) { console.log("Download error:", dlErr); return; }
  const templateBuf = Buffer.from(await blob.arrayBuffer());
  
  // Import docxtemplater and our engine
  // wait, our engine is in TS. We can just run it using tsx.
}
run();
