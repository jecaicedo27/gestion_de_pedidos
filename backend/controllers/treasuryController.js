const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query, transaction } = require('../config/database');

// Storage para evidencias de consignaciones
const depositStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/deposits');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, `deposit-${uniqueSuffix}${ext}`);
  }
});

const uploadDeposit = multer({
  storage: depositStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Permitir imágenes y PDFs para evidencia
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('Solo imágenes o PDF como evidencia'), ok);
  }
});

/**
 * POST /api/cartera/deposits - Registrar consignación bancaria
 * Ahora acepta campo "details" (JSON en multipart) con [{ order_id, assigned_amount }, ...]
 * para cruzar el depósito contra facturas, validando tolerancia configurable.
 */
const createDeposit = async (req, res) => {
  try {
    const { amount, bank_name, reference_number, reason_code, reason_text, deposited_at, notes } = req.body || {};
    const userId = req.user?.id || null;

    const amt = Number(amount);
    if (!(amt > 0)) {
      return res.status(400).json({ success: false, message: 'Monto inválido' });
    }

    // Parsear detalles (cruce con facturas) desde multipart (string JSON) o objeto
    let details = [];
    try {
      const raw = req.body?.details;
      if (raw) {
        details = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      if (!Array.isArray(details)) details = [];
    } catch (_) {
      details = [];
    }
    details = details
      .map(d => ({
        order_id: Number(d.order_id),
        assigned_amount: Number(d.assigned_amount)
      }))
      .filter(d => d.order_id && d.assigned_amount > 0);

    // Tolerancia configurable (default 300)
    let tolerance = 300;
    try {
      const cfg = await query(`SELECT config_value FROM system_config WHERE config_key = 'cartera_deposit_tolerance' LIMIT 1`);
      if (cfg && cfg.length) tolerance = Number(cfg[0].config_value || 300) || 300;
    } catch (e) { }

    const assignedTotal = details.reduce((s, d) => s + Number(d.assigned_amount || 0), 0);
    const difference = Math.abs(amt - assignedTotal);

    // Si hay detalles, validar que la diferencia esté dentro de tolerancia
    if (details.length > 0 && difference > tolerance) {
      return res.status(400).json({
        success: false,
        message: `La suma asignada a facturas (${assignedTotal.toLocaleString('es-CO')}) difiere del monto consignado (${amt.toLocaleString('es-CO')}) por ${difference.toLocaleString('es-CO')} y supera la tolerancia (${tolerance}).`
      });
    }

    const file = req.file || null;
    const evidenceFile = file ? file.filename : null;

    const depositedAtSql = deposited_at ? new Date(deposited_at) : new Date();

    // Validar duplicados recientes (2 minutos) para evitar doble clic
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const duplicates = await query(
      `SELECT id FROM cartera_deposits 
       WHERE amount = ? 
         AND (bank_name = ? OR (bank_name IS NULL AND ? IS NULL))
         AND (reference_number = ? OR (reference_number IS NULL AND ? IS NULL))
         AND deposited_by = ?
         AND created_at >= ?
       LIMIT 1`,
      [amt, bank_name || null, bank_name || null, reference_number || null, reference_number || null, userId, twoMinutesAgo]
    );

    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una consignación idéntica registrada hace menos de 2 minutos. Por favor verifica si ya se guardó.'
      });
    }

    // Transacción: insertar cabecera y detalles
    const depositId = await transaction(async (conn) => {
      const [ins] = await conn.execute(
        `INSERT INTO cartera_deposits (amount, bank_name, reference_number, reason_code, reason_text, evidence_file, notes, deposited_by, deposited_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [amt, bank_name || null, reference_number || null, reason_code || null, reason_text || null, evidenceFile, notes || null, userId, depositedAtSql]
      );
      const newId = ins.insertId;

      if (details.length) {
        for (const d of details) {
          await conn.execute(
            `INSERT INTO cartera_deposit_details (deposit_id, order_id, assigned_amount)
             VALUES (?, ?, ?)`,
            [newId, d.order_id, d.assigned_amount]
          );
        }
      }

      return newId;
    });

    return res.json({
      success: true,
      message: 'Depósito registrado',
      data: { id: depositId, assigned_total: assignedTotal, tolerance, difference }
    });
  } catch (error) {
    console.error('Error creando depósito:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /api/cartera/deposits - Listar consignaciones (opcional rango)
const listDeposits = async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const where = [];
    const params = [];
    if (from) { where.push('DATE(deposited_at) >= ?'); params.push(from.slice(0, 10)); }
    if (to) { where.push('DATE(deposited_at) <= ?'); params.push(to.slice(0, 10)); }

    const rows = await query(
      `SELECT id, amount, bank_name, reference_number, reason_code, reason_text, evidence_file, notes, siigo_closed, siigo_closed_at, siigo_closed_by, deposited_by, deposited_at, created_at
       FROM cartera_deposits
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY deposited_at DESC, id DESC`
      , params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando depósitos:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /api/cartera/cash-balance - Balance en línea de Cartera
// Calcula: base + inflows (mensajero + bodega) - outflows (depósitos)
const getCashBalance = async (req, res) => {
  try {
    const { from, to } = req.query || {};

    // Base configurable en system_config (clave: cartera_base_balance)
    let base = 0;
    try {
      const cfg = await query(`SELECT config_value FROM system_config WHERE config_key = 'cartera_base_balance' LIMIT 1`);
      if (cfg.length) base = Number(cfg[0].config_value || 0) || 0;
    } catch (e) { }

    // Filtros de fecha
    const whereRangeCr = [];
    const paramsCr = [];
    if (from) { whereRangeCr.push('DATE(cr.accepted_at) >= ?'); paramsCr.push(from.slice(0, 10)); }
    if (to) { whereRangeCr.push('DATE(cr.accepted_at) <= ?'); paramsCr.push(to.slice(0, 10)); }

    const whereRangeCcd = [];
    const paramsCcd = [];
    if (from) { whereRangeCcd.push('DATE(d.collected_at) >= ?'); paramsCcd.push(from.slice(0, 10)); }
    if (to) { whereRangeCcd.push('DATE(d.collected_at) <= ?'); paramsCcd.push(to.slice(0, 10)); }

    const whereRangeDep = [];
    const paramsDep = [];
    if (from) { whereRangeDep.push('DATE(deposited_at) >= ?'); paramsDep.push(from.slice(0, 10)); }
    if (to) { whereRangeDep.push('DATE(deposited_at) <= ?'); paramsDep.push(to.slice(0, 10)); }

    // Movimientos manuales aprobados (ingresos extra / retiros)
    const whereRangeMov = [];
    const paramsMov = [];
    if (from) { whereRangeMov.push('DATE(created_at) >= ?'); paramsMov.push(from.slice(0, 10)); }
    if (to) { whereRangeMov.push('DATE(created_at) <= ?'); paramsMov.push(to.slice(0, 10)); }

    // Ingresos por bodega aceptados
    const [bodega] = await query(
      `SELECT COALESCE(SUM(COALESCE(cr.accepted_amount, cr.amount)),0) AS total
       FROM cash_register cr
       WHERE cr.status = 'collected' ${whereRangeCr.length ? ' AND ' + whereRangeCr.join(' AND ') : ''}`,
      paramsCr
    );

    // Ingresos por actas de mensajero (items aceptados)
    const [mensajero] = await query(
      `SELECT COALESCE(SUM(d.collected_amount),0) AS total
       FROM cash_closing_details d
       WHERE d.collection_status = 'collected' ${whereRangeCcd.length ? ' AND ' + whereRangeCcd.join(' AND ') : ''}`,
      paramsCcd
    );

    // Egresos por consignaciones
    const [deposits] = await query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM cartera_deposits
       ${whereRangeDep.length ? 'WHERE ' + whereRangeDep.join(' AND ') : ''}`,
      paramsDep
    );

    // Ingresos extra aprobados
    const [extraIncomes] = await query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM cartera_movements
       WHERE type = 'extra_income' AND approval_status = 'approved' ${whereRangeMov.length ? ' AND ' + whereRangeMov.join(' AND ') : ''}`,
      paramsMov
    );

    // Retiros aprobados
    const [withdrawals] = await query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM cartera_movements
       WHERE type = 'withdrawal' AND approval_status = 'approved' ${whereRangeMov.length ? ' AND ' + whereRangeMov.join(' AND ') : ''}`,
      paramsMov
    );

    const inflows = Number(bodega?.total || 0) + Number(mensajero?.total || 0) + Number(extraIncomes?.total || 0);
    const outflows = Number(deposits?.total || 0) + Number(withdrawals?.total || 0);
    const balance = Number(base) + inflows - outflows;

    return res.json({
      success: true,
      data: {
        base: Number(base),
        inflows: { bodega: Number(bodega?.total || 0), mensajero: Number(mensajero?.total || 0), extra_income: Number(extraIncomes?.total || 0) },
        outflows: { deposits: Number(deposits?.total || 0), withdrawals: Number(withdrawals?.total || 0) },
        balance
      }
    });
  } catch (error) {
    console.error('Error calculando balance de cartera:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /api/cartera/audit/base-changes - Listado de cambios de base (solo admin)
const listBaseChanges = async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const where = [];
    const params = [];
    if (from) { where.push('DATE(created_at) >= ?'); params.push(from.slice(0, 10)); }
    if (to) { where.push('DATE(created_at) <= ?'); params.push(to.slice(0, 10)); }

    // Tabla se crea al primer uso desde systemConfigController si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS cartera_base_changes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        previous_base DECIMAL(12,2) NOT NULL DEFAULT 0,
        new_base DECIMAL(12,2) NOT NULL DEFAULT 0,
        changed_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const rows = await query(
      `SELECT id, previous_base, new_base, changed_by, created_at
       FROM cartera_base_changes
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC, id DESC`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando cambios de base:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getDepositCandidates = async (req, res) => {
  try {
    const { from, to } = req.query || {};

    // Subconsulta: montos aceptados por mensajero (cash_closing_details)
    const whereM = ["d.collection_status = 'collected'"];
    const paramsM = [];
    if (from) { whereM.push('DATE(d.collected_at) >= ?'); paramsM.push(from.slice(0, 10)); }
    if (to) { whereM.push('DATE(d.collected_at) <= ?'); paramsM.push(to.slice(0, 10)); }

    // Subconsulta: montos aceptados en bodega (cash_register)
    const whereB = ["cr.status = 'collected'"];
    const paramsB = [];
    if (from) { whereB.push('DATE(cr.accepted_at) >= ?'); paramsB.push(from.slice(0, 10)); }
    if (to) { whereB.push('DATE(cr.accepted_at) <= ?'); paramsB.push(to.slice(0, 10)); }

    const sql = `
      SELECT 
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.siigo_invoice_created_at AS invoice_date,
        COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0) AS accepted_total,
        COALESCE(a.assigned_total,0) AS assigned_total,
        (COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0) - COALESCE(a.assigned_total,0)) AS expected_amount
      FROM orders o
      LEFT JOIN (
        SELECT d.order_id, SUM(COALESCE(d.collected_amount,0)) AS accepted_messenger
        FROM cash_closing_details d
        ${whereM.length ? 'WHERE ' + whereM.join(' AND ') : ''}
        GROUP BY d.order_id
      ) m ON m.order_id = o.id
      LEFT JOIN (
        SELECT cr.order_id, SUM(COALESCE(cr.accepted_amount, cr.amount)) AS accepted_bodega
        FROM cash_register cr
        ${whereB.length ? 'WHERE ' + whereB.join(' AND ') : ''}
        GROUP BY cr.order_id
      ) b ON b.order_id = o.id
      LEFT JOIN (
        SELECT cdd.order_id, SUM(cdd.assigned_amount) AS assigned_total
        FROM cartera_deposit_details cdd
        GROUP BY cdd.order_id
      ) a ON a.order_id = o.id
      WHERE (COALESCE(m.accepted_messenger,0) + COALESCE(b.accepted_bodega,0)) > COALESCE(a.assigned_total,0)
      ORDER BY o.siigo_invoice_created_at DESC, o.id DESC
      LIMIT 500
    `;

    const rows = await query(sql, [...paramsM, ...paramsB]);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando candidatos para consignación:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /api/cartera/deposits/:id/details - Detalle de facturas asociadas a una consignación
const getDepositDetails = async (req, res) => {
  try {
    const id = Number(req.params?.id || 0);
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de consignación inválido' });
    }

    // Header de consignación
    const headerRows = await query(
      `SELECT id, amount, bank_name, reference_number, reason_code, reason_text, evidence_file, deposited_by, deposited_at, created_at
       FROM cartera_deposits
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!headerRows.length) {
      return res.status(404).json({ success: false, message: 'Consignación no encontrada' });
    }
    const header = headerRows[0];

    // Items (facturas relacionadas)
    const items = await query(
      `SELECT 
         cdd.order_id,
         o.order_number,
         o.customer_name,
         o.siigo_invoice_created_at AS invoice_date,
         cdd.assigned_amount
       FROM cartera_deposit_details cdd
       JOIN orders o ON o.id = cdd.order_id
       WHERE cdd.deposit_id = ?
       ORDER BY o.siigo_invoice_created_at DESC, o.id DESC`,
      [id]
    );

    // Tolerancia y totales
    let tolerance = 300;
    try {
      const cfg = await query(
        `SELECT config_value FROM system_config WHERE config_key = 'cartera_deposit_tolerance' LIMIT 1`
      );
      if (cfg && cfg.length) tolerance = Number(cfg[0].config_value || 300) || 300;
    } catch (_) { }

    const assigned_total = items.reduce((s, it) => s + Number(it.assigned_amount || 0), 0);
    const deposit_amount = Number(header.amount || 0);
    const difference = Math.abs(deposit_amount - assigned_total);

    return res.json({
      success: true,
      data: {
        header,
        items,
        totals: { assigned_total, deposit_amount, difference, tolerance }
      }
    });
  } catch (error) {
    console.error('Error obteniendo detalles de consignación:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const closeDepositSiigo = async (req, res) => {
  try {
    const id = Number(req.params?.id || 0);
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de consignación inválido' });
    }
    const userId = req.user?.id || null;
    const closed = (typeof req.body?.closed === 'boolean') ? req.body.closed : true;

    if (closed) {
      await query(
        `UPDATE cartera_deposits 
           SET siigo_closed = 1, siigo_closed_at = NOW(), siigo_closed_by = ? 
         WHERE id = ?`,
        [userId, id]
      );
    } else {
      await query(
        `UPDATE cartera_deposits 
           SET siigo_closed = 0, siigo_closed_at = NULL, siigo_closed_by = NULL 
         WHERE id = ?`,
        [id]
      );
    }

    const [row] = await query(
      `SELECT id, amount, bank_name, reference_number, reason_code, reason_text, evidence_file, notes, siigo_closed, siigo_closed_at, siigo_closed_by, deposited_by, deposited_at, created_at
         FROM cartera_deposits
        WHERE id = ?
        LIMIT 1`,
      [id]
    );

    return res.json({
      success: true,
      message: closed ? 'Consignación marcada como cerrada en Siigo' : 'Consignación marcada como pendiente en Siigo',
      data: row
    });
  } catch (error) {
    console.error('Error marcando cierre en Siigo para consignación:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  uploadDeposit,
  createDeposit: [uploadDeposit.single('evidence'), createDeposit],
  listDeposits,
  getCashBalance,
  listBaseChanges,
  getDepositCandidates,
  getDepositDetails,
  closeDepositSiigo
};
