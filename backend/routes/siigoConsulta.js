const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const siigoConsultaController = require('../controllers/siigoConsultaController');

/**
 * Rutas para consultas avanzadas SIIGO - Solo para administradores
 */

// Middleware: Todas las rutas requieren autenticación y rol de administrador
router.use(verifyToken);
router.use(verifyAdmin);

// GET /api/siigo-consulta/estado - Verificar estado de conexión SIIGO
router.get('/estado', siigoConsultaController.estadoConexionSiigo);

// GET /api/siigo-consulta/buscar?termino=xxx - Buscar clientes por nombre/término
router.get('/buscar', siigoConsultaController.buscarClientes);

// GET /api/siigo-consulta/cliente/:nit - Obtener información completa de cliente por NIT
router.get('/cliente/:nit', siigoConsultaController.consultarClientePorNit);

module.exports = router;
