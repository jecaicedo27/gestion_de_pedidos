const { query, transaction } = require('../config/database');
const siigoService = require('../services/siigoService');

// Obtener todos los clientes de crédito con saldo actual desde SIIGO
const getCustomerCredits = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (search) {
            whereClause += ' AND (customer_name LIKE ? OR customer_nit LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        
        // Contar total de registros
        const countQuery = `SELECT COUNT(*) as total FROM customer_credit ${whereClause}`;
        const countResult = await query(countQuery, params);
        const total = countResult[0].total;
        
        // Calcular paginación
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);
        
        // Obtener registros paginados
        const dataQuery = `
            SELECT cc.*, u.full_name as created_by_name
            FROM customer_credit cc
            LEFT JOIN users u ON cc.created_by = u.id
            ${whereClause}
            ORDER BY cc.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const customers = await query(dataQuery, [...params, parseInt(limit), offset]);
        
        // Enriquecer con información de saldos desde SIIGO
        const enrichedCustomers = await Promise.all(customers.map(async (customer) => {
            try {
                console.log(`🔍 Buscando saldo SIIGO para: ${customer.customer_name} (NIT: ${customer.customer_nit})`);
                
                // Buscar cliente en SIIGO por NIT
                const siigoCustomer = await siigoService.findCustomerByNit(customer.customer_nit);
                
                let siigoBalance = 0;
                let siigoStatus = 'not_found';
                let lastSyncDate = null;
                
                if (siigoCustomer) {
                    console.log(`✅ Cliente encontrado en SIIGO: ${siigoCustomer.id}`);
                    
                    // Obtener cuentas por cobrar desde SIIGO
                    const accountsReceivable = await siigoService.getCustomerAccountsReceivable(siigoCustomer.id);
                    siigoBalance = accountsReceivable.total_balance || 0;
                    siigoStatus = 'found';
                    lastSyncDate = new Date().toISOString();
                    
                    console.log(`💰 Saldo SIIGO obtenido: $${siigoBalance.toLocaleString()}`);
                } else {
                    console.log(`❌ Cliente no encontrado en SIIGO: ${customer.customer_nit}`);
                }
                
                // Calcular crédito disponible con saldo real de SIIGO
                const creditLimit = parseFloat(customer.credit_limit) || 0;
                const availableCredit = creditLimit - siigoBalance;
                
                return {
                    ...customer,
                    current_balance: siigoBalance, // Usar saldo real de SIIGO
                    available_credit: availableCredit,
                    siigo_status: siigoStatus,
                    siigo_last_sync: lastSyncDate,
                    siigo_customer_id: siigoCustomer?.id || null
                };
            } catch (error) {
                console.error(`❌ Error obteniendo saldo SIIGO para ${customer.customer_name}:`, error.message);
                
                // En caso de error, usar datos locales
                const creditLimit = parseFloat(customer.credit_limit) || 0;
                const currentBalance = parseFloat(customer.current_balance) || 0;
                
                return {
                    ...customer,
                    available_credit: creditLimit - currentBalance,
                    siigo_status: 'error',
                    siigo_last_sync: null,
                    siigo_customer_id: null
                };
            }
        }));
        
        res.json({
            success: true,
            data: {
                customers: enrichedCustomers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: totalPages
                }
            }
        });
    } catch (error) {
        console.error('Error obteniendo clientes de crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Obtener un cliente de crédito por ID
const getCustomerCreditById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const customerQuery = `
            SELECT cc.*, u.full_name as created_by_name
            FROM customer_credit cc
            LEFT JOIN users u ON cc.created_by = u.id
            WHERE cc.id = ?
        `;
        
        const customers = await query(customerQuery, [id]);
        
        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente de crédito no encontrado'
            });
        }
        
        // Obtener historial de movimientos
        const movementsQuery = `
            SELECT ccm.*, u.full_name as created_by_name, o.order_number
            FROM customer_credit_movements ccm
            LEFT JOIN users u ON ccm.created_by = u.id
            LEFT JOIN orders o ON ccm.order_id = o.id
            WHERE ccm.customer_credit_id = ?
            ORDER BY ccm.created_at DESC
            LIMIT 50
        `;
        
        const movements = await query(movementsQuery, [id]);
        
        res.json({
            success: true,
            data: {
                customer: customers[0],
                movements
            }
        });
    } catch (error) {
        console.error('Error obteniendo cliente de crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Crear nuevo cliente de crédito
const createCustomerCredit = async (req, res) => {
    try {
        const { customer_nit, customer_name, credit_limit, notes } = req.body;
        const userId = req.user.id;
        
        // Validar datos requeridos
        if (!customer_nit || !customer_name || !credit_limit) {
            return res.status(400).json({
                success: false,
                message: 'NIT, nombre del cliente y cupo de crédito son requeridos'
            });
        }
        
        // Verificar que el NIT no exista
        const existingCustomer = await query(
            'SELECT id FROM customer_credit WHERE customer_nit = ?',
            [customer_nit]
        );
        
        if (existingCustomer.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un cliente con este NIT'
            });
        }
        
        // Crear cliente de crédito
        const insertQuery = `
            INSERT INTO customer_credit (customer_nit, customer_name, credit_limit, current_balance, notes, created_by)
            VALUES (?, ?, ?, 0, ?, ?)
        `;
        
        const result = await query(insertQuery, [
            customer_nit,
            customer_name,
            parseFloat(credit_limit),
            notes || null,
            userId
        ]);
        
        // Crear movimiento inicial
        await query(`
            INSERT INTO customer_credit_movements (customer_credit_id, movement_type, amount, previous_balance, new_balance, description, created_by)
            VALUES (?, 'credit_increase', ?, 0, 0, 'Creación de cupo de crédito inicial', ?)
        `, [result.insertId, parseFloat(credit_limit), userId]);
        
        res.status(201).json({
            success: true,
            message: 'Cliente de crédito creado exitosamente',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error creando cliente de crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Actualizar cliente de crédito
const updateCustomerCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_name, credit_limit, notes, status } = req.body;
        const userId = req.user.id;
        
        // Obtener datos actuales
        const currentData = await query('SELECT * FROM customer_credit WHERE id = ?', [id]);
        
        if (currentData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente de crédito no encontrado'
            });
        }
        
        const current = currentData[0];
        
        await transaction(async (connection) => {
            // Actualizar datos básicos
            await connection.execute(`
                UPDATE customer_credit 
                SET customer_name = ?, notes = ?, status = ?, updated_at = NOW()
                WHERE id = ?
            `, [customer_name || current.customer_name, notes, status || current.status, id]);
            
            // Si cambió el cupo de crédito, crear movimiento
            if (credit_limit && parseFloat(credit_limit) !== parseFloat(current.credit_limit)) {
                const newLimit = parseFloat(credit_limit);
                const oldLimit = parseFloat(current.credit_limit);
                const difference = newLimit - oldLimit;
                
                // Actualizar cupo
                await connection.execute(
                    'UPDATE customer_credit SET credit_limit = ? WHERE id = ?',
                    [newLimit, id]
                );
                
                // Crear movimiento
                const movementType = difference > 0 ? 'credit_increase' : 'credit_decrease';
                const description = `${difference > 0 ? 'Aumento' : 'Disminución'} de cupo de crédito: $${Math.abs(difference).toLocaleString('es-CO')}`;
                
                await connection.execute(`
                    INSERT INTO customer_credit_movements (customer_credit_id, movement_type, amount, previous_balance, new_balance, description, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [id, movementType, Math.abs(difference), current.current_balance, current.current_balance, description, userId]);
            }
        });
        
        res.json({
            success: true,
            message: 'Cliente de crédito actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error actualizando cliente de crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Eliminar cliente de crédito
const deleteCustomerCredit = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que no tenga saldo pendiente
        const customer = await query('SELECT current_balance FROM customer_credit WHERE id = ?', [id]);
        
        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente de crédito no encontrado'
            });
        }
        
        if (parseFloat(customer[0].current_balance) > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar un cliente con saldo pendiente'
            });
        }
        
        await query('DELETE FROM customer_credit WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Cliente de crédito eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error eliminando cliente de crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Buscar cliente por NIT o nombre para validación de crédito
const findCustomerByNitOrName = async (req, res) => {
    try {
        const { search } = req.query;
        
        if (!search) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro de búsqueda requerido'
            });
        }
        
        const customers = await query(`
            SELECT id, customer_nit, customer_name, credit_limit, current_balance, available_credit, status
            FROM customer_credit
            WHERE (customer_nit LIKE ? OR customer_name LIKE ?) AND status = 'active'
            ORDER BY customer_name
            LIMIT 10
        `, [`%${search}%`, `%${search}%`]);
        
        res.json({
            success: true,
            data: customers
        });
    } catch (error) {
        console.error('Error buscando cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Validar crédito disponible para un pedido
const validateCreditForOrder = async (req, res) => {
    try {
        const { customer_name, order_amount } = req.body;
        
        if (!customer_name || !order_amount) {
            return res.status(400).json({
                success: false,
                message: 'Nombre del cliente y monto del pedido son requeridos'
            });
        }
        
        // Buscar cliente por nombre exacto
        const customers = await query(`
            SELECT id, customer_nit, customer_name, credit_limit, current_balance, available_credit, status
            FROM customer_credit
            WHERE customer_name = ? AND status = 'active'
        `, [customer_name]);
        
        if (customers.length === 0) {
            return res.json({
                success: false,
                message: 'No se encontró información de crédito para este cliente',
                hasCredit: false
            });
        }
        
        const customer = customers[0];
        const orderAmount = parseFloat(order_amount);
        const availableCredit = parseFloat(customer.available_credit);
        
        const hasEnoughCredit = availableCredit >= orderAmount;
        
        res.json({
            success: true,
            hasCredit: true,
            hasEnoughCredit,
            data: {
                customer: {
                    id: customer.id,
                    nit: customer.customer_nit,
                    name: customer.customer_name,
                    creditLimit: customer.credit_limit,
                    currentBalance: customer.current_balance,
                    availableCredit: customer.available_credit
                },
                orderAmount,
                remainingCredit: availableCredit - orderAmount
            }
        });
    } catch (error) {
        console.error('Error validando crédito:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

module.exports = {
    getCustomerCredits,
    getCustomerCreditById,
    createCustomerCredit,
    updateCustomerCredit,
    deleteCustomerCredit,
    findCustomerByNitOrName,
    validateCreditForOrder
};
