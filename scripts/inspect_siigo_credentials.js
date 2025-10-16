#!/usr/bin/env node
/**
 * Script: Inspecta cómo están guardadas las credenciales SIIGO
 * - Lee la fila más reciente de siigo_credentials
 * - Detecta si la access_key está cifrada (JSON con {encrypted, iv, authTag}) o en texto plano
 * - Intenta descifrar con configService si está cifrada
 * - Muestra un preview seguro (enmascarado)
 * - También revisa system_config para claves legacy (siigo_username, siigo_access_key)
 */
const path = require('path');
const { pool } = require('../backend/config/database');
const configService = require('../backend/services/configService');

function mask(value, start = 4, end = 4) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= start + end) return '*'.repeat(Math.max(0, value.length - 1));
  return value.slice(0, start) + '***' + value.slice(-end);
}

async function main() {
  try {
    const [rows] = await pool.execute(`
      SELECT id, company_id, siigo_username, siigo_access_key, siigo_base_url, is_enabled, created_at, updated_at
      FROM siigo_credentials
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 3
    `);

    const result = {
      siigo_credentials: [],
      system_config: []
    };

    for (const row of rows) {
      const entry = {
        id: row.id,
        company_id: row.company_id,
        siigo_username: row.siigo_username,
        siigo_base_url: row.siigo_base_url,
        is_enabled: !!row.is_enabled,
        created_at: row.created_at,
        updated_at: row.updated_at,
        access_key: {
          storage: 'unknown',
          decryptable: false,
          preview: null,
          length: null
        }
      };

      const raw = row.siigo_access_key;
      entry.access_key.length = raw ? String(raw).length : 0;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.encrypted && parsed.iv && parsed.authTag) {
          entry.access_key.storage = 'encrypted(json)';
          try {
            const decrypted = configService.decrypt(parsed);
            entry.access_key.decryptable = true;
            entry.access_key.preview = mask(decrypted, 6, 4);
          } catch (e) {
            entry.access_key.decryptable = false;
            entry.access_key.preview = '(decrypt failed)';
          }
        } else {
          // JSON válido pero no de nuestro formato de cifrado
          entry.access_key.storage = 'json(unknown-format)';
          entry.access_key.preview = mask(String(raw), 6, 4);
        }
      } catch {
        // No es JSON: texto plano
        entry.access_key.storage = 'plaintext';
        entry.access_key.preview = mask(String(raw), 6, 4);
      }

      result.siigo_credentials.push(entry);
    }

    // Revisar system_config legacy
    const [cfg] = await pool.execute(`
      SELECT config_key, config_value, updated_at
      FROM system_config
      WHERE config_key IN ('siigo_username', 'siigo_access_key')
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    for (const c of cfg) {
      const row = {
        key: c.config_key,
        updated_at: c.updated_at,
        value: {
          storage: 'unknown',
          preview: null,
          length: c.config_value ? String(c.config_value).length : 0
        }
      };

      const raw = c.config_value;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.encrypted && parsed.iv && parsed.authTag) {
          row.value.storage = 'encrypted(json)';
          try {
            const decrypted = configService.decrypt(parsed);
            row.value.preview = mask(decrypted, 6, 4);
          } catch {
            row.value.preview = '(decrypt failed)';
          }
        } else {
          row.value.storage = 'json(unknown-format)';
          row.value.preview = mask(String(raw), 6, 4);
        }
      } catch {
        row.value.storage = 'plaintext';
        row.value.preview = mask(String(raw), 6, 4);
      }

      result.system_config.push(row);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERR:', e.message || e);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch {}
  }
}

main();
