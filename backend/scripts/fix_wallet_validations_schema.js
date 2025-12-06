const { query, poolEnd } = require('../config/database');

async function ensureOrdersColumns() {
  console.log('🔎 Verificando columnas en orders...');
  // validation_status
  const valStatus = await query(`SHOW COLUMNS FROM orders LIKE 'validation_status'`);
  if (!valStatus.length) {
    console.log('➕ Agregando columna orders.validation_status');
    await query(`
      ALTER TABLE orders 
      ADD COLUMN validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
    `);
  } else {
    console.log('✅ orders.validation_status OK');
  }

  // validation_notes
  const valNotes = await query(`SHOW COLUMNS FROM orders LIKE 'validation_notes'`);
  if (!valNotes.length) {
    console.log('➕ Agregando columna orders.validation_notes');
    await query(`
      ALTER TABLE orders 
      ADD COLUMN validation_notes TEXT
    `);
  } else {
    console.log('✅ orders.validation_notes OK');
  }

  // electronic_payment_type
  const ept = await query(`SHOW COLUMNS FROM orders LIKE 'electronic_payment_type'`);
  if (!ept.length) {
    console.log('➕ Agregando columna orders.electronic_payment_type');
    await query(`
      ALTER TABLE orders 
      ADD COLUMN electronic_payment_type VARCHAR(50) DEFAULT NULL
    `);
  } else {
    console.log('✅ orders.electronic_payment_type OK');
  }

  // electronic_payment_notes
  const epn = await query(`SHOW COLUMNS FROM orders LIKE 'electronic_payment_notes'`);
  if (!epn.length) {
    console.log('➕ Agregando columna orders.electronic_payment_notes');
    await query(`
      ALTER TABLE orders 
      ADD COLUMN electronic_payment_notes VARCHAR(255) DEFAULT NULL
    `);
  } else {
    console.log('✅ orders.electronic_payment_notes OK');
  }
}

async function normalizeExistingWalletValidations() {
  console.log('\n🧹 Normalizando valores existentes en wallet_validations...');

  // Mapear valores conocidos a los canónicos antes de cambiar a ENUM
  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'pago_electronico' 
    WHERE payment_method IN ('pago_electronico','pago_electrónico','electronico','electrónico','Pago electrónico','Pago_electronico','pago electronico')
  `);

  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'cliente_credito' 
    WHERE payment_method IN ('cliente_credito','credito','crédito','cliente credito','cliente_crédito')
  `);

  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'tarjeta_credito' 
    WHERE payment_method IN ('tarjeta','tarjeta_credito','tarjeta_crédito','tarjeta credito')
  `);

  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'transferencia' 
    WHERE payment_method IN ('transferencia','transfer','transf','bancolombia')
  `);

  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'efectivo' 
    WHERE payment_method IN ('efectivo','cash')
  `);

  // Fallback: cualquier valor desconocido, vacío o nulo -> 'efectivo'
  await query(`
    UPDATE wallet_validations 
    SET payment_method = 'efectivo'
    WHERE payment_method IS NULL 
       OR TRIM(payment_method) = '' 
       OR payment_method NOT IN ('efectivo','transferencia','pago_electronico','tarjeta_credito','cliente_credito')
  `);

  // Normalizar validation_type a ['approved','rejected']
  await query(`
    UPDATE wallet_validations 
    SET validation_type = CASE 
      WHEN validation_status = 'rejected' THEN 'rejected' 
      ELSE 'approved' 
    END
    WHERE validation_type IS NULL 
       OR TRIM(validation_type) = '' 
       OR validation_type NOT IN ('approved','rejected') 
       OR validation_type IN ('payment_proof','credit_check','cash_verification')
  `);

  console.log('✅ Normalización de datos completada');
}

async function ensureWalletValidationsTable() {
  console.log('\n🔎 Verificando tabla wallet_validations...');
  const table = await query(`SHOW TABLES LIKE 'wallet_validations'`);
  if (!table.length) {
    console.log('🆕 Creando tabla wallet_validations con el esquema esperado');
    await query(`
      CREATE TABLE IF NOT EXISTS wallet_validations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_method ENUM('efectivo', 'transferencia', 'pago_electronico', 'tarjeta_credito', 'cliente_credito') NOT NULL,
        validation_type ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
        payment_proof_image VARCHAR(500),
        payment_reference VARCHAR(100),
        payment_amount DECIMAL(10,2),
        payment_date DATE,
        bank_name VARCHAR(100),
        customer_credit_limit DECIMAL(12,2),
        customer_current_balance DECIMAL(12,2),
        credit_approved BOOLEAN DEFAULT FALSE,
        validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        validation_notes TEXT,
        validated_by INT,
        validated_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (validated_by) REFERENCES users(id),
        INDEX idx_order_id (order_id),
        INDEX idx_payment_method (payment_method),
        INDEX idx_validation_status (validation_status),
        INDEX idx_validated_at (validated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla wallet_validations creada');
    return;
  }

  // Column: payment_method
  const pmCol = await query(`SHOW COLUMNS FROM wallet_validations LIKE 'payment_method'`);
  if (!pmCol.length) {
    console.log('➕ Agregando columna wallet_validations.payment_method');
    await query(`
      ALTER TABLE wallet_validations 
      ADD COLUMN payment_method ENUM('efectivo', 'transferencia', 'pago_electronico', 'tarjeta_credito', 'cliente_credito') NOT NULL
      AFTER order_id
    `);
  } else {
    const type = pmCol[0].Type || '';
    const needsPagoElectronico = !type.includes('pago_electronico');
    const needsTarjeta = !type.includes('tarjeta_credito');
    const needsClienteCredito = !type.includes('cliente_credito');
    const needsTransferencia = !type.includes('transferencia');
    const needsEfectivo = !type.includes('efectivo');
    if (needsPagoElectronico || needsTarjeta || needsClienteCredito || needsTransferencia || needsEfectivo) {
      console.log(`🛠️ Ajustando ENUM de wallet_validations.payment_method (actual: ${type})`);
      // Normalizar datos existentes para evitar truncamientos al convertir a ENUM
      await normalizeExistingWalletValidations();
      await query(`
        ALTER TABLE wallet_validations 
        MODIFY COLUMN payment_method ENUM('efectivo', 'transferencia', 'pago_electronico', 'tarjeta_credito', 'cliente_credito') NOT NULL
      `);
      console.log('✅ ENUM actualizado para payment_method');
    } else {
      console.log('✅ wallet_validations.payment_method OK');
    }
  }

  // Column: validation_type
  const vtCol = await query(`SHOW COLUMNS FROM wallet_validations LIKE 'validation_type'`);
  if (!vtCol.length) {
    console.log('➕ Agregando columna wallet_validations.validation_type');
    await query(`
      ALTER TABLE wallet_validations 
      ADD COLUMN validation_type ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved'
      AFTER payment_method
    `);
  } else {
    const type = vtCol[0].Type || '';
    if (!(type.includes('approved') && type.includes('rejected')) || type.includes('payment_proof') || type.includes('credit_check') || type.includes('cash_verification')) {
      console.log(`🛠️ Ajustando ENUM de wallet_validations.validation_type (actual: ${type})`);
      // Normalizar datos existentes antes de convertir a ENUM definitivo
      await normalizeExistingWalletValidations();
      await query(`
        ALTER TABLE wallet_validations 
        MODIFY COLUMN validation_type ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved'
      `);
      console.log('✅ ENUM actualizado para validation_type');
    } else {
      console.log('✅ wallet_validations.validation_type OK');
    }
  }

  // Column: validation_status
  const vsCol = await query(`SHOW COLUMNS FROM wallet_validations LIKE 'validation_status'`);
  if (!vsCol.length) {
    console.log('➕ Agregando columna wallet_validations.validation_status');
    await query(`
      ALTER TABLE wallet_validations 
      ADD COLUMN validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
      AFTER credit_approved
    `);
  } else {
    const type = vsCol[0].Type || '';
    if (!(type.includes('pending') && type.includes('approved') && type.includes('rejected'))) {
      console.log(`🛠️ Ajustando ENUM de wallet_validations.validation_status (actual: ${type})`);
      await query(`
        ALTER TABLE wallet_validations 
        MODIFY COLUMN validation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
      `);
      console.log('✅ ENUM actualizado para validation_status');
    } else {
      console.log('✅ wallet_validations.validation_status OK');
    }
  }

  // Widen payment_proof_image if necessary
  const ppiCol = await query(`SHOW COLUMNS FROM wallet_validations LIKE 'payment_proof_image'`);
  if (ppiCol.length && /varchar\((\d+)\)/i.test(ppiCol[0].Type)) {
    const m = ppiCol[0].Type.match(/varchar\((\d+)\)/i);
    const size = m ? parseInt(m[1], 10) : 255;
    if (size < 500) {
      console.log('🛠️ Ampliando wallet_validations.payment_proof_image a VARCHAR(500)');
      await query(`
        ALTER TABLE wallet_validations 
        MODIFY COLUMN payment_proof_image VARCHAR(500)
      `);
    }
  }
}

async function main() {
  try {
    console.log('🚀 Fix schema wallet_validations & orders');
    await ensureOrdersColumns();
    await ensureWalletValidationsTable();
    console.log('\n🎉 Esquema verificado/ajustado correctamente.');
  } catch (err) {
    console.error('❌ Error ajustando esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await poolEnd();
  }
}

main();
