#!/usr/bin/env node
/**
 * Lista usuarios elegibles para empaque (por rol simple) o admin.
 * Uso:
 *   node backend/scripts/list_packaging_eligible_users.js
 */
const { query } = require('../config/database');

async function main() {
  try {
    const sql = `
      SELECT id, username, email, role, created_at
      FROM users
      WHERE role IN ('admin','logistica','empaque','empacador','packaging')
      ORDER BY FIELD(role,'admin','logistica','empaque','empacador','packaging'), created_at ASC
      LIMIT 20
    `;
    const rows = await query(sql);
    if (!rows.length) {
      console.log('No se encontraron usuarios con roles admin/logistica/empaque/empacador/packaging.');
      process.exit(0);
    }
    console.table(rows);
    console.log('\nSugerencia: Usa generate_jwt_token.js con un id listado y el role correspondiente.');
    console.log('Ejemplo:\n  node backend/scripts/generate_jwt_token.js <id> <username> <role> ' +
                '[JWT_SECRET] [24h]\n');
  } catch (err) {
    console.error('Error listando usuarios:', err);
    process.exit(1);
  }
}

main();
