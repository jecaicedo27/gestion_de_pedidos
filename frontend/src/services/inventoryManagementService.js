import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para incluir el token en todas las peticiones
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const inventoryManagementService = {
    // Obtener vista completa de inventario
    getView: async (params = {}) => {
        const response = await api.get('/inventory-management/view', { params });
        return response.data;
    },

    // Obtener configuración de un producto
    getProductConfig: async (productId) => {
        const response = await api.get(`/inventory-management/products/${productId}/config`);
        return response.data;
    },

    // Actualizar configuración de un producto
    updateProductConfig: async (productId, config) => {
        const response = await api.put(`/inventory-management/products/${productId}/config`, config);
        return response.data;
    },

    // Ejecutar análisis de consumo
    analyzeConsumption: async (params) => {
        const response = await api.post('/inventory-management/analyze', params);
        return response.data;
    },

    // Calcular clasificación ABC
    calculateABC: async () => {
        const response = await api.post('/inventory-management/calculate-abc');
        return response.data;
    },

    exportToExcel: async () => {
        try {
            const response = await api.get('/inventory-management/export-excel', {
                responseType: 'blob'
            });

            // Crear link de descarga
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            return true;
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            return false;
        }
    },

    generatePurchaseOrder: async (supplier) => {
        try {
            const response = await api.post('/inventory-management/generate-purchase-order', { supplier }, {
                responseType: 'blob'
            });

            // Crear blob y descargar
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Orden_Compra_${supplier.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            return true;
        } catch (error) {
            console.error('Error generating Purchase Order:', error);
            // Intentar leer el mensaje de error del blob si es posible
            if (error.response && error.response.data instanceof Blob) {
                const text = await error.response.data.text();
                try {
                    const json = JSON.parse(text);
                    return { success: false, message: json.message };
                } catch (e) { }
            }
            return { success: false, message: 'Error generando orden de compra' };
        }
    },

    getKPIs: async () => {
        const response = await api.get('/inventory-management/kpis');
        return response.data;
    }
};

export default inventoryManagementService;
