const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from("candidatures")
    .select("*, personnes!candidatures_personne_id_fkey(id, prenom, nom, email, promo, scolarite)")
    .in("mission_id", ["0bbb80c8-213d-415e-9a7f-d77d050cc352", "f071c94c-79e3-4bee-9d29-7816bd284490"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("DB Error:", error);
  } else {
    console.log(`Found ${data.length} candidatures`);
  }
}

check();
