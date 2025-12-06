// Script para asegurar que el ENUM users.role incluye 'empaque' y 'empacador'
// Uso: node backend/scripts/update_users_role_enum_include_empaque.js

const { query } = require('../config/database');

async function main() {
  const [col] = await query("SHOW COLUMNS FROM users LIKE 'role'");
  if (!col || !col.Type) {
    console.log('No se encontró la columna users.role');
    return;
  }
  const type = col.Type; // ej: enum('admin','cartera',...)
  const m = type.match(/^enum\((.*)\)$/i);
  if (!m) {
    console.log('La columna role no es ENUM, omitido. Tipo actual:', type);
    return;
  }
  const rawList = m[1];
  const roles = rawList
    .split(/,(?=(?:[^']*'[^']*')*[^']*$)/)
    .map((s) => s.trim().replace(/^'(.*)'$/, '$1'));

  const required = ['empaque', 'empacador'];
  let changed = false;
  for (const r of required) {
    if (!roles.includes(r)) {
      roles.push(r);
      changed = true;
      console.log(`➕ Agregando rol faltante en ENUM: ${r}`);
    }
  }
  if (!changed) {
    console.log('✅ ENUM ya contiene los roles requeridos. Roles:', roles.join(','));
    return;
  }
  const enumList = roles.map((r) => `'${r.replace(/'/g, "''")}'`).join(',');
  const alter = `ALTER TABLE users MODIFY COLUMN role ENUM(${enumList}) NOT NULL`;
  console.log('🛠️ Ejecutando:', alter);
  await query(alter);
  console.log('✅ ENUM actualizado. Roles:', roles.join(','));
}

main().then(()=>process.exit(0)).catch(err=>{console.error('❌ Error actualizando ENUM:', err);process.exit(1)});
