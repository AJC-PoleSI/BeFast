const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://rslztpjwrrjrvajkwcvo.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createPersonnesRecord() {
  try {
    console.log("Creating personnes record for admin...");

    // Get admin user ID
    const { data: users, error: userError } = await supabase.auth.admin.listUsers({
      limit: 100,
    });

    if (userError) {
      console.error("❌ Error listing users:", userError.message);
      return;
    }

    const adminUser = users.users.find(u => u.email === "admin@befast.fr");
    if (!adminUser) {
      console.error("❌ Admin user not found");
      return;
    }

    console.log("Found admin user:", adminUser.id);

    // Get admin profil type
    const { data: adminProfil, error: profilError } = await supabase
      .from("profils_types")
      .select("id")
      .eq("slug", "administrateur")
      .single();

    if (profilError) {
      console.error("❌ Error fetching admin profil:", profilError.message);
      return;
    }

    console.log("Found admin profil:", adminProfil.id);

    // Check if personnes record already exists
    const { data: existingPersonne, error: checkError } = await supabase
      .from("personnes")
      .select("id")
      .eq("id", adminUser.id)
      .single();

    if (existingPersonne) {
      console.log("✅ Personnes record already exists");
      return;
    }

    // Create personnes record
    const { error: personneError } = await supabase
      .from("personnes")
      .insert({
        id: adminUser.id,
        email: "admin@befast.fr",
        prenom: "Admin",
        nom: "BeFast",
        profil_type_id: adminProfil.id,
        actif: true,
      });

    if (personneError) {
      console.error("❌ Error creating personnes record:", personneError.message);
      return;
    }

    console.log("✅ Personnes record created successfully!");
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
  }
}

createPersonnesRecord();
