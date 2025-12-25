import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Database Migration Runner
 * 
 * Executes SQL migration files in order on application startup.
 * This ensures the database schema is up-to-date before the app starts.
 */
export async function runMigrations(databaseUrl?: string): Promise<void> {
  const connectionString = databaseUrl || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, {
    max: 1,
  });

  try {
    console.log("🔄 Running database migrations...");

    const migrationFiles = [
      "001_init.sql",
      "002_trust_layer.sql",
      "003_app_schema.sql",
      "004_trust_schema.sql",
      "005_dao_proposals.sql",
      "006_add_anchoring_fields.sql",
      "007_add_message_type.sql",
      "008_add_notes_ipfs_cid.sql",
      "009_add_kyber_columns.sql",
      "010_add_blueprint_tables.sql",
      "011_wallet_keys.sql",
      "012_anchor_outbox.sql",
      "013_marketplace_tables.sql",
      "014_moderation_tables.sql",
      "015_enterprise_tables.sql",
      "016_identity_tables.sql",
      "017_encrypted_messaging_timelocks.sql",
      "018_production_hardening.sql",
      "019_wallet_profiles_vault.sql",
    ];

    for (const filename of migrationFiles) {
      const migrationPath = join(process.cwd(), "server/migrations", filename);
      console.log(`  ⏳ Executing migration: ${filename}`);
      
      try {
        const migrationSQL = readFileSync(migrationPath, "utf-8");
        await sql.unsafe(migrationSQL);
        console.log(`  ✅ Migration completed: ${filename}`);
      } catch (error: any) {
        console.error(`  ❌ Migration failed: ${filename}`);
        throw error;
      }
    }

    console.log("✅ All migrations completed successfully");
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}
