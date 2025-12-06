/**
 * Safe migration to ensure delivery_tracking has columns used by messengerController.completeDelivery:
 * - delivery_fee_payment_method VARCHAR(50) NULL
 * - delivery_latitude DECIMAL(10,8) NULL
 * - delivery_longitude DECIMAL(11,8) NULL
 *
 * Uses the existing backend DB pool/config to avoid external deps.
 */
const { query, poolEnd } = require("../config/database");

async function tableExists(table) {
  const rows = await query(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function columnExists(table, column) {
  const rows = await query(
    "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function run() {
  console.log("📦 Migración: asegurar columnas en delivery_tracking");

  const table = "delivery_tracking";
  const exists = await tableExists(table);
  if (!exists) {
    console.error("❌ La tabla delivery_tracking no existe. Ejecute las migraciones base antes de continuar.");
    process.exitCode = 1;
    return;
  }

  // Confirm if payment_method exists to place AFTER correctly; fallback to end if not present.
  const hasPaymentMethod = await columnExists(table, "payment_method");

  // 1) delivery_fee_payment_method VARCHAR(50) NULL
  const hasFeePM = await columnExists(table, "delivery_fee_payment_method");
  if (!hasFeePM) {
    console.log("📝 Agregando columna delivery_fee_payment_method (VARCHAR(50) NULL)...");
    const alter = hasPaymentMethod
      ? `ALTER TABLE ${table} ADD COLUMN delivery_fee_payment_method VARCHAR(50) NULL AFTER payment_method`
      : `ALTER TABLE ${table} ADD COLUMN delivery_fee_payment_method VARCHAR(50) NULL`;
    await query(alter);
    console.log("✅ Columna delivery_fee_payment_method agregada");
  } else {
    console.log("ℹ️ Columna delivery_fee_payment_method ya existe");
  }

  // 2) delivery_latitude DECIMAL(10,8) NULL
  const hasLat = await columnExists(table, "delivery_latitude");
  if (!hasLat) {
    console.log("📝 Agregando columna delivery_latitude (DECIMAL(10,8) NULL)...");
    await query(`ALTER TABLE ${table} ADD COLUMN delivery_latitude DECIMAL(10,8) NULL`);
    console.log("✅ Columna delivery_latitude agregada");
  } else {
    console.log("ℹ️ Columna delivery_latitude ya existe");
  }

  // 3) delivery_longitude DECIMAL(11,8) NULL
  const hasLng = await columnExists(table, "delivery_longitude");
  if (!hasLng) {
    console.log("📝 Agregando columna delivery_longitude (DECIMAL(11,8) NULL)...");
    await query(`ALTER TABLE ${table} ADD COLUMN delivery_longitude DECIMAL(11,8) NULL`);
    console.log("✅ Columna delivery_longitude agregada");
  } else {
    console.log("ℹ️ Columna delivery_longitude ya existe");
  }

  // Show relevant columns
  const desc = await query("DESCRIBE delivery_tracking");
  const relevant = desc.filter((r) =>
    ["payment_collected", "delivery_fee_collected", "payment_method", "delivery_fee_payment_method", "delivery_latitude", "delivery_longitude", "delivered_at"].includes(r.Field)
  );
  console.log("\n📋 Estructura relevante de delivery_tracking:");
  for (const r of relevant) {
    console.log(`- ${r.Field}: ${r.Type} ${r.Null === "NO" ? "NOT NULL" : "NULL"}`);
  }

  console.log("\n✅ Migración completada.");
}

run()
  .catch((err) => {
    console.error("❌ Error durante la migración:", err && (err.sqlMessage || err.message) || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
