const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://rslztpjwrrjrvajkwcvo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s"
);

async function fix() {
  const { data: profil } = await supabase
    .from("profils_types")
    .select("id")
    .eq("slug", "membre_agc")
    .single();

  const { error } = await supabase.from("personnes").insert({
    id: "857d431a-a326-449e-9d8b-b30811b864a2",
    email: "felix.pitz@audencia.com",
    prenom: "Felix",
    nom: "Pitz",
    profil_type_id: profil.id,
    actif: true,
  });

  if (error) console.error("❌", error.message);
  else console.log("✅ Personnes record created for felix.pitz@audencia.com (Membre AGC)");
}
fix();
