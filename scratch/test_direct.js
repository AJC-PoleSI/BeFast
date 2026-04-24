require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testDirectRender() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: tpls } = await supabase.from('document_templates').select('id, file_path, name').limit(1);
  if (!tpls || tpls.length === 0) {
    console.log("No templates."); return;
  }
  const tpl = tpls[0];
  console.log("Found template:", tpl.name);

  const { data: blob, error } = await supabase.storage.from('templates').download(tpl.file_path);
  if (error) { console.error("Download error:", error); return; }
  
  const templateBuf = Buffer.from(await blob.arrayBuffer());

  // Using dynamic import or ts-node to run the TS code
}
testDirectRender();
