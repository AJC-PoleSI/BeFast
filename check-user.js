const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://rslztpjwrrjrvajkwcvo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s"
);

async function check() {
  const { data: personne } = await supabase
    .from("personnes")
    .select("*, profils_types(*)")
    .eq("email", "felix.pitz@audencia.com")
    .single();
  
  if (!personne) {
    console.log("❌ No personnes record found");
    const { data: users } = await supabase.auth.admin.listUsers({ limit: 100 });
    const u = users.users.find(u => u.email === "felix.pitz@audencia.com");
    console.log("Auth user exists?", !!u, u?.id);
  } else {
    console.log("profil_type_id:", personne.profil_type_id);
    console.log("profil_type:", personne.profils_types?.slug, personne.profils_types?.nom);
    console.log("permissions:", JSON.stringify(personne.profils_types?.permissions));
  }
}
check();
