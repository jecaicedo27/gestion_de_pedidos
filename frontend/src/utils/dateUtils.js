/**
 * Obtiene la fecha y hora local en formato ISO (YYYY-MM-DDTHH:mm:ss.sss)
 * Ajustando el offset de la zona horaria del navegador.
 * Útil para inicializar inputs type="datetime-local" o "date".
 */
export const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - offset);
    return localDate.toISOString();
};

/**
 * Obtiene solo la fecha local en formato YYYY-MM-DD
 */
export const getLocalDateString = () => {
    return getLocalISOString().slice(0, 10);
};
