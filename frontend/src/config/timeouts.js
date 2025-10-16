// Configuración de timeouts específicos para diferentes endpoints
export const API_TIMEOUTS = {
  DEFAULT: 30000,        // 30 segundos para endpoints normales
  SIIGO_INVOICES: 180000, // 3 minutos para facturas SIIGO
  SIIGO_IMPORT: 120000,   // 2 minutos para importar factura
  SIIGO_CONNECTION: 15000, // 15 segundos para verificar conexión
  FILE_UPLOAD: 60000,     // 1 minuto para subir archivos
  REPORTS: 90000          // 1.5 minutos para reportes
};

// Función helper para obtener timeout según el endpoint
export const getTimeoutForEndpoint = (endpoint) => {
  if (endpoint.includes('/siigo/invoices')) {
    return API_TIMEOUTS.SIIGO_INVOICES;
  }
  if (endpoint.includes('/siigo/import')) {
    return API_TIMEOUTS.SIIGO_IMPORT;
  }
  if (endpoint.includes('/siigo/connection')) {
    return API_TIMEOUTS.SIIGO_CONNECTION;
  }
  if (endpoint.includes('upload')) {
    return API_TIMEOUTS.FILE_UPLOAD;
  }
  if (endpoint.includes('report')) {
    return API_TIMEOUTS.REPORTS;
  }
  return API_TIMEOUTS.DEFAULT;
};
