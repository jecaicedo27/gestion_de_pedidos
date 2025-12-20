export function formatCurrencyCOP(amount) {
    const n = Number(amount) || 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}
