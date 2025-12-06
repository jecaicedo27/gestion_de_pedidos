#!/usr/bin/env node
/**
 * Migración inicial Postventa:
 * Crea tablas base para encuestas, tickets, perfiles cliente, interacciones,
 * segmentación, campañas, journeys, plantillas, fidelización, referidos, riesgo,
 * auditoría y outbox de eventos.
 *
 * Ejecución:
 *   node backend/scripts/migrations_postventa/create_postventa_tables.js
 */
const { query } = require('../../config/database');

async function createTable(name, sql) {
  console.log(`🛠  Creando tabla ${name} si no existe...`);
  await query(sql, []);
  console.log(`✅ Tabla ${name} lista`);
}

(async () => {
  try {
    // 1) customer_profiles
    await createTable('customer_profiles', `
      CREATE TABLE IF NOT EXISTS customer_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        rfm_recency INT NULL,
        rfm_frequency INT NULL,
        rfm_monetary DECIMAL(12,2) NULL,
        rfm_segment ENUM('champion','leal','potencial','en_riesgo','dormido','nuevo') NULL,
        value_score DECIMAL(5,2) NULL,
        risk_score DECIMAL(5,2) NULL,
        avg_order_value DECIMAL(12,2) NULL,
        returns_rate DECIMAL(5,2) NULL,
        complaints_count INT NULL,
        last_order_at DATETIME NULL,
        attributes LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_customer_profiles_customer (customer_id),
        INDEX idx_rfm_segment (rfm_segment),
        INDEX idx_risk_score (risk_score),
        INDEX idx_value_score (value_score)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2) customer_consents
    await createTable('customer_consents', `
      CREATE TABLE IF NOT EXISTS customer_consents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        channel ENUM('whatsapp','sms','email') NOT NULL,
        scope ENUM('transaccional','marketing','todos') NOT NULL,
        opt_in_at DATETIME NULL,
        opt_out_at DATETIME NULL,
        source VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_consents (customer_id, channel, scope),
        INDEX idx_customer (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3) customer_interactions
    await createTable('customer_interactions', `
      CREATE TABLE IF NOT EXISTS customer_interactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        order_id INT NULL,
        channel ENUM('whatsapp','sms','email','telefono','interno') NOT NULL,
        direction ENUM('incoming','outgoing') NOT NULL,
        template_key VARCHAR(100) NULL,
        content LONGTEXT NULL,
        metadata LONGTEXT NULL, -- JSON
        status ENUM('sent','delivered','failed','read','responded') NULL,
        user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_created (customer_id, created_at),
        INDEX idx_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4) tickets
    await createTable('tickets', `
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        order_id INT NULL,
        source ENUM('nps','logistica','cartera','manual','otros') NOT NULL,
        category ENUM('entrega','producto','pago','atencion','otros') NOT NULL,
        status ENUM('nuevo','en_progreso','esperando_cliente','resuelto','escalado','cerrado') NOT NULL DEFAULT 'nuevo',
        priority ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
        sla_due_at DATETIME NULL,
        assignee_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_sla (sla_due_at),
        INDEX idx_customer (customer_id),
        INDEX idx_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5) ticket_updates
    await createTable('ticket_updates', `
      CREATE TABLE IF NOT EXISTS ticket_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        user_id INT NULL,
        note LONGTEXT NULL,
        attachments LONGTEXT NULL, -- JSON
        prev_status VARCHAR(50) NULL,
        new_status VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6) surveys
    await createTable('surveys', `
      CREATE TABLE IF NOT EXISTS surveys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        order_id INT NOT NULL,
        channel ENUM('whatsapp','sms','email') NOT NULL,
        nps TINYINT NULL,
        csat TINYINT NULL,
        ces TINYINT NULL,
        comment LONGTEXT NULL,
        attributes LONGTEXT NULL, -- JSON
        sent_at DATETIME NOT NULL,
        responded_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order (order_id),
        INDEX idx_responded (responded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7) segments
    await createTable('segments', `
      CREATE TABLE IF NOT EXISTS segments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        rule_json LONGTEXT NOT NULL, -- JSON
        is_dynamic TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_segment_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable('segment_members', `
      CREATE TABLE IF NOT EXISTS segment_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        segment_id INT NOT NULL,
        customer_id INT NOT NULL,
        computed_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_segment_member (segment_id, customer_id),
        INDEX idx_segment (segment_id),
        INDEX idx_customer (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8) campaigns
    await createTable('campaigns', `
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('broadcast','triggered') NOT NULL,
        template_id INT NOT NULL,
        segment_id INT NULL,
        status ENUM('draft','scheduled','running','paused','finished') NOT NULL DEFAULT 'draft',
        scheduled_at DATETIME NULL,
        name VARCHAR(120) NOT NULL,
        metadata LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_scheduled (scheduled_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable('campaign_logs', `
      CREATE TABLE IF NOT EXISTS campaign_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        customer_id INT NOT NULL,
        channel ENUM('whatsapp','sms','email') NOT NULL,
        status ENUM('sent','delivered','failed','clicked','responded') NOT NULL,
        metadata LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_campaign (campaign_id),
        INDEX idx_customer (customer_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9) journeys
    await createTable('journeys', `
      CREATE TABLE IF NOT EXISTS journeys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        definition_json LONGTEXT NOT NULL, -- JSON
        active TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_journey_name (name),
        INDEX idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable('journey_executions', `
      CREATE TABLE IF NOT EXISTS journey_executions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        journey_id INT NOT NULL,
        customer_id INT NOT NULL,
        state ENUM('waiting','executing','paused','completed','cancelled') NOT NULL DEFAULT 'waiting',
        step_index INT NOT NULL DEFAULT 0,
        last_event_at DATETIME NULL,
        metadata LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_journey_state (journey_id, state),
        INDEX idx_customer_state (customer_id, state)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10) templates
    await createTable('templates', `
      CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel ENUM('whatsapp','sms','email') NOT NULL,
        template_key VARCHAR(100) NOT NULL,
        content LONGTEXT NOT NULL,
        variables LONGTEXT NULL, -- JSON
        approved TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_template_key (template_key),
        INDEX idx_channel (channel),
        INDEX idx_approved (approved)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11) loyalty_points
    await createTable('loyalty_points', `
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        balance INT NOT NULL DEFAULT 0,
        level ENUM('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_loyalty_customer (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable('loyalty_movements', `
      CREATE TABLE IF NOT EXISTS loyalty_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        points INT NOT NULL,
        reason ENUM('purchase','feedback','referral','adjustment') NOT NULL,
        order_id INT NULL,
        meta LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customer (customer_id),
        INDEX idx_order (order_id),
        INDEX idx_reason (reason)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12) referrals
    await createTable('referrals', `
      CREATE TABLE IF NOT EXISTS referrals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        referrer_customer_id INT NOT NULL,
        referred_customer_id INT NULL,
        code VARCHAR(20) NOT NULL,
        state ENUM('generated','registered','first_purchase','rewarded','cancelled') NOT NULL DEFAULT 'generated',
        reward_points INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_referral_code (code),
        INDEX idx_referrer (referrer_customer_id),
        INDEX idx_referred (referred_customer_id),
        INDEX idx_state (state)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 13) churn_risk
    await createTable('churn_risk', `
      CREATE TABLE IF NOT EXISTS churn_risk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        score DECIMAL(5,2) NOT NULL,
        features_json LONGTEXT NULL, -- JSON
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_churn_customer (customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 14) audit_logs
    await createTable('audit_logs', `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity VARCHAR(60) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(60) NOT NULL,
        user_id INT NULL,
        meta LONGTEXT NULL, -- JSON
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entity, entity_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 15) postventa_events (outbox)
    await createTable('postventa_events', `
      CREATE TABLE IF NOT EXISTS postventa_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        payload LONGTEXT NULL, -- JSON
        processed TINYINT(1) NOT NULL DEFAULT 0,
        processed_at DATETIME NULL,
        retries INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type_processed (event_type, processed),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('🎯 Migración Postventa completada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración Postventa:', err);
    process.exit(1);
  }
})();
