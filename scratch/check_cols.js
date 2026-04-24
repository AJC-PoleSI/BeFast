require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkCols() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.from('personnes').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log("Columns in 'personnes':", Object.keys(data[0]));
    console.log("Data sample:", data[0]);
  } else {
    console.log("No data found in 'personnes' table.");
  }
}

checkCols();
