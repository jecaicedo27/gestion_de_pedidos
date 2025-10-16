const { query } = require('../config/database');

const deliveryMethodsController = {
  // Obtener todos los métodos de envío
  getAllMethods: async (req, res) => {
    try {
      const methods = await query(
        'SELECT * FROM delivery_methods ORDER BY sort_order ASC, name ASC'
      );

      res.json({
        success: true,
        data: methods
      });
    } catch (error) {
      console.error('Error obteniendo métodos de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo métodos de envío',
        error: error.message
      });
    }
  },

  // Obtener solo métodos activos
  getActiveMethods: async (req, res) => {
    try {
      const methods = await query(
        'SELECT * FROM delivery_methods WHERE active = TRUE ORDER BY sort_order ASC, name ASC'
      );

      res.json({
        success: true,
        data: methods
      });
    } catch (error) {
      console.error('Error obteniendo métodos de envío activos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo métodos de envío activos',
        error: error.message
      });
    }
  },

  // Crear nuevo método de envío
  createMethod: async (req, res) => {
    try {
      const { code, name, description, active = true, sort_order = 0 } = req.body;

      // Validar campos requeridos
      if (!code || !name) {
        return res.status(400).json({
          success: false,
          message: 'El código y nombre son campos obligatorios'
        });
      }

      // Verificar que el código no exista
      const existingMethod = await query(
        'SELECT id FROM delivery_methods WHERE code = ?',
        [code]
      );

      if (existingMethod.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un método de envío con ese código'
        });
      }

      // Crear el método de envío
      const result = await query(
        'INSERT INTO delivery_methods (code, name, description, active, sort_order) VALUES (?, ?, ?, ?, ?)',
        [code, name, description, active, sort_order]
      );

      // Obtener el método creado
      const newMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: 'Método de envío creado exitosamente',
        data: newMethod[0]
      });
    } catch (error) {
      console.error('Error creando método de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando método de envío',
        error: error.message
      });
    }
  },

  // Actualizar método de envío
  updateMethod: async (req, res) => {
    try {
      const { id } = req.params;
      const { code, name, description, active, sort_order } = req.body;

      // Verificar que el método existe
      const existingMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [id]
      );

      if (existingMethod.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Método de envío no encontrado'
        });
      }

      // Si se está cambiando el código, verificar que no exista otro con el mismo código
      if (code && code !== existingMethod[0].code) {
        const codeExists = await query(
          'SELECT id FROM delivery_methods WHERE code = ? AND id != ?',
          [code, id]
        );

        if (codeExists.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un método de envío con ese código'
          });
        }
      }

      // Actualizar solo los campos proporcionados
      const updateFields = [];
      const updateValues = [];

      if (code !== undefined) {
        updateFields.push('code = ?');
        updateValues.push(code);
      }
      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      if (active !== undefined) {
        updateFields.push('active = ?');
        updateValues.push(active);
      }
      if (sort_order !== undefined) {
        updateFields.push('sort_order = ?');
        updateValues.push(sort_order);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron campos para actualizar'
        });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      await query(
        `UPDATE delivery_methods SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Obtener el método actualizado
      const updatedMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: 'Método de envío actualizado exitosamente',
        data: updatedMethod[0]
      });
    } catch (error) {
      console.error('Error actualizando método de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando método de envío',
        error: error.message
      });
    }
  },

  // Eliminar método de envío
  deleteMethod: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que el método existe
      const existingMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [id]
      );

      if (existingMethod.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Método de envío no encontrado'
        });
      }

      // Verificar si hay pedidos usando este método de envío
      const ordersUsingMethod = await query(
        'SELECT COUNT(*) as count FROM orders WHERE delivery_method = ?',
        [existingMethod[0].code]
      );

      if (ordersUsingMethod[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar este método de envío porque hay ${ordersUsingMethod[0].count} pedidos que lo utilizan. Considere desactivarlo en su lugar.`
        });
      }

      // Eliminar el método
      await query('DELETE FROM delivery_methods WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Método de envío eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando método de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando método de envío',
        error: error.message
      });
    }
  },

  // Cambiar estado (activar/desactivar)
  toggleStatus: async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que el método existe
      const existingMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [id]
      );

      if (existingMethod.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Método de envío no encontrado'
        });
      }

      const newStatus = !existingMethod[0].active;

      // Actualizar el estado
      await query(
        'UPDATE delivery_methods SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, id]
      );

      // Obtener el método actualizado
      const updatedMethod = await query(
        'SELECT * FROM delivery_methods WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: `Método de envío ${newStatus ? 'activado' : 'desactivado'} exitosamente`,
        data: updatedMethod[0]
      });
    } catch (error) {
      console.error('Error cambiando estado del método de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error cambiando estado del método de envío',
        error: error.message
      });
    }
  },

  // Actualizar orden de métodos
  updateOrder: async (req, res) => {
    try {
      const { methods } = req.body;

      if (!Array.isArray(methods)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de métodos con sus nuevos órdenes'
        });
      }

      // Actualizar el orden de cada método
      for (const method of methods) {
        if (method.id && method.sort_order !== undefined) {
          await query(
            'UPDATE delivery_methods SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [method.sort_order, method.id]
          );
        }
      }

      // Obtener todos los métodos con el nuevo orden
      const updatedMethods = await query(
        'SELECT * FROM delivery_methods ORDER BY sort_order ASC, name ASC'
      );

      res.json({
        success: true,
        message: 'Orden de métodos de envío actualizado exitosamente',
        data: updatedMethods
      });
    } catch (error) {
      console.error('Error actualizando orden de métodos de envío:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando orden de métodos de envío',
        error: error.message
      });
    }
  }
};

module.exports = deliveryMethodsController;
