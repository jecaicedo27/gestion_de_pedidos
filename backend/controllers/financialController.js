
const { query } = require('../config/database');
const siigoService = require('../services/siigoService');

/**
 * Calculadora de Patrimonio Financiero
 * Formula: Patrimonio = (Inventario + Caja + Circulacion + Bancos + Cartera) - Deuda Proveedores
 */
const financialController = {

    // GET /api/financial/equity-history
    // Obtiene el historico y calcula el valor de HOY en tiempo real
    getEquityHistory: async (req, res) => {
        try {
            const { from, to } = req.query;

            // 1. Obtener historico guardado
            let sql = `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') as date_str FROM daily_financial_snapshots WHERE 1=1`;
            const params = [];
            if (from) { sql += ` AND date >= ?`; params.push(from); }
            if (to) { sql += ` AND date <= ?`; params.push(to); }
            sql += ` ORDER BY date ASC`;

            const history = await query(sql, params);

            // 1.1 Obtener historial de Egresos (Pagados)
            let expenseSql = `
                SELECT payment_date, SUM(amount) as daily_expense 
                FROM expenses 
                WHERE payment_status = 'PAGADO'
            `;
            const expenseParams = [];

            if (from) { expenseSql += ` AND payment_date >= ?`; expenseParams.push(from); }
            if (to) { expenseSql += ` AND payment_date <= ?`; expenseParams.push(to); }

            expenseSql += ` GROUP BY payment_date ORDER BY payment_date ASC`;

            const expenses = await query(expenseSql, expenseParams);

            // Crear mapa de egresos para merge rápido
            const expenseMap = {};
            expenses.forEach(e => {
                const d = new Date(e.payment_date).toISOString().slice(0, 10); // payment_date is DATE or DATETIME
                expenseMap[d] = Number(e.daily_expense || 0);
            });

            // Merge expenses into history
            // Nota: history puede tener fechas sin egresos, y egresos pueden existir en fechas sin snapshot financiero.
            // Para la gráfica, iteraremos sobre history primariamente, pero idealmente deberíamos unir todas las fechas.
            // Por simplicidad, inyectamos el gasto en los registros de history existentes.
            history.forEach(h => {
                const d = new Date(h.date).toISOString().slice(0, 10);
                h.daily_expense = expenseMap[d] || 0;
            });

            // 1.2 Obtener historial de Ingresos Siigo (Persistidos)
            let incomeSql = `SELECT date, total_amount FROM siigo_income_daily WHERE 1=1`;
            const incomeParams = [];
            if (from) { incomeSql += ` AND date >= ?`; incomeParams.push(from); }
            if (to) { incomeSql += ` AND date <= ?`; incomeParams.push(to); }

            const incomeRows = await query(incomeSql, incomeParams);
            const incomeMap = {};
            incomeRows.forEach(r => {
                const d = new Date(r.date).toISOString().slice(0, 10);
                incomeMap[d] = Number(r.total_amount || 0);
            });

            // Merge income into history
            history.forEach(h => {
                const d = new Date(h.date).toISOString().slice(0, 10);
                h.siigo_income = incomeMap[d] || 0;
            });

            // 2. Calcular HOY en tiempo real (Usando zona horaria Colombia)
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

            // Buscar si ya existe una entrada para hoy en el historial
            let todayIndex = history.findIndex(h => {
                return h.date_str === today;
            });

            // Determinar valores manuales a usar (Bank, MP, Receivables, Payables, Notes)
            // Prioridad: 
            // 1. Datos ya guardados HOY (si existen)
            // 2. Datos de AYER (o el último snapshot disponible)
            // 3. 0

            let manualValues = {
                bank_balance: 0,
                mercado_pago_balance: 0,
                receivables: 0,
                payables: 0,
                notes: ''
            };

            if (todayIndex >= 0) {
                // Ya existe hoy, usamos sus valores manuales
                const h = history[todayIndex];
                manualValues = {
                    bank_balance: Number(h.bank_balance || 0),
                    mercado_pago_balance: Number(h.mercado_pago_balance || 0),
                    receivables: Number(h.receivables || 0),
                    payables: Number(h.payables || 0),
                    notes: h.notes || ''
                };
            } else if (history.length > 0) {
                // No existe hoy, usamos el último disponible (Ayer)
                const last = history[history.length - 1];
                manualValues = {
                    bank_balance: Number(last.bank_balance || 0),
                    mercado_pago_balance: Number(last.mercado_pago_balance || 0),
                    receivables: Number(last.receivables || 0),
                    payables: Number(last.payables || 0),
                    notes: '' // Notas no se heredan, se dejan en blanco para hoy
                };
            }

            // Calcular componentes automáticos
            const autoData = await calculateRealtimeSnapshot();

            // Recalcular Total Equity con la mezcla de (Auto Fresco + Manual Preservado)
            const totalEquity = (
                Number(autoData.inventory_value) +
                Number(autoData.cash_in_hand) +
                Number(autoData.money_in_circulation) +
                manualValues.bank_balance +
                manualValues.mercado_pago_balance +
                manualValues.receivables
            ) - manualValues.payables;

            // Calcular Egresos de HOY en tiempo real
            const [todayExpenseRow] = await query(`
                SELECT SUM(amount) as total 
                FROM expenses 
                WHERE payment_status = 'PAGADO' 
                AND payment_date = ?
            `, [today]);
            const todayExpense = Number(todayExpenseRow?.total || 0);

            // Obtener Ingresos Siigo de HOY (si exiten en tabla)
            const [todayIncomeRow] = await query(`SELECT total_amount FROM siigo_income_daily WHERE date = ?`, [today]);
            const todayIncome = Number(todayIncomeRow?.total_amount || 0);

            const todayData = {
                date: today,
                inventory_value: autoData.inventory_value,
                money_in_circulation: autoData.money_in_circulation,
                cash_in_hand: autoData.cash_in_hand,
                ...manualValues,
                total_equity: totalEquity,
                daily_expense: todayExpense,
                siigo_income: todayIncome,
                is_realtime: true
            };

            if (todayIndex >= 0) {
                // Actualizar entrada existente con datos frescos
                history[todayIndex] = { ...history[todayIndex], ...todayData };
            } else {
                // Agregar nueva entrada para hoy (provisional, no guardada en BD aun)
                history.push(todayData);
            }

            res.json({ success: true, data: history });
        } catch (error) {
            console.error('Error getting equity history:', error);
            res.status(500).json({ success: false, message: 'Error calculando patrimonio' });
        }
    },

    // POST /api/financial/snapshot
    // Guarda los valores manuales (Bancos, Cartera, Deuda) y congela la foto del dia
    saveDailySnapshot: async (req, res) => {
        try {
            const { bank_balance, receivables, payables, notes } = req.body;
            // Use Bogota Date to prevent rollover to tomorrow during evening hours
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

            // 1. Calcular valores automáticos actuales
            const autoData = await calculateRealtimeSnapshot();

            // 2. Mezclar con manuales
            const finalBank = bank_balance !== undefined ? Number(bank_balance) : autoData.bank_balance;
            const finalMercadoPago = req.body.mercado_pago_balance !== undefined ? Number(req.body.mercado_pago_balance) : autoData.mercado_pago_balance;
            const finalReceivables = receivables !== undefined ? Number(receivables) : autoData.receivables;
            const finalPayables = payables !== undefined ? Number(payables) : autoData.payables;

            // 3. Recalcular Total Equity
            // Equity = (Inv + Cash + Circ + Bank + MP + Receiv) - Payable
            const equity = (
                Number(autoData.inventory_value) +
                Number(autoData.cash_in_hand) +
                Number(autoData.money_in_circulation) +
                finalBank +
                finalMercadoPago +
                finalReceivables
            ) - finalPayables;

            // 4. Guardar/Actualizar en BD
            await query(`
        INSERT INTO daily_financial_snapshots 
        (date, inventory_value, money_in_circulation, cash_in_hand, bank_balance, mercado_pago_balance, receivables, payables, total_equity, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          inventory_value = VALUES(inventory_value),
          money_in_circulation = VALUES(money_in_circulation),
          cash_in_hand = VALUES(cash_in_hand),
          bank_balance = VALUES(bank_balance),
          mercado_pago_balance = VALUES(mercado_pago_balance),
          receivables = VALUES(receivables),
          payables = VALUES(payables),
          total_equity = VALUES(total_equity),
          notes = VALUES(notes),
          updated_at = NOW()
      `, [today, autoData.inventory_value, autoData.money_in_circulation, autoData.cash_in_hand, finalBank, finalMercadoPago, finalReceivables, finalPayables, equity, notes || '']);

            res.json({ success: true, message: 'Foto financiera guardada correctamente', data: { date: today, equity } });

        } catch (error) {
            console.error('Error saving snapshot:', error);
            res.status(500).json({ success: false, message: 'Error guardando datos financieros' });
        }
    }
};

// --- Helpers ---

// Calcula todos los componentes automáticos
async function calculateRealtimeSnapshot() {

    // 1. Inventario (Costo de productos en stock)
    // Query alineada con inventoryManagementController (usando available_quantity)
    const [invRow] = await query(`
    SELECT SUM(available_quantity * COALESCE(NULLIF(purchasing_price * 1.19, 0), standard_price)) as total_value
    FROM products 
    WHERE available_quantity > 0 AND is_active = 1
  `);
    const inventoryValue = Number(invRow?.total_value || 0);


    // 2. Dinero en Circulación (Money in Transit)
    // Query tomada de orderController (filtro 'money_in_transit')
    // Pedidos entregados 'efectivo' no cerrados en caja + Dinero de mensajeros no entregado
    /*
      Lógica de orderController:
      SELECT dt.order_id 
      FROM delivery_tracking dt 
      WHERE dt.payment_method = 'efectivo' 
      AND dt.payment_collected > 0
      AND dt.delivered_at IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = dt.order_id)
      AND NOT EXISTS (SELECT 1 FROM cash_closing_details ccd WHERE ccd.order_id = dt.order_id AND ccd.collection_status = 'collected')
      
      Y sumamos el valor de esos pedidos.
    */
    const [circRow] = await query(`
    SELECT COALESCE(SUM(
         CASE 
           WHEN dt.delivered_at IS NOT NULL THEN dt.payment_collected 
           ELSE o.total_amount 
         END
       ), 0) as total_circulation
       FROM orders o
       LEFT JOIN delivery_tracking dt ON o.id = dt.order_id
       WHERE o.payment_method = 'efectivo'
       AND o.status != 'anulado'
       AND NOT EXISTS (SELECT 1 FROM cash_register cr WHERE cr.order_id = o.id)
       AND NOT EXISTS (SELECT 1 FROM cash_closing_details ccd WHERE ccd.order_id = o.id AND ccd.collection_status = 'collected')
       AND (
         (dt.delivered_at IS NOT NULL AND dt.payment_collected > 0)
         OR
         (dt.delivered_at IS NULL AND (o.assigned_messenger_id IS NOT NULL OR o.delivery_method = 'recoge_bodega') 
          AND o.status NOT IN ('entregado', 'entregado_cliente', 'entregado_bodega', 'finalizado', 'completado', 'anulado'))
       )
  `);
    const circulationValue = Number(circRow?.total_circulation || 0);


    // 3. Dinero en Caja (Cash in Hand)
    // Logica de treasuryController.getCashBalance()
    // Balance = Base + Inflows (Accepted) - Outflows (Deposits)

    // Base
    const [baseCfg] = await query(`SELECT config_value FROM system_config WHERE config_key = 'cartera_base_balance' LIMIT 1`);
    const base = Number(baseCfg?.[0]?.config_value || 0);

    // Inflows (Bodega + Mensajero Accepted)
    const [inflowsRow] = await query(`
    SELECT 
      (SELECT COALESCE(SUM(COALESCE(accepted_amount, amount)),0) FROM cash_register WHERE status = 'collected') 
      +
      (SELECT COALESCE(SUM(collected_amount),0) FROM cash_closing_details WHERE collection_status = 'collected')
      +
      (SELECT COALESCE(SUM(amount),0) FROM cartera_movements WHERE type = 'extra_income' AND approval_status = 'approved')
      as total_in
  `);

    // Outflows (Deposits + Withdrawals)
    const [outflowsRow] = await query(`
    SELECT 
      (SELECT COALESCE(SUM(amount),0) FROM cartera_deposits)
      +
      (SELECT COALESCE(SUM(amount),0) FROM cartera_movements WHERE type = 'withdrawal' AND approval_status = 'approved')
      as total_out
  `);

    const cashValue = base + Number(inflowsRow?.total_in || 0) - Number(outflowsRow?.total_out || 0);


    // 4. Valores manuales inician en 0 para el día actual
    const lastBank = 0;
    const lastMercadoPago = 0;
    const lastReceivables = 0;
    const lastPayables = 0;

    // Calcular Total Equity provisional
    // Equity = (Inv + Cash + Circ + Bank + MP + Receiv) - Payable
    const totalEquity = (inventoryValue + cashValue + circulationValue + lastBank + lastMercadoPago + lastReceivables) - lastPayables;

    return {
        inventory_value: inventoryValue,
        money_in_circulation: circulationValue,
        cash_in_hand: cashValue,
        bank_balance: lastBank,
        mercado_pago_balance: lastMercadoPago,
        receivables: lastReceivables,
        payables: lastPayables,
        total_equity: totalEquity
    };
};



module.exports = {
    ...financialController,

    // GET /api/financial/siigo-income
    getSiigoIncome: async (req, res) => {
        try {
            const { date, startDate, endDate } = req.query;
            let start, end;

            // Determine date range (Bogota Time)
            if (startDate && endDate) {
                start = startDate;
                end = endDate;
            } else if (date) {
                start = date;
                end = date;
            } else {
                // Default to Today (Bogota)
                const now = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                start = now;
                end = now;
            }

            console.log(`💰 Fetching Income from Siigo (${start} to ${end})...`);

            const vouchers = await siigoService.getVouchers({
                date_start: start,
                date_end: end,
                type: 'RC', // Recibo de Caja
                page_size: 100
            });

            // Aggregate by Payment Account
            const accounts = {};
            let totalIncome = 0;
            const detailedList = [];

            if (vouchers.results) {
                vouchers.results.forEach(voucher => {
                    // Try to get payment value and name
                    // Structure: voucher.payment = { id, name, value } OR voucher.items...
                    // RC usually has a payment object or items describing payment methods.
                    // Based on probe: voucher.payment exists.

                    let amount = 0;
                    let accountName = 'Desconocido';

                    if (voucher.payment) {
                        amount = Number(voucher.payment.value || 0);
                        accountName = voucher.payment.name || 'Sin Nombre';
                    } else if (voucher.items && Array.isArray(voucher.items)) {
                        // Detailed Vouchers (Type: Detailed) don't have a payment object.
                        // We must find the Debit movement to a Cash/Bank account (Group 11).
                        const moneyItems = voucher.items.filter(item =>
                            item.account?.movement === 'Debit' &&
                            item.account?.code?.startsWith('11')
                        );

                        if (moneyItems.length > 0) {
                            amount = moneyItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
                            // Combine names if multiple
                            accountName = moneyItems.map(i => i.description || i.account?.name || 'Caja/Banco').join(' + ');
                        } else {
                            // Fallback: If no Group 11 Debit found, check for ANY Debit that isn't an adjustment
                            // This is risky but better than 0 if they used a weird account code.
                            // For now, let's stick to 0 to avoid false positives (like expenses).
                            amount = 0;
                        }
                    }

                    totalIncome += amount;

                    // Aggregate
                    if (!accounts[accountName]) accounts[accountName] = 0;
                    accounts[accountName] += amount;

                    // Add to list
                    detailedList.push({
                        date: voucher.date,
                        number: voucher.number,
                        name: voucher.name,
                        customer: voucher.customer?.identification || 'N/A',
                        account: accountName,
                        amount: amount
                    });
                });
            }

            res.json({
                success: true,
                range: { start, end },
                total: totalIncome,
                byAccount: accounts,
                details: detailedList
            });

        } catch (error) {
            console.error('Error getting Siigo income:', error);
            res.status(500).json({ success: false, message: 'Error obteniendo ingresos de Siigo', error: error.message });
        }
    }
};
