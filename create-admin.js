const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://rslztpjwrrjrvajkwcvo.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHp0cGp3cnJqcnZhamt3Y3ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg5OTUxNCwiZXhwIjoyMDkxNDc1NTE0fQ.ZsD8N6wIbuezeigl_54ml39s-C_N9A6zyQRCFe5Mf2s";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createAdmin() {
  try {
    console.log("Creating admin user...");

    // Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: "admin@befast.fr",
      password: "BeFast2024!Admin",
      email_confirm: true,
    });

    if (error) {
      console.error("❌ Error creating auth user:", error.message);
      return;
    }

    const userId = data.user.id;
    console.log("✅ Admin auth user created:", userId);
    console.log("Email:", data.user.email);

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

    // Create personnes record
    const { error: personneError } = await supabase
      .from("personnes")
      .insert({
        id: userId,
        email: "admin@befast.fr",
        prenom: "Admin",
        nom: "BeFast",
        profil_type_id: adminProfil.id,
        actif: true,
      });

    if (personneError) {
      // If record already exists, that's fine
      if (personneError.code === "23505") {
        console.log("✅ Personnes record already exists for this user");
      } else {
        console.error("❌ Error creating personnes record:", personneError.message);
        return;
      }
    } else {
      console.log("✅ Personnes record created");
    }

    console.log("\n✅ Admin setup complete!");
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
  }
}

createAdmin();
