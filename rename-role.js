const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://rslztpjwrrjrvajkwcvo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s"
);

async function run() {
  // 1. Rename membre_agc → chef_projet_ajc (no access to membres)
  const { error: e1 } = await supabase
    .from("profils_types")
    .update({
      nom: "Chef.fe de projet AJC",
      slug: "chef_projet_ajc",
      permissions: {
        dashboard: true, profil: false, missions: true, etudes: true,
        prospection: true, statistiques: true, administration: false,
        membres: false, documents: true, nouvelle_mission: false,
      }
    })
    .eq("slug", "membre_agc");
  console.log(e1 ? "❌ rename membre_agc: " + e1.message : "✅ membre_agc → chef_projet_ajc");

  // 2. Ensure admin has all permissions incl. membres
  const { error: e2 } = await supabase
    .from("profils_types")
    .update({
      permissions: {
        dashboard: true, profil: true, missions: true, etudes: true,
        prospection: true, statistiques: true, administration: true,
        membres: true, documents: true, nouvelle_mission: true,
      }
    })
    .eq("slug", "administrateur");
  console.log(e2 ? "❌ admin update: " + e2.message : "✅ Admin permissions confirmed");

  // 3. Show all roles
  const { data } = await supabase.from("profils_types").select("nom, slug").order("nom");
  console.log("\nCurrent roles:", data?.map(r => `${r.slug} → ${r.nom}`).join("\n  "));
}
run();
