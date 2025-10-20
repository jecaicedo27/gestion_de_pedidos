const { query } = require('../backend/config/database');

async function columnExists(table, column) {
  // MariaDB/MySQL no soporta placeholders (?) en algunos comandos SHOW.
  // Sanitizamos nombres (solo alfanumérico y guion bajo) y embebemos el LIKE literal.
  const safeTable = String(table).replace(/[^a-zA-Z0-9_]/g, '');
  const safeColumn = String(column).replace(/[^a-zA-Z0-9_]/g, '');
  const sql = `SHOW COLUMNS FROM \`${safeTable}\` LIKE '${safeColumn}'`;
  const rows = await query(sql);
  return rows.length > 0;
}

async function addColumn(sql) {
  await query(sql);
}

async function run() {
  try {
    console.log('🏦 Migración: agregar columnas de aceptación a cash_register');

    const table = 'cash_register';

    if (!(await columnExists(table, 'status'))) {
      console.log('➕ Agregando columna status...');
      await addColumn(
        `ALTER TABLE \`${table}\`
         ADD COLUMN \`status\` ENUM('pending','collected','discrepancy') NULL DEFAULT 'pending' AFTER notes`
      );
      await addColumn(`ALTER TABLE \`${table}\` ADD INDEX \`idx_status\` (\`status\`)`);
    } else {
      console.log('✔️ Columna status ya existe');
    }

    if (!(await columnExists(table, 'accepted_by'))) {
      console.log('➕ Agregando columna accepted_by...');
      await addColumn(
        `ALTER TABLE \`${table}\`
         ADD COLUMN \`accepted_by\` INT NULL AFTER status,
         ADD CONSTRAINT \`fk_cash_register_accepted_by\` FOREIGN KEY (\`accepted_by\`) REFERENCES users(id)`
      );
    } else {
      console.log('✔️ Columna accepted_by ya existe');
    }

    if (!(await columnExists(table, 'accepted_at'))) {
      console.log('➕ Agregando columna accepted_at...');
      await addColumn(
        `ALTER TABLE \`${table}\`
         ADD COLUMN \`accepted_at\` DATETIME NULL AFTER accepted_by`
      );
      await addColumn(`ALTER TABLE \`${table}\` ADD INDEX \`idx_accepted_at\` (\`accepted_at\`)`);
    } else {
      console.log('✔️ Columna accepted_at ya existe');
    }

    if (!(await columnExists(table, 'accepted_amount'))) {
      console.log('➕ Agregando columna accepted_amount...');
      await addColumn(
        `ALTER TABLE \`${table}\`
         ADD COLUMN \`accepted_amount\` DECIMAL(10,2) NULL AFTER accepted_at`
      );
    } else {
      console.log('✔️ Columna accepted_amount ya existe');
    }

    if (!(await columnExists(table, 'acceptance_notes'))) {
      console.log('➕ Agregando columna acceptance_notes...');
      await addColumn(
        `ALTER TABLE \`${table}\`
         ADD COLUMN \`acceptance_notes\` TEXT NULL AFTER accepted_amount`
      );
    } else {
      console.log('✔️ Columna acceptance_notes ya existe');
    }

    console.log('✅ Migración completada: columnas de aceptación listas en cash_register');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración cash_register:', err.message);
    process.exit(1);
  }
}

run();
