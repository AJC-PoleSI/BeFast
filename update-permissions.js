const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://rslztpjwrrjrvajkwcvo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s"
);

const ROLES = {
  administrateur: {
    dashboard: true, profil: true, missions: true, etudes: true,
    prospection: true, statistiques: true, administration: true,
    membres: true, documents: true, nouvelle_mission: true,
  },
  membre_agc: {
    dashboard: true, profil: false, missions: true, etudes: true,
    prospection: true, statistiques: true, administration: false,
    membres: true, documents: true, nouvelle_mission: false,
  },
  ancien_membre_agc: {
    dashboard: true, profil: true, missions: false, etudes: false,
    prospection: false, statistiques: false, administration: false,
    membres: false, documents: true, nouvelle_mission: false,
  },
  intervenant: {
    dashboard: true, profil: true, missions: true, etudes: false,
    prospection: false, statistiques: false, administration: false,
    membres: false, documents: true, nouvelle_mission: false,
  },
  chef_de_projet: {
    dashboard: true, profil: true, missions: true, etudes: true,
    prospection: true, statistiques: true, administration: false,
    membres: true, documents: true, nouvelle_mission: true,
  },
};

async function updatePermissions() {
  for (const [slug, permissions] of Object.entries(ROLES)) {
    const { error } = await supabase
      .from("profils_types")
      .update({ permissions })
      .eq("slug", slug);

    if (error) {
      console.error(`❌ ${slug}:`, error.message);
    } else {
      console.log(`✅ ${slug} updated`);
    }
  }
}

updatePermissions();
