const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('personnes')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching data:", error);
  } else if (data.length === 0) {
    console.log("Table is empty, can't infer columns from data.");
    // Try to get columns from a view or something? 
    // Actually let's just query the RPC if available or fail.
    console.log("Trying to insert dummy to see error or columns...");
  } else {
    console.log("Columns from data:", Object.keys(data[0]));
  }
}

check();
