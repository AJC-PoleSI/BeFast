const fs = require('fs');

function loadEnv() {
  const content = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  });
  return env;
}

const env = loadEnv();
const { createClient } = require('@supabase/supabase-js');

async function checkBuckets() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error listing buckets:", error);
    return;
  }
  
  console.log("Buckets:", data.map(b => b.name));
  
  const templatesBucket = data.find(b => b.name === 'templates');
  if (!templatesBucket) {
    console.log("Bucket 'templates' is MISSING!");
  } else {
    console.log("Bucket 'templates' exists.");
  }
}

checkBuckets();
