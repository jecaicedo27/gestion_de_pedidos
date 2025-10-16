const { query } = require('../config/database');

const carrierController = {
  // Obtener todas las transportadoras
  getAll: async (req, res) => {
    try {
      const carriers = await query(
        'SELECT * FROM carriers ORDER BY active DESC, name ASC'
      );
      
      res.json({
        success: true,
        data: carriers
      });
    } catch (error) {
      console.error('Error obteniendo transportadoras:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo transportadoras',
        error: error.message
      });
    }
  },

  // Obtener solo transportadoras activas
  getActive: async (req, res) => {
    try {
      const carriers = await query(
        'SELECT * FROM carriers WHERE active = TRUE ORDER BY name ASC'
      );
      
      res.json({
        success: true,
        data: carriers
      });
    } catch (error) {
      console.error('Error obteniendo transportadoras activas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo transportadoras activas',
        error: error.message
      });
    }
  },

  // Obtener una transportadora por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const carriers = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [id]
      );
      
      if (carriers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Transportadora no encontrada'
        });
      }
      
      res.json({
        success: true,
        data: carriers[0]
      });
    } catch (error) {
      console.error('Error obteniendo transportadora:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo transportadora',
        error: error.message
      });
    }
  },

  // Crear nueva transportadora
  create: async (req, res) => {
    try {
      const { name, email, phone, website, active = true } = req.body;
      
      // Validar campos requeridos
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es requerido'
        });
      }
      
      // Verificar si ya existe
      const existing = await query(
        'SELECT id FROM carriers WHERE name = ?',
        [name]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una transportadora con ese nombre'
        });
      }
      
      // Insertar nueva transportadora
      const result = await query(
        `INSERT INTO carriers (name, email, phone, website, active) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, email || null, phone || null, website || null, active]
      );
      
      // Obtener la transportadora creada
      const newCarrier = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [result.insertId]
      );
      
      res.status(201).json({
        success: true,
        message: 'Transportadora creada exitosamente',
        data: newCarrier[0]
      });
    } catch (error) {
      console.error('Error creando transportadora:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando transportadora',
        error: error.message
      });
    }
  },

  // Actualizar transportadora
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, website, active } = req.body;
      
      // Verificar que existe
      const existing = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [id]
      );
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Transportadora no encontrada'
        });
      }
      
      // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
      if (name && name !== existing[0].name) {
        const duplicate = await query(
          'SELECT id FROM carriers WHERE name = ? AND id != ?',
          [name, id]
        );
        
        if (duplicate.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otra transportadora con ese nombre'
          });
        }
      }
      
      // Construir query de actualización dinámica
      const updates = [];
      const values = [];
      
      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        values.push(email || null);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone || null);
      }
      if (website !== undefined) {
        updates.push('website = ?');
        values.push(website || null);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        values.push(active);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay campos para actualizar'
        });
      }
      
      values.push(id);
      
      await query(
        `UPDATE carriers SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      // Obtener la transportadora actualizada
      const updated = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Transportadora actualizada exitosamente',
        data: updated[0]
      });
    } catch (error) {
      console.error('Error actualizando transportadora:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando transportadora',
        error: error.message
      });
    }
  },

  // Eliminar transportadora (soft delete - solo desactivar)
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que existe
      const existing = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [id]
      );
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Transportadora no encontrada'
        });
      }
      
      // Verificar si está siendo usada en algún pedido
      const ordersUsingCarrier = await query(
        'SELECT COUNT(*) as count FROM orders WHERE carrier_id = ?',
        [id]
      );
      
      if (ordersUsingCarrier[0].count > 0) {
        // Solo desactivar si está siendo usada
        await query(
          'UPDATE carriers SET active = FALSE WHERE id = ?',
          [id]
        );
        
        res.json({
          success: true,
          message: 'Transportadora desactivada (tiene pedidos asociados)'
        });
      } else {
        // Eliminar completamente si no está siendo usada
        await query(
          'DELETE FROM carriers WHERE id = ?',
          [id]
        );
        
        res.json({
          success: true,
          message: 'Transportadora eliminada exitosamente'
        });
      }
    } catch (error) {
      console.error('Error eliminando transportadora:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando transportadora',
        error: error.message
      });
    }
  },

  // Activar/Desactivar transportadora
  toggleActive: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que existe
      const existing = await query(
        'SELECT * FROM carriers WHERE id = ?',
        [id]
      );
      
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Transportadora no encontrada'
        });
      }
      
      const newStatus = !existing[0].active;
      
      await query(
        'UPDATE carriers SET active = ? WHERE id = ?',
        [newStatus, id]
      );
      
      res.json({
        success: true,
        message: `Transportadora ${newStatus ? 'activada' : 'desactivada'} exitosamente`,
        data: {
          id,
          active: newStatus
        }
      });
    } catch (error) {
      console.error('Error cambiando estado de transportadora:', error);
      res.status(500).json({
        success: false,
        message: 'Error cambiando estado de transportadora',
        error: error.message
      });
    }
  }
};

module.exports = carrierController;
