// Script para agregar 'empacador' al ENUM de users.role si no existe
// Uso: node backend/scripts/add_empacador_role_enum.js

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
  // Separar por comas preservando contenido entre comillas
  const roles = rawList.split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map(s => s.trim().replace(/^'(.*)'$/,'$1'));
  if (roles.includes('empacador')) {
    console.log('✅ "empacador" ya existe en ENUM. Nada que hacer. Lista:', roles.join(','));
    return;
  }
  // Agregar y mantener orden razonable: después de 'empaque' si existe; si no, al final
  const newRoles = roles.slice();
  const idxEmpaque = newRoles.indexOf('empaque');
  if (idxEmpaque >= 0) {
    newRoles.splice(idxEmpaque + 1, 0, 'empacador');
  } else {
    newRoles.push('empacador');
  }
  const enumListSql = newRoles.map(r => `('${r.replace(/'/g, "''")}')`).join(',').replace(/\)\(/g, "','").replace(/^\('/, "'").replace(/'\)$/, "'");
  // La línea anterior compone mal; hagámoslo simple:
  const enumList = newRoles.map(r => `'${r.replace(/'/g, "''")}'`).join(',');

  const alter = `ALTER TABLE users MODIFY COLUMN role ENUM(${enumList}) NOT NULL`;
  console.log('Ejecutando:', alter);
  await query(alter);
  console.log('✅ ENUM actualizado. Roles:', newRoles.join(','));
}

main().then(()=>process.exit(0)).catch(err=>{console.error('❌ Error actualizando ENUM:', err);process.exit(1)});
