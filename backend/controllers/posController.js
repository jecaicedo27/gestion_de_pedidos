const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');

const posController = {
    // Upload evidence and mark as delivered (or pending approval)
    uploadEvidenceAndDeliver: async (req, res) => {
        try {
            console.log('📸 POS Evidence Upload Request:', req.body);

            const { order_id } = req.body;
            const userId = req.user.id;

            if (!order_id) {
                return res.status(400).json({ success: false, message: 'Order ID required' });
            }

            // Get order to check payment method
            const [orders] = await pool.execute('SELECT payment_method, total_amount, status FROM orders WHERE id = ?', [order_id]);
            if (orders.length === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
            const order = orders[0];
            const paymentMethod = order.payment_method;

            console.log(`📋 Order ${order_id} Payment Method: ${paymentMethod}`);

            // Handle files
            const files = req.files || {};
            const productPhoto = files['product_photo'] ? files['product_photo'][0] : null;
            const paymentEvidence = files['payment_evidence'] ? files['payment_evidence'][0] : null;
            const cashPhoto = files['cash_photo'] ? files['cash_photo'][0] : null;

            // Validation
            if (!productPhoto) {
                return res.status(400).json({ success: false, message: 'La foto del producto es obligatoria' });
            }

            if ((paymentMethod === 'transferencia' || paymentMethod === 'mixto') && !paymentEvidence) {
                return res.status(400).json({ success: false, message: 'El comprobante de pago es obligatorio para transferencias' });
            }

            // Prepare paths (relative to public/uploads or similar)
            const productPhotoPath = productPhoto ? `uploads/evidence/${productPhoto.filename}` : null;
            const paymentEvidencePath = paymentEvidence ? `uploads/evidence/${paymentEvidence.filename}` : null;
            const cashPhotoPath = cashPhoto ? `uploads/evidence/${cashPhoto.filename}` : null;

            // Determine new status
            let newStatus = 'entregado'; // Default for cash (was delivered_pos)
            if (paymentMethod === 'transferencia' || paymentMethod === 'mixto') {
                newStatus = 'revision_cartera'; // Needs approval (was pending_payment)
            }

            console.log(`🔍 POS Debug: OrderID=${order_id}, PaymentMethod=${paymentMethod}, NewStatus=${newStatus}`);
            console.log(`🔄 Transitioning to status: ${newStatus}`);

            // Update Order
            await pool.execute(`
        UPDATE orders 
        SET 
          product_evidence_photo = ?,
          payment_evidence_photo = ?,
          cash_evidence_photo = ?,
          status = ?,
          delivered_at = IF(? = 'entregado', NOW(), delivered_at),
          delivered_by = IF(? = 'entregado', ?, delivered_by),
          submitted_for_approval_at = IF(? = 'revision_cartera', NOW(), NULL)
        WHERE id = ?
      `, [
                productPhotoPath,
                paymentEvidencePath,
                cashPhotoPath,
                newStatus,
                newStatus, // Check for delivered_at (entregado)
                newStatus, userId, // Check for delivered_by (entregado)
                newStatus, // Check for submitted_for_approval_at (revision_cartera)
                order_id
            ]);

            // If Cash, we might want to register it in a cash_log table if it exists, 
            // but for now the order status 'delivered_pos' implies money collected.

            res.json({
                success: true,
                status: newStatus,
                message: newStatus === 'entregado' ? 'Pedido entregado exitosamente' : 'Enviado para aprobación de Cartera'
            });

        } catch (error) {
            console.error('❌ POS Error:', error);
            res.status(500).json({ success: false, message: 'Error procesando entrega POS', error: error.message });
        }
    },

    // Get pending transfers for approval
    getPendingTransfers: async (req, res) => {
        try {
            // Fetch orders that are pending payment and are POS or have transfer/mixed payment
            // We include sale_channel = 'pos' check to be specific, but also check payment method as fallback
            const [rows] = await pool.execute(`
                SELECT o.*, 
                       u.username as created_by_name
                FROM orders o
                LEFT JOIN users u ON o.created_by = u.id
                WHERE o.status = 'revision_cartera' 
                  AND o.payment_method IN ('transferencia', 'mixto')
                ORDER BY o.created_at DESC
            `);
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error('Error fetching pending transfers:', error);
            res.status(500).json({ success: false, message: 'Error al obtener transferencias pendientes' });
        }
    },

    // Approve transfer
    approveTransfer: async (req, res) => {
        const { orderId } = req.params;
        const userId = req.user.id;
        try {
            // Move to pos_evidence_pending so they can upload product photo if not already there
            // Or if they already uploaded everything (which they should have in the initial step), move to delivered_pos?
            // In the initial step (uploadEvidenceAndDeliver), we saved product_evidence_photo too.
            // So if we have product_evidence_photo, we can go straight to delivered_pos?

            // Let's check if we have product evidence
            const [orders] = await pool.execute('SELECT product_evidence_photo FROM orders WHERE id = ?', [orderId]);

            let newStatus = 'gestion_especial';
            if (orders.length > 0 && orders[0].product_evidence_photo) {
                newStatus = 'entregado';
            }

            await pool.execute(`
                UPDATE orders 
                SET status = IF(status = 'listo_para_entrega', status, ?),
                    approved_by = ?,
                    approved_at = NOW()
                WHERE id = ?
            `, [newStatus, userId, orderId]);

            res.json({
                success: true,
                message: 'Transferencia aprobada',
                new_status: newStatus
            });
        } catch (error) {
            console.error('Error approving transfer:', error);
            res.status(500).json({ success: false, message: 'Error al aprobar transferencia' });
        }
    },

    // Reject transfer
    rejectTransfer: async (req, res) => {
        const { orderId } = req.params;
        try {
            await pool.execute(`
                UPDATE orders 
                SET status = 'gestion_especial'
                WHERE id = ?
            `, [orderId]);
            res.json({ success: true, message: 'Transferencia rechazada' });
        } catch (error) {
            console.error('Error rejecting transfer:', error);
            res.status(500).json({ success: false, message: 'Error al rechazar transferencia' });
        }
    }
};

module.exports = posController;
