import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  // Verify admin secret header
  const secret = request.headers.get("x-admin-secret");
  if (secret !== "BeFast2024!Admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read migrations
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = ["001_init_schema.sql"];

    const results: any = [];

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`\n📝 Executing migration: ${file}`);
      console.log(`   Size: ${sql.length} bytes`);

      // Create Supabase client with service role
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Execute migration via RPC or raw SQL
      // Note: Supabase REST API doesn't support raw SQL
      // We need to use the pg_admin or direct DB connection
      // For now, we'll check if tables exist and report

      const { error: checkError } = await supabase
        .from("profils_types")
        .select("count")
        .limit(1);

      if (!checkError) {
        console.log(`✅ Tables already exist!`);
        results.push({
          file,
          status: "already_applied",
          message: "Tables profils_types and personnes already exist",
        });
      } else {
        console.log(`❌ Tables don't exist yet`);
        results.push({
          file,
          status: "needs_manual_application",
          message: "Please paste the SQL into Supabase SQL Editor",
          sql: sql,
        });
      }
    }

    return Response.json(
      {
        success: true,
        migrations: results,
        instructions:
          "Go to https://app.supabase.com/project/rslztpjwrrjrvajkwcvo/sql/new and paste the SQL",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return Response.json(
      { error: String(error), status: "failed" },
      { status: 500 }
    );
  }
}
