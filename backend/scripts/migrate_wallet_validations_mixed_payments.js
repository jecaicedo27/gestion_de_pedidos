#!/usr/bin/env node
/**
 * Migración segura: soporte de pagos mixtos en wallet_validations
 * - payment_type ENUM('single','mixed') DEFAULT 'single'
 * - transferred_amount DECIMAL(10,2) NULL
 * - cash_amount DECIMAL(10,2) NULL
 * - cash_proof_image VARCHAR(255) NULL
 */
const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

async function columnExists(connection, table, column) {
  // Evitar placeholders en SHOW/LIMIT para compatibilidad con MariaDB
  const safeCol = String(column).replace(/`/g, '');
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${safeCol}'`);
  return rows.length > 0;
}

async function run() {
  let connection;
  try {
    console.log('🚀 Migrando tabla wallet_validations para pagos mixtos...');
    connection = await pool.getConnection();

    const table = 'wallet_validations';

    const hasPaymentType = await columnExists(connection, table, 'payment_type');
    const hasTransferred = await columnExists(connection, table, 'transferred_amount');
    const hasCash = await columnExists(connection, table, 'cash_amount');
    const hasCashProof = await columnExists(connection, table, 'cash_proof_image');

    if (!hasPaymentType) {
      console.log('➕ Agregando columna payment_type...');
      await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN payment_type ENUM('single','mixed') NULL DEFAULT 'single' AFTER bank_name`);
    } else {
      // Asegurar ENUM correcto (por seguridad, cambiar a ENUM requerido)
      const [desc] = await connection.execute(`SHOW COLUMNS FROM \`${table}\` LIKE 'payment_type'`);
      const type = (desc[0] && desc[0].Type) || '';
      if (!/enum\('single','mixed'\)/i.test(type)) {
        console.log('🛠️ Ajustando ENUM de payment_type a (single,mixed)...');
        await connection.execute(`ALTER TABLE \`${table}\` MODIFY COLUMN payment_type ENUM('single','mixed') NULL DEFAULT 'single'`);
      }
    }

    if (!hasTransferred) {
      console.log('➕ Agregando columna transferred_amount...');
      await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN transferred_amount DECIMAL(10,2) NULL AFTER payment_type`);
    }

    if (!hasCash) {
      console.log('➕ Agregando columna cash_amount...');
      await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN cash_amount DECIMAL(10,2) NULL AFTER transferred_amount`);
    }

    if (!hasCashProof) {
      console.log('➕ Agregando columna cash_proof_image...');
      await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN cash_proof_image VARCHAR(255) NULL AFTER cash_amount`);
    }

    console.log('✅ Migración completada.');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
  }
}

run();
