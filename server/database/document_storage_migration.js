const db = require("../config/database");

async function runStorageMigration() {
  console.log("Starting Document Storage & External Link Migration...");
  const conn = await db.getConnection();

  try {
    // 1. Check existing columns in documents
    const [docCols] = await conn.query("SHOW COLUMNS FROM documents");
    const docColNames = docCols.map((c) => c.Field);

    // Modify source enum to include EXTERNAL_LINK
    try {
      await conn.query(`
        ALTER TABLE documents 
        MODIFY COLUMN source ENUM(
          'UPLOADED',
          'CREATED_FROM_TEMPLATE',
          'GENERATED',
          'CLIENT_UPLOADED',
          'COURT_UPLOADED',
          'SIGNED',
          'IMPORTED',
          'EXTERNAL_LINK',
          'OTHER'
        ) NOT NULL DEFAULT 'UPLOADED'
      `);
      console.log("✓ Updated documents.source enum with EXTERNAL_LINK");
    } catch (e) {
      console.log("- Source enum alteration note:", e.message);
    }

    // Add storage_type to documents
    if (!docColNames.includes("storage_type")) {
      await conn.query(`
        ALTER TABLE documents 
        ADD COLUMN storage_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL' AFTER document_number
      `);
      console.log("✓ Added storage_type to documents");
    }

    // Add internal & external fields to documents
    const docFieldsToAdd = [
      { name: "internal_storage_key", sql: "ADD COLUMN internal_storage_key VARCHAR(500) NULL AFTER storage_type" },
      { name: "internal_file_name", sql: "ADD COLUMN internal_file_name VARCHAR(255) NULL AFTER internal_storage_key" },
      { name: "internal_file_size", sql: "ADD COLUMN internal_file_size BIGINT NULL AFTER internal_file_name" },
      { name: "internal_mime_type", sql: "ADD COLUMN internal_mime_type VARCHAR(100) NULL AFTER internal_file_size" },
      { name: "checksum", sql: "ADD COLUMN checksum VARCHAR(64) NULL AFTER internal_mime_type" },
      { name: "external_provider", sql: "ADD COLUMN external_provider ENUM('GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX', 'OTHER') NULL AFTER checksum" },
      { name: "external_url", sql: "ADD COLUMN external_url TEXT NULL AFTER external_provider" },
      { name: "external_file_name", sql: "ADD COLUMN external_file_name VARCHAR(255) NULL AFTER external_url" },
      { name: "external_file_size", sql: "ADD COLUMN external_file_size BIGINT NULL AFTER external_file_name" },
      { name: "external_mime_type", sql: "ADD COLUMN external_mime_type VARCHAR(100) NULL AFTER external_file_size" },
      { name: "external_url_status", sql: "ADD COLUMN external_url_status ENUM('NOT_CHECKED', 'ACTIVE', 'BROKEN', 'UNKNOWN') DEFAULT 'NOT_CHECKED' AFTER external_mime_type" },
      { name: "external_url_last_verified_at", sql: "ADD COLUMN external_url_last_verified_at DATETIME NULL AFTER external_url_status" },
    ];

    for (const f of docFieldsToAdd) {
      if (!docColNames.includes(f.name)) {
        await conn.query(`ALTER TABLE documents ${f.sql}`);
        console.log(`✓ Added ${f.name} to documents`);
      }
    }

    // 2. Check existing columns in document_versions
    const [verCols] = await conn.query("SHOW COLUMNS FROM document_versions");
    const verColNames = verCols.map((c) => c.Field);

    // Make storage_key and checksum nullable in document_versions
    await conn.query(`ALTER TABLE document_versions MODIFY COLUMN storage_key VARCHAR(500) NULL`);
    await conn.query(`ALTER TABLE document_versions MODIFY COLUMN checksum VARCHAR(64) NULL`);
    console.log("✓ Made storage_key and checksum nullable in document_versions for external links");

    const verFieldsToAdd = [
      { name: "storage_type", sql: "ADD COLUMN storage_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL' AFTER version_number" },
      { name: "internal_storage_key", sql: "ADD COLUMN internal_storage_key VARCHAR(500) NULL AFTER storage_type" },
      { name: "internal_file_name", sql: "ADD COLUMN internal_file_name VARCHAR(255) NULL AFTER internal_storage_key" },
      { name: "internal_file_size", sql: "ADD COLUMN internal_file_size BIGINT NULL AFTER internal_file_name" },
      { name: "internal_file_mime_type", sql: "ADD COLUMN internal_file_mime_type VARCHAR(100) NULL AFTER internal_file_size" },
      { name: "external_provider", sql: "ADD COLUMN external_provider ENUM('GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX', 'OTHER') NULL AFTER internal_file_mime_type" },
      { name: "external_url", sql: "ADD COLUMN external_url TEXT NULL AFTER external_provider" },
      { name: "external_file_name", sql: "ADD COLUMN external_file_name VARCHAR(255) NULL AFTER external_url" },
      { name: "external_file_size", sql: "ADD COLUMN external_file_size BIGINT NULL AFTER external_file_name" },
      { name: "external_mime_type", sql: "ADD COLUMN external_mime_type VARCHAR(100) NULL AFTER external_file_size" },
      { name: "version_status", sql: "ADD COLUMN version_status ENUM('ACTIVE', 'SUPERSEDED', 'ARCHIVED') DEFAULT 'ACTIVE' AFTER change_summary" },
    ];

    for (const f of verFieldsToAdd) {
      if (!verColNames.includes(f.name)) {
        await conn.query(`ALTER TABLE document_versions ${f.sql}`);
        console.log(`✓ Added ${f.name} to document_versions`);
      }
    }

    // Populate existing internal files fields from storage_key etc.
    await conn.query(`
      UPDATE document_versions 
      SET 
        storage_type = 'INTERNAL',
        internal_storage_key = storage_key,
        internal_file_name = original_filename,
        internal_file_size = file_size,
        internal_file_mime_type = mime_type
      WHERE internal_storage_key IS NULL AND storage_key IS NOT NULL
    `);

    await conn.query(`
      UPDATE documents d
      JOIN document_versions dv ON d.current_version_id = dv.id
      SET 
        d.storage_type = 'INTERNAL',
        d.internal_storage_key = dv.storage_key,
        d.internal_file_name = dv.original_filename,
        d.internal_file_size = dv.file_size,
        d.internal_mime_type = dv.mime_type,
        d.checksum = dv.checksum
      WHERE d.internal_storage_key IS NULL AND dv.storage_key IS NOT NULL
    `);
    console.log("✓ Backfilled legacy document versions with internal storage attributes");

    // 3. Add Permissions
    const newPermissions = [
      { name: "DOCUMENT_EXTERNAL_LINK_CREATE", description: "Create documents referencing external cloud storage links", category: "DOCUMENTS" },
      { name: "DOCUMENT_EXTERNAL_LINK_OPEN", description: "Open authorized external document links", category: "DOCUMENTS" },
      { name: "DOCUMENT_ARCHIVE", description: "Archive and restore legal documents", category: "DOCUMENTS" }
    ];

    for (const perm of newPermissions) {
      const [existing] = await conn.query("SELECT id FROM permissions WHERE name = ?", [perm.name]);
      let permId;
      if (existing.length === 0) {
        const [res] = await conn.query(
          "INSERT INTO permissions (name, description, category) VALUES (?, ?, ?)",
          [perm.name, perm.description, perm.category]
        );
        permId = res.insertId;
        console.log(`✓ Created permission: ${perm.name}`);
      } else {
        permId = existing[0].id;
      }

      // Map to roles: OWNER, SENIOR_ASSOCIATE, JUNIOR_ASSOCIATE get all three
      // CLIENT gets DOCUMENT_EXTERNAL_LINK_OPEN
      const roleNames = ["OWNER", "SENIOR_ASSOCIATE", "JUNIOR_ASSOCIATE"];
      if (perm.name === "DOCUMENT_EXTERNAL_LINK_OPEN") {
        roleNames.push("CLIENT", "INTERN");
      }

      for (const rName of roleNames) {
        const [roleRows] = await conn.query("SELECT id FROM roles WHERE name = ?", [rName]);
        if (roleRows.length > 0) {
          const roleId = roleRows[0].id;
          await conn.query(
            "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            [roleId, permId]
          );
        }
      }
    }
    console.log("✓ Mapped new permissions to roles");

    console.log("Document Storage & External Link Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  runStorageMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runStorageMigration;
