const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://rslztpjwrrjrvajkwcvo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s"
);

async function run() {
  // Show current state
  const { data: current } = await supabase.from("profils_types").select("id, nom, slug").order("nom");
  console.log("Current roles:", current?.map(r => `  ${r.slug} → ${r.nom} (${r.id})`).join("\n"));

  // 1. Rename "Ancien Membre AGC" → "Ancien Mandat"
  const { error: e1 } = await supabase
    .from("profils_types")
    .update({ nom: "Ancien Mandat", slug: "ancien_mandat" })
    .eq("slug", "ancien_membre_agc");
  console.log("\n" + (e1 ? "❌ Rename ancien_membre_agc: " + e1.message : "✅ ancien_membre_agc → Ancien Mandat"));

  // 2. Get both chef roles
  const { data: chefAjc } = await supabase.from("profils_types").select("id, permissions").eq("slug", "chef_projet_ajc").single();
  const { data: chefProjet } = await supabase.from("profils_types").select("id, permissions").eq("slug", "chef_de_projet").single();

  if (!chefAjc || !chefProjet) {
    console.log("❌ Could not find both chef roles:", { chefAjc: !!chefAjc, chefProjet: !!chefProjet });
    return;
  }

  // Merge permissions (union of both)
  const mergedPerms = { ...chefProjet.permissions, ...chefAjc.permissions };
  // Ensure correct merged permissions for "Chef.fe de projet AJC"
  const finalPerms = {
    dashboard: true, profil: true, missions: true, etudes: true,
    prospection: true, statistiques: true, administration: false,
    membres: false, documents: true, nouvelle_mission: true,
  };

  // 3. Update chef_projet_ajc with merged permissions and final name
  const { error: e2 } = await supabase
    .from("profils_types")
    .update({ nom: "Chef.fe de projet AJC", slug: "chef_projet_ajc", permissions: finalPerms })
    .eq("id", chefAjc.id);
  console.log(e2 ? "❌ Update chef_projet_ajc: " + e2.message : "✅ chef_projet_ajc updated with merged permissions");

  // 4. Reassign all users from chef_de_projet → chef_projet_ajc
  const { data: affected, error: e3 } = await supabase
    .from("personnes")
    .update({ profil_type_id: chefAjc.id })
    .eq("profil_type_id", chefProjet.id)
    .select("email");
  console.log(e3 ? "❌ Reassign users: " + e3.message : `✅ Reassigned ${affected?.length ?? 0} users from chef_de_projet → chef_projet_ajc`);
  if (affected?.length) console.log("   Users:", affected.map(u => u.email).join(", "));

  // 5. Delete old chef_de_projet role
  const { error: e4 } = await supabase
    .from("profils_types")
    .delete()
    .eq("id", chefProjet.id);
  console.log(e4 ? "❌ Delete chef_de_projet: " + e4.message : "✅ chef_de_projet deleted");

  // Final state
  const { data: final } = await supabase.from("profils_types").select("id, nom, slug").order("nom");
  console.log("\nFinal roles:\n" + final?.map(r => `  ${r.slug} → ${r.nom}`).join("\n"));
}
run();
