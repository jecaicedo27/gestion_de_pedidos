
const { query } = require('../config/database');
const path = require('path');
const fs = require('fs');

const expensesController = {
    // Obtener lista de gastos
    getExpenses: async (req, res) => {
        try {
            console.log('getExpenses params:', req.query); // DEBUG
            const { startDate, endDate, category, source } = req.query;
            let sql = 'SELECT * FROM expenses WHERE 1=1';
            const params = [];

            if (startDate) {
                sql += ' AND date >= ?';
                params.push(startDate);
            }
            if (endDate) {
                sql += ' AND date <= ?';
                params.push(endDate);
            }
            // New filters
            if (req.query.month && req.query.year) {
                // Filter by month/year on 'date' column (Fecha Factura) or 'payment_date' (Fecha Pago)?
                // Usually expenses are tracked by their accrual date (date).
                // Use payment_date (Cash Flow) if date (Accrual) is missing, or for consistency in Cash Flow view?
                // For now, check COALESCE(date, payment_date) to ensure items appear in SOME month list.
                sql += ' AND MONTH(COALESCE(date, payment_date)) = ? AND YEAR(COALESCE(date, payment_date)) = ?';
                params.push(req.query.month, req.query.year);
            }
            if (req.query.siigo_status) {
                sql += ' AND siigo_status = ?';
                params.push(req.query.siigo_status);
            }
            // Payment status could be "Pending" if 'payment_date' is null
            if (req.query.payment_status === 'PENDIENTE') {
                sql += ' AND payment_date IS NULL';
            } else if (req.query.payment_status === 'PAGADO') {
                sql += ' AND payment_date IS NOT NULL';
            }

            if (category) {
                sql += ' AND category = ?';
                params.push(category);
            }
            if (source) {
                sql += ' AND source = ?';
                params.push(source);
            }

            sql += ' ORDER BY COALESCE(date, payment_date) DESC, id DESC';

            console.log('getExpenses SQL:', sql); // DEBUG
            console.log('getExpenses Params:', params); // DEBUG

            const expenses = await query(sql, params);
            res.json({ success: true, data: expenses });
        } catch (error) {
            console.error('Error getting expenses:', error);
            res.status(500).json({ success: false, message: 'Error al obtener gastos' });
        }
    },

    // Crear nuevo gasto
    createExpense: async (req, res) => {
        try {
            const {
                date, amount, source, category, description,
                provider_name, provider_invoice_number, siigo_fc_number,
                payment_date, siigo_status, siigo_rp_number, cost_center, concept
            } = req.body;
            const file = req.file;

            console.log('CREATE EXPENSE BODY:', JSON.stringify(req.body, null, 2));
            console.log('CREATE EXPENSE FILE:', file);


            // Validation: Ensure minimal required fields are present
            // Date (Invoice Date) is now optional. Payment Date is required for 'PAGADO'.
            // But at least ONE date implies we know when it happened.
            if (!amount || !cost_center) {
                return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
            }

            let evidenceUrl = null;
            if (file) {
                // Construir URL relativa
                evidenceUrl = `/uploads/${file.filename}`;
            }

            // Map frontend 'category' to DB 'category' if needed, or use 'cost_center' as the main classifier
            // For backward compatibility, we'll keep 'category' but prioritize 'cost_center' for new logic.
            // If category is not provided but cost_center is, we might auto-fill category or vice versa.
            // For now, we assume frontend sends both or we use 'OTROS' as default for legacy category.
            const finalCategory = category || 'OTROS';

            const result = await query(
                `INSERT INTO expenses (
                    date, amount, source, category, description, evidence_url, created_by,
                    provider_name, provider_invoice_number, siigo_fc_number,
                    payment_date, siigo_status, siigo_rp_number, cost_center, concept, payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    date || null, amount, source || null, finalCategory, description || '', evidenceUrl, req.user ? req.user.id : null,
                    provider_name || 'POR DEFINIR', provider_invoice_number, siigo_fc_number,
                    payment_date || null, siigo_status || 'PENDIENTE', siigo_rp_number, cost_center, concept,
                    req.body.payment_status || 'PAGADO'
                ]
            );

            res.json({
                success: true,
                message: 'Gasto registrado correctamente',
                expenseId: result.insertId
            });
        } catch (error) {
            console.error('Error creating expense:', error);
            res.status(500).json({ success: false, message: 'Error al registrar el gasto' });
        }
    },

    // Modificar gasto existente (PUT)
    updateExpense: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                date, amount, source, category, description,
                provider_name, provider_invoice_number, siigo_fc_number,
                payment_date, siigo_status, siigo_rp_number, cost_center, concept
            } = req.body;
            const file = req.file;

            let updateSql = `UPDATE expenses SET 
                date=?, amount=?, source=?, category=?, description=?, 
                provider_name=?, provider_invoice_number=?, siigo_fc_number=?,
                payment_date=?, siigo_status=?, siigo_rp_number=?, cost_center=?, concept=?, payment_status=?
            `;

            const params = [
                date || null, amount, source || null, category || 'OTROS', description || '',
                provider_name, provider_invoice_number, siigo_fc_number,
                payment_date || null, siigo_status || 'PENDIENTE', siigo_rp_number, cost_center, concept,
                req.body.payment_status || 'PAGADO'
            ];

            if (file) {
                updateSql += `, evidence_url=?`;
                params.push(`/uploads/${file.filename}`);
            }

            updateSql += ` WHERE id=?`;
            params.push(id);

            await query(updateSql, params);

            res.json({
                success: true,
                message: 'Gasto actualizado correctamente'
            });
        } catch (error) {
            console.error('Error updating expense:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar el gasto' });
        }
    },

    // Eliminar gasto (DELETE)
    deleteExpense: async (req, res) => {
        try {
            const { id } = req.params;

            // Check permissions if needed (middleware handles role check usually)

            await query('DELETE FROM expenses WHERE id = ?', [id]);
            res.json({ success: true, message: 'Gasto eliminado' });
        } catch (error) {
            console.error('Error deleting expense:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar el gasto' });
        }
    },

    // Obtener estadísticas rápidas
    getStats: async (req, res) => {
        try {
            const { date, month, year } = req.query;
            let dateFilter = date || new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).split(',')[0];

            // Daily Stats
            const [dailyStats] = await query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total,
                COALESCE(SUM(CASE WHEN source = 'bancolombia' THEN amount ELSE 0 END), 0) as bancolombia,
                COALESCE(SUM(CASE WHEN source = 'mercadopago' THEN amount ELSE 0 END), 0) as mercadopago,
                COALESCE(SUM(CASE WHEN source = 'caja_menor' THEN amount ELSE 0 END), 0) as caja_menor
            FROM expenses 
            WHERE payment_date = ? AND payment_status = 'PAGADO'
        `, [dateFilter]);

            // Monthly Stats (if month/year provided, default to current)
            const currentMonth = month || (new Date().getMonth() + 1);
            const currentYear = year || new Date().getFullYear();

            const [monthlyStats] = await query(`
                SELECT COALESCE(SUM(amount), 0) as total_month
                FROM expenses
                WHERE MONTH(payment_date) = ? AND YEAR(payment_date) = ? AND payment_status = 'PAGADO'
            `, [currentMonth, currentYear]);

            // Monthly Stats (Category Breakdown)
            const categoryStats = await query(`
                SELECT category, COALESCE(SUM(amount), 0) as total
                FROM expenses
                WHERE MONTH(payment_date) = ? AND YEAR(payment_date) = ? AND payment_status = 'PAGADO'
                GROUP BY category
                ORDER BY total DESC
            `, [currentMonth, currentYear]);

            // Group Categories
            const merchandiseTypes = ['PRODUCTO POPPING', 'PRODUCTO FLAVOR', 'PRODUCTO REVENTA'];

            const merchandiseStats = [];
            const operationalStats = [];

            let totalMerchandise = 0;
            let totalOperational = 0;

            categoryStats.forEach(item => {
                const amount = parseFloat(item.total);
                if (merchandiseTypes.includes(item.category)) {
                    merchandiseStats.push(item);
                    totalMerchandise += amount;
                } else {
                    operationalStats.push(item);
                    totalOperational += amount;
                }
            });

            res.json({
                success: true,
                data: {
                    ...dailyStats,
                    total_month: monthlyStats.total_month,
                    // by_category: categoryStats, // Legacy support if needed, but we prefer split
                    groups: {
                        merchandise: {
                            total: totalMerchandise,
                            items: merchandiseStats
                        },
                        operational: {
                            total: totalOperational,
                            items: operationalStats
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error getting expense stats:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
        }
    }
};

module.exports = expensesController;
