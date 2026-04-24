require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Mock out the next/cache because we are running outside Next
require('module').Module._cache[require.resolve('next/cache')] = {
  exports: { revalidatePath: () => {} }
};

// Also mock server-only
require('module').Module._cache[require.resolve('server-only')] = { exports: {} };

async function testReal() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Get a template
  const { data: tpls } = await supabase.from('document_templates').select('*').limit(1);
  if (!tpls || tpls.length === 0) {
    console.log("No templates."); return;
  }
  const tpl = tpls[0];
  console.log("Template:", tpl.name, tpl.placeholders);

  const { data: blob, error } = await supabase.storage.from('templates').download(tpl.file_path);
  if (error) { console.error(error); return; }
  const buf = Buffer.from(await blob.arrayBuffer());

  // Use the real render engine
  const { renderDocx } = require('./lib/docx/template-engine.ts');

  // Provide some fake data matching placeholders
  const context = {
    etude: { nom: "ETUDE TEST", numero: "ET-123" },
    client: { nom: "CLIENT TEST" },
    intervenant: { prenom: "Jean", nom: "Dupont" }
  };

  try {
    const outBuf = renderDocx(buf, context);
    fs.writeFileSync('scratch/out.docx', outBuf);
    console.log("Success! Output saved to scratch/out.docx");
  } catch(e) {
    console.error("Render error:", e);
  }
}

// We need to use ts-node or run it via a command that understands TS.
// I'll just compile the template-engine.ts logic inline here to avoid ts-node.
