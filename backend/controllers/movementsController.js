const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/database');

// Storage para evidencias de movimientos (ingresos extra/retiros)
const movementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/movements');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, `movement-${uniqueSuffix}${ext}`);
  }
});

const uploadMovement = multer({
  storage: movementStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('Solo imágenes o PDF como evidencia'), ok);
  }
});

/**
 * POST /api/cartera/movements
 * Crea un movimiento de caja:
 * - type: 'extra_income' | 'withdrawal'
 * - amount: number > 0 (COP)
 * - reason_code: string (catálogo sugerido)
 * - reason_text: string (detalle libre)
 * - order_id (opcional) o order_number (opcional) para vincular a una factura
 * - notes (opcional)
 * - evidence (archivo opcional: imagen/PDF)
 *
 * Reglas:
 * - Retiros por encima del umbral requieren aprobación (status 'pending').
 *   Clave: system_config.cartera_withdrawal_approval_threshold (default 200000)
 * - Ingresos extra quedan aprobados de inmediato.
 */
const createMovement = async (req, res) => {
  try {
    const {
      type,
      amount,
      reason_code,
      reason_text,
      order_id,
      order_number,
      notes
    } = req.body || {};
    const userId = req.user?.id || null;

    const t = String(type || '').toLowerCase();
    if (!['extra_income', 'withdrawal'].includes(t)) {
      return res.status(400).json({ success: false, message: 'Tipo de movimiento inválido' });
    }

    const amt = Number(amount);
    if (!(amt > 0)) {
      return res.status(400).json({ success: false, message: 'Monto inválido' });
    }

    // Resolver order_id por order_number si aplica
    let finalOrderId = null;
    if (order_id) {
      finalOrderId = Number(order_id) || null;
    } else if (order_number) {
      const rows = await query('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [String(order_number).trim()]);
      if (rows.length) finalOrderId = rows[0].id;
    }

    // Umbral de aprobación para retiros
    let threshold = 200000;
    try {
      const cfg = await query(`SELECT config_value FROM system_config WHERE config_key = 'cartera_withdrawal_approval_threshold' LIMIT 1`);
      if (cfg && cfg.length) threshold = Number(cfg[0].config_value || 200000) || 200000;
    } catch (e) {}

    let approval_status = 'approved';
    let approved_by = null;
    let approved_at = null;

    if (t === 'withdrawal' && amt > threshold) {
      approval_status = 'pending';
    } else {
      approved_by = userId;
      approved_at = new Date();
    }

    const file = req.file || null;
    const evidenceFile = file ? file.filename : null;

    // Insertar movimiento
    const result = await query(
      `INSERT INTO cartera_movements
       (type, reason_code, reason_text, order_id, amount, evidence_file, notes, registered_by, approval_status, approved_by, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        t,
        reason_code || null,
        reason_text || null,
        finalOrderId || null,
        amt,
        evidenceFile,
        notes || null,
        userId,
        approval_status,
        approved_by,
        approved_at
      ]
    );

    return res.json({
      success: true,
      message: 'Movimiento registrado',
      data: { id: result.insertId, approval_status, threshold }
    });
  } catch (error) {
    console.error('Error creando movimiento:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * GET /api/cartera/movements?type=&status=&from=&to=&order_number=
 * Lista movimientos con filtros simples.
 */
const listMovements = async (req, res) => {
  try {
    const { type, status, from, to, order_number } = req.query || {};
    const where = [];
    const params = [];

    if (type) {
      where.push('m.type = ?');
      params.push(String(type).toLowerCase());
    }
    if (status) {
      where.push('m.approval_status = ?');
      params.push(String(status).toLowerCase());
    }
    if (from) {
      where.push('DATE(m.created_at) >= ?');
      params.push(String(from).slice(0, 10));
    }
    if (to) {
      where.push('DATE(m.created_at) <= ?');
      params.push(String(to).slice(0, 10));
    }
    if (order_number) {
      where.push('o.order_number = ?');
      params.push(String(order_number).trim());
    }

    const rows = await query(
      `SELECT
         m.id, m.type, m.reason_code, m.reason_text, m.order_id, o.order_number,
         m.amount, m.evidence_file, m.notes, m.registered_by,
         m.approval_status, m.approved_by, m.approved_at,
         m.created_at, m.updated_at
       FROM cartera_movements m
       LEFT JOIN orders o ON o.id = m.order_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 500`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listando movimientos:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * POST /api/cartera/movements/:id/approve
 * Aprueba un retiro pendiente (solo admin).
 */
const approveMovement = async (req, res) => {
  try {
    const { id } = req.params || {};
    const userId = req.user?.id || null;

    const rows = await query(
      `SELECT id, type, approval_status FROM cartera_movements WHERE id = ? LIMIT 1`,
      [Number(id)]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Movimiento no encontrado' });
    }
    const mov = rows[0];
    if (mov.approval_status === 'approved') {
      return res.status(400).json({ success: false, message: 'El movimiento ya está aprobado' });
    }
    if (mov.type !== 'withdrawal') {
      return res.status(400).json({ success: false, message: 'Solo se aprueban retiros' });
    }

    await query(
      `UPDATE cartera_movements
         SET approval_status = 'approved',
             approved_by = ?,
             approved_at = NOW(),
             updated_at = NOW()
       WHERE id = ?`,
      [userId, Number(id)]
    );

    return res.json({ success: true, message: 'Movimiento aprobado', data: { id: Number(id) } });
  } catch (error) {
    console.error('Error aprobando movimiento:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  uploadMovement,
  createMovement: [uploadMovement.single('evidence'), createMovement],
  listMovements,
  approveMovement
};
