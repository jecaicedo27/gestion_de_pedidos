const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

(async () => {
  console.log('🔧 Fix: delivery_evidence schema');
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    multipleStatements: true
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log(`✅ Connected to MySQL DB: ${config.database}\n`);

    // Ensure delivery_tracking table exists with minimal/expected structure
    console.log('🔎 Ensuring delivery_tracking table exists...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_tracking (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        messenger_id INT NOT NULL,
        assigned_at TIMESTAMP NULL,
        accepted_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        started_delivery_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        failed_at TIMESTAMP NULL,
        rejection_reason TEXT NULL,
        failure_reason TEXT NULL,
        delivery_notes TEXT NULL,
        payment_collected DECIMAL(10,2) DEFAULT 0.00,
        delivery_fee_collected DECIMAL(10,2) DEFAULT 0.00,
        payment_method ENUM('efectivo','transferencia','tarjeta') NULL,
        delivery_latitude DECIMAL(10,8) NULL,
        delivery_longitude DECIMAL(11,8) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_messenger (order_id, messenger_id),
        INDEX idx_messenger_status (messenger_id, assigned_at),
        INDEX idx_delivery_date (delivered_at)
      )
    `);
    console.log('✅ delivery_tracking OK');

    // Check current columns for delivery_evidence
    console.log('\n🔎 Inspecting delivery_evidence columns...');
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'delivery_evidence'`,
      [config.database]
    );

    if (!cols.length) {
      console.log('⚠️ Table delivery_evidence not found. Creating with expected schema...');
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS delivery_evidence (
          id INT PRIMARY KEY AUTO_INCREMENT,
          delivery_tracking_id INT NULL,
          order_id INT NOT NULL,
          messenger_id INT NOT NULL,
          photo_filename VARCHAR(255) NOT NULL,
          photo_path VARCHAR(500) NOT NULL,
          photo_size INT NULL,
          photo_type VARCHAR(50) NULL,
          description TEXT NULL,
          taken_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_evidence (order_id),
          INDEX idx_messenger_evidence (messenger_id),
          INDEX idx_tracking_evidence (delivery_tracking_id)
        )
      `);
      console.log('✅ delivery_evidence created');
    } else {
      const colSet = new Set(cols.map(r => r.COLUMN_NAME));

      // Add core photo columns if missing
      if (!colSet.has('photo_filename')) {
        console.log('➕ Adding column photo_filename VARCHAR(255) NOT NULL AFTER messenger_id...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN photo_filename VARCHAR(255) NOT NULL AFTER messenger_id`);
        colSet.add('photo_filename');
      } else {
        console.log('✅ Column photo_filename present');
      }

      if (!colSet.has('photo_path')) {
        const after = colSet.has('photo_filename') ? ' AFTER photo_filename' : '';
        console.log('➕ Adding column photo_path VARCHAR(500) NOT NULL' + (after || ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN photo_path VARCHAR(500) NOT NULL${after}`);
        colSet.add('photo_path');
      } else {
        console.log('✅ Column photo_path present');
      }

      if (!colSet.has('photo_size')) {
        const after = colSet.has('photo_path') ? ' AFTER photo_path' : '';
        console.log('➕ Adding column photo_size INT NULL' + (after || ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN photo_size INT NULL${after}`);
        colSet.add('photo_size');
      } else {
        console.log('✅ Column photo_size present');
      }

      if (!colSet.has('photo_type')) {
        const after = colSet.has('photo_size') ? ' AFTER photo_size' : '';
        console.log('➕ Adding column photo_type VARCHAR(50) NULL' + (after || ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN photo_type VARCHAR(50) NULL${after}`);
        colSet.add('photo_type');
      } else {
        console.log('✅ Column photo_type present');
      }

      // delivery_tracking_id
      if (!colSet.has('delivery_tracking_id')) {
        console.log('➕ Adding column delivery_tracking_id INT NULL...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN delivery_tracking_id INT NULL AFTER messenger_id`);
        colSet.add('delivery_tracking_id');
      } else {
        console.log('✅ Column delivery_tracking_id present');
      }

      // description
      if (!colSet.has('description')) {
        const after = colSet.has('photo_type') ? ' AFTER photo_type' : (colSet.has('photo_size') ? ' AFTER photo_size' : '');
        console.log('➕ Adding column description TEXT NULL' + (after ? after : ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN description TEXT NULL${after}`);
        colSet.add('description');
      } else {
        console.log('✅ Column description present');
      }

      // taken_at
      if (!colSet.has('taken_at')) {
        const after = colSet.has('description') ? ' AFTER description' : '';
        console.log('➕ Adding column taken_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' + (after ? after : ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN taken_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP${after}`);
        colSet.add('taken_at');
      } else {
        console.log('✅ Column taken_at present');
      }

      // upload_at
      if (!colSet.has('upload_at')) {
        const after = colSet.has('taken_at') ? ' AFTER taken_at' : '';
        console.log('➕ Adding column upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' + (after ? after : ' (at end)') + '...');
        await conn.execute(`ALTER TABLE delivery_evidence ADD COLUMN upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP${after}`);
        colSet.add('upload_at');
      } else {
        console.log('✅ Column upload_at present');
      }

      // Ensure indexes
      console.log('🔎 Ensuring indexes...');
      try {
        await conn.execute(`CREATE INDEX idx_tracking_evidence ON delivery_evidence(delivery_tracking_id)`);
        console.log('✅ idx_tracking_evidence created');
      } catch (e) {
        console.log('ℹ️ idx_tracking_evidence may already exist');
      }
      try {
        await conn.execute(`CREATE INDEX idx_order_evidence ON delivery_evidence(order_id)`);
        console.log('✅ idx_order_evidence created/exists');
      } catch (e) {
        console.log('ℹ️ idx_order_evidence may already exist');
      }
      try {
        await conn.execute(`CREATE INDEX idx_messenger_evidence ON delivery_evidence(messenger_id)`);
        console.log('✅ idx_messenger_evidence created/exists');
      } catch (e) {
        console.log('ℹ️ idx_messenger_evidence may already exist');
      }
    }

    // Ensure foreign key for delivery_tracking_id (if not present)
    console.log('\n🔎 Checking FK for delivery_tracking_id...');
    const [fkRows] = await conn.execute(
      `
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'delivery_evidence'
        AND COLUMN_NAME = 'delivery_tracking_id'
        AND REFERENCED_TABLE_NAME = 'delivery_tracking'
      `,
      [config.database]
    );

    if (!fkRows.length) {
      console.log('➕ Adding FK fk_delivery_evidence_tracking -> delivery_tracking(id)...');
      try {
        await conn.execute(`
          ALTER TABLE delivery_evidence
          ADD CONSTRAINT fk_delivery_evidence_tracking
          FOREIGN KEY (delivery_tracking_id)
          REFERENCES delivery_tracking(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
        `);
        console.log('✅ FK added');
      } catch (e) {
        console.warn('⚠️ Could not add FK (will proceed):', e.message);
      }
    } else {
      console.log('✅ FK for delivery_tracking_id already present');
    }

    console.log('\n🎉 Fix complete. You can retry uploading evidence now.');
  } catch (err) {
    console.error('❌ Error fixing schema:', err.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
