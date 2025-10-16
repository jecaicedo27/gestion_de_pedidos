#!/usr/bin/env node
/**
 * Migra claves sensibles en system_config a formato cifrado (AES-256-GCM)
 * - siigo_username
 * - siigo_access_key
 * - wapify_api_token (si aplica)
 *
 * Requisitos:
 * - Definir CONFIG_ENCRYPTION_KEY (hex de 64 chars) para que el cifrado sea consistente
 * - La app en producción ya exige CONFIG_ENCRYPTION_KEY (configService)
 */
const { pool } = require('../backend/config/database');
const configService = require('../backend/services/configService');

function isEncryptedJSON(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.encrypted && parsed.iv && parsed.authTag;
  } catch {
    return false;
  }
}

async function getSystemConfig(key) {
  const [rows] = await pool.execute(
    'SELECT config_key, config_value, updated_at FROM system_config WHERE config_key = ? LIMIT 1',
    [key]
  );
  return rows && rows.length ? rows[0] : null;
}

async function migrateKey(key, description) {
  const row = await getSystemConfig(key);
  if (!row) {
    return { key, status: 'missing', message: 'No existe en system_config' };
  }

  const raw = row.config_value;
  if (isEncryptedJSON(raw)) {
    return { key, status: 'already_encrypted', message: 'Ya está cifrado' };
  }

  // Guardar cifrado usando configService (upsert)
  await configService.setSecureConfig(key, raw, description);

  // Verificar
  const after = await getSystemConfig(key);
  const ok = after && isEncryptedJSON(after.config_value);
  return {
    key,
    status: ok ? 'migrated' : 'failed',
    message: ok ? 'Cifrado y actualizado' : 'No se pudo confirmar cifrado'
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`🔐 Iniciando migración de system_config (inicio: ${startedAt})`);

  const keys = [
    { key: 'siigo_username', description: 'Usuario API SIIGO' },
    { key: 'siigo_access_key', description: 'Access Key API SIIGO' },
    { key: 'wapify_api_token', description: 'Token API Wapify' }
  ];

  const results = [];
  for (const k of keys) {
    try {
      const res = await migrateKey(k.key, k.description);
      console.log(`- ${k.key}: ${res.status} (${res.message})`);
      results.push(res);
    } catch (e) {
      console.error(`❌ Error migrando ${k.key}:`, e.message);
      results.push({ key: k.key, status: 'error', message: e.message });
    }
  }

  const finishedAt = new Date().toISOString();
  console.log(`✅ Migración terminada (fin: ${finishedAt})`);
  console.log(JSON.stringify({ startedAt, finishedAt, results }, null, 2));

  try { await pool.end(); } catch {}
}

main().catch(err => {
  console.error('❌ Error en migración:', err.message || err);
  process.exitCode = 1;
});
