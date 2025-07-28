const siigoService = require('./siigoService');
const { query } = require('../config/database');

class SiigoUpdateService {
  constructor() {
    this.updateInterval = 10 * 60 * 1000; // 10 minutos
    this.isRunning = false;
  }

  /**
   * Iniciar el servicio de actualización automática
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Servicio de actualización SIIGO ya está ejecutándose');
      return;
    }

    console.log('🔄 Iniciando servicio de actualización automática de facturas SIIGO...');
    this.isRunning = true;
    
    // Ejecutar inmediatamente
    this.updateProcessedInvoices();
    
    // Programar ejecuciones periódicas
    this.intervalId = setInterval(() => {
      this.updateProcessedInvoices();
    }, this.updateInterval);
  }

  /**
   * Detener el servicio de actualización
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Servicio de actualización SIIGO detenido');
  }

  /**
   * Actualizar facturas ya procesadas y detectar nuevas facturas
   */
  async updateProcessedInvoices() {
    try {
      console.log('🔄 Iniciando actualización de facturas procesadas...');
      
      // Primero, detectar nuevas facturas
      const newInvoicesCount = await this.detectNewInvoices();
      
      // Luego, actualizar facturas ya procesadas
      const processedInvoices = await query(`
        SELECT DISTINCT siigo_invoice_id, order_id, processed_at
        FROM siigo_sync_log 
        WHERE sync_status = 'success' 
        AND processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY processed_at DESC
      `);

      if (processedInvoices.length === 0) {
        console.log('ℹ️  No hay facturas procesadas para actualizar');
        if (newInvoicesCount === 0) {
          return;
        }
      }

      console.log(`📋 Encontradas ${processedInvoices.length} facturas para verificar actualizaciones`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const processedInvoice of processedInvoices) {
        try {
          const wasUpdated = await this.checkAndUpdateInvoice(
            processedInvoice.siigo_invoice_id, 
            processedInvoice.order_id
          );
          
          if (wasUpdated) {
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ Error actualizando factura ${processedInvoice.siigo_invoice_id}:`, error.message);
          errorCount++;
        }
      }

      const totalChanges = updatedCount + newInvoicesCount;
      console.log(`✅ Actualización completada: ${updatedCount} facturas actualizadas, ${newInvoicesCount} nuevas facturas, ${errorCount} errores`);
      
      // Notificar a clientes conectados si hubo cambios
      if (totalChanges > 0 && global.io) {
        global.io.to('siigo-updates').emit('invoices-updated', {
          type: 'invoices-updated',
          updatedCount,
          newInvoicesCount,
          totalChanges,
          timestamp: new Date().toISOString()
        });
        
        global.io.to('orders-updates').emit('invoices-updated', {
          type: 'invoices-updated',
          updatedCount,
          newInvoicesCount,
          totalChanges,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ Error en actualización automática de facturas:', error.message);
    }
  }

  /**
   * Detectar nuevas facturas en SIIGO que no han sido importadas
   */
  async detectNewInvoices() {
    try {
      console.log('🔍 Buscando nuevas facturas en SIIGO...');
      
      // Obtener facturas de SIIGO de los últimos 2 días
      const today = new Date();
      const twoDaysAgo = new Date(today.getTime() - (2 * 24 * 60 * 60 * 1000));
      const startDate = twoDaysAgo.toISOString().split('T')[0];
      
      console.log(`🔍 Filtrando facturas desde: ${startDate}`);
      
      const siigoInvoicesResult = await siigoService.getInvoices({
        start_date: startDate,
        page_size: 100
      });

      // El servicio devuelve un objeto con results
      const siigoInvoices = siigoInvoicesResult?.results || [];

      if (!siigoInvoices || siigoInvoices.length === 0) {
        console.log(`✅ 0 facturas obtenidas (desde ${startDate})`);
        return 0;
      }

      console.log(`📋 Encontradas ${siigoInvoices.length} facturas en SIIGO desde ${startDate}`);

      // Verificar cuáles no están en nuestra base de datos
      let newInvoicesCount = 0;
      
      for (const invoice of siigoInvoices) {
        try {
          // Verificar si la factura ya existe en nuestro sistema
          const existingLog = await query(
            'SELECT id FROM siigo_sync_log WHERE siigo_invoice_id = ? AND sync_status = "success"',
            [invoice.id]
          );

          if (existingLog.length === 0) {
            console.log(`🆕 Nueva factura detectada: ${invoice.id} - ${invoice.number || 'Sin número'}`);
            
            // Intentar importar la nueva factura
            const importResult = await this.importNewInvoice(invoice);
            if (importResult.success) {
              newInvoicesCount++;
              console.log(`✅ Nueva factura ${invoice.id} importada exitosamente como pedido ${importResult.orderId}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error procesando factura ${invoice.id}:`, error.message);
        }
      }

      if (newInvoicesCount > 0) {
        console.log(`🎉 ${newInvoicesCount} nuevas facturas importadas exitosamente`);
        
        // Notificar a clientes conectados sobre nuevas facturas
        if (global.io) {
          global.io.to('siigo-updates').emit('new-invoice', {
            type: 'new-invoice',
            count: newInvoicesCount,
            message: `${newInvoicesCount} nueva${newInvoicesCount > 1 ? 's' : ''} factura${newInvoicesCount > 1 ? 's' : ''} detectada${newInvoicesCount > 1 ? 's' : ''} en SIIGO`,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('ℹ️  No se encontraron nuevas facturas para importar');
      }

      return newInvoicesCount;

    } catch (error) {
      console.error('❌ Error detectando nuevas facturas:', error.message);
      return 0;
    }
  }

  /**
   * Importar una nueva factura como pedido
   */
  async importNewInvoice(invoice) {
    try {
      // Usar el servicio SIIGO directamente para importar la factura
      const siigoService = require('./siigoService');
      
      // Obtener datos completos de la factura
      const invoiceData = await siigoService.getInvoice(invoice.id);
      
      // Enriquecer con datos del cliente si es posible
      if (invoiceData.customer && invoiceData.customer.id) {
        try {
          const customerData = await siigoService.getCustomer(invoiceData.customer.id);
          if (customerData) {
            invoiceData.customer = {
              ...invoiceData.customer,
              ...customerData
            };
          }
        } catch (error) {
          console.error(`❌ Error obteniendo cliente ${invoiceData.customer.id}:`, error.message);
        }
      }

      // Procesar factura directamente
      const result = await siigoService.processInvoiceToOrder(invoiceData, 'auto');
      
      return {
        success: true,
        orderId: result.order_id || 'unknown'
      };

    } catch (error) {
      console.error(`❌ Error importando nueva factura ${invoice.id}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar y actualizar una factura específica
   */
  async checkAndUpdateInvoice(invoiceId, orderId) {
    try {
      // Obtener datos actuales de la factura desde SIIGO
      const currentInvoiceData = await siigoService.getInvoice(invoiceId);
      
      if (!currentInvoiceData) {
        console.log(`⚠️  Factura ${invoiceId} no encontrada en SIIGO`);
        return false;
      }

      // Obtener datos del pedido actual en la base de datos
      const currentOrder = await query(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (currentOrder.length === 0) {
        console.log(`⚠️  Pedido ${orderId} no encontrado en base de datos`);
        return false;
      }

      const order = currentOrder[0];

      // Verificar si hay cambios significativos
      const hasChanges = await this.detectChanges(currentInvoiceData, order);
      
      if (!hasChanges) {
        return false; // No hay cambios
      }

      console.log(`🔄 Detectados cambios en factura ${invoiceId}, actualizando pedido ${orderId}...`);

      // Actualizar el pedido con los nuevos datos
      await this.updateOrderFromInvoice(currentInvoiceData, orderId);

      // Registrar la actualización
      await this.logUpdate(invoiceId, orderId, 'updated');

      return true;

    } catch (error) {
      console.error(`❌ Error verificando factura ${invoiceId}:`, error.message);
      await this.logUpdate(invoiceId, orderId, 'error', error.message);
      throw error;
    }
  }

  /**
   * Detectar cambios entre la factura de SIIGO y el pedido actual
   */
  async detectChanges(invoiceData, order) {
    const changes = [];

    // Verificar cambios en el total
    const currentTotal = invoiceData.total || 0;
    if (Math.abs(currentTotal - (order.total_amount || 0)) > 0.01) {
      changes.push(`Total: ${order.total_amount} → ${currentTotal}`);
    }

    // Verificar cambios en observaciones
    const currentObservations = invoiceData.observations || '';
    const orderNotes = order.notes || '';
    if (currentObservations !== orderNotes.replace(/Pedido creado desde factura SIIGO:.*?\n?/, '').trim()) {
      changes.push('Observaciones modificadas');
    }

    // Verificar cambios en items
    const currentItems = siigoService.extractOrderItems(invoiceData);
    const orderItems = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    
    if (currentItems.length !== orderItems.length) {
      changes.push(`Items: ${orderItems.length} → ${currentItems.length}`);
    } else {
      // Verificar cambios en items individuales
      for (let i = 0; i < currentItems.length; i++) {
        const currentItem = currentItems[i];
        const orderItem = orderItems[i];
        
        if (currentItem.name !== orderItem.name || 
            Math.abs(currentItem.price - orderItem.price) > 0.01 ||
            currentItem.quantity !== orderItem.quantity) {
          changes.push(`Item ${i + 1} modificado`);
          break;
        }
      }
    }

    if (changes.length > 0) {
      console.log(`📝 Cambios detectados en factura ${invoiceData.id}:`, changes);
      return true;
    }

    return false;
  }

  /**
   * Actualizar pedido con datos actualizados de la factura
   */
  async updateOrderFromInvoice(invoiceData, orderId) {
    // TEMPORALMENTE DESHABILITADO - El extractCustomerInfo está devolviendo datos incorrectos
    console.log('⚠️  Actualización de datos de cliente temporalmente deshabilitada para evitar corrupción de datos');
    
    // Solo actualizar campos seguros que no afecten la información del cliente
    const notes = siigoService.buildOrderNotes(invoiceData);

    // Actualizar solo notas y total, PRESERVANDO payment_method y otros datos críticos
    await query(`
      UPDATE orders SET
        total_amount = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      invoiceData.total || 0,
      notes,
      orderId
    ]);

    console.log(`✅ Pedido ${orderId} actualizado (solo total y notas) - Datos de cliente y payment_method preservados`);
    
    // NO actualizar items tampoco para evitar problemas
    console.log('ℹ️  Actualización de items omitida para preservar datos existentes');

    // Actualizar items del pedido
    // Primero eliminar items existentes
    await query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    
    // Insertar items actualizados
    for (const item of items) {
      await query(`
        INSERT INTO order_items (order_id, name, quantity, price, description, product_code, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [orderId, item.name, item.quantity, item.price, item.description, item.product_code]);
    }

    console.log(`✅ Pedido ${orderId} actualizado exitosamente`);
  }

  /**
   * Registrar actualización en log
   */
  async logUpdate(invoiceId, orderId, status, errorMessage = null) {
    try {
      await query(`
        INSERT INTO siigo_sync_log (siigo_invoice_id, order_id, sync_type, sync_status, error_message, processed_at)
        VALUES (?, ?, 'update', ?, ?, NOW())
      `, [invoiceId, orderId, status, errorMessage]);
    } catch (error) {
      console.error('❌ Error registrando actualización:', error.message);
    }
  }

  /**
   * Forzar actualización de una factura específica
   */
  async forceUpdateInvoice(invoiceId) {
    try {
      console.log(`🔄 Forzando actualización de factura ${invoiceId}...`);
      
      // Buscar el pedido asociado
      const orderResult = await query(`
        SELECT order_id FROM siigo_sync_log 
        WHERE siigo_invoice_id = ? AND sync_status = 'success'
        ORDER BY processed_at DESC LIMIT 1
      `, [invoiceId]);

      if (orderResult.length === 0) {
        throw new Error('No se encontró pedido asociado a esta factura');
      }

      const orderId = orderResult[0].order_id;
      const wasUpdated = await this.checkAndUpdateInvoice(invoiceId, orderId);

      return {
        success: true,
        updated: wasUpdated,
        message: wasUpdated ? 'Factura actualizada exitosamente' : 'No se detectaron cambios'
      };

    } catch (error) {
      console.error(`❌ Error forzando actualización de factura ${invoiceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de actualizaciones
   */
  async getUpdateStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_updates,
          SUM(CASE WHEN sync_status = 'updated' THEN 1 ELSE 0 END) as successful_updates,
          SUM(CASE WHEN sync_status = 'error' THEN 1 ELSE 0 END) as failed_updates,
          MAX(processed_at) as last_update
        FROM siigo_sync_log 
        WHERE sync_type = 'update'
        AND processed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      return stats[0];
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de actualización:', error.message);
      throw error;
    }
  }
}

// Instancia singleton
const siigoUpdateService = new SiigoUpdateService();

module.exports = siigoUpdateService;
