// Consulta SQL usada para obtener pedidos con información de transportadora

console.log(`
📋 CONSULTA SQL PARA OBTENER TRANSPORTADORAS:

La función getReadyForDeliveryOrders() en logisticsController.js usa esta consulta:

SELECT 
  o.id, 
  o.order_number, 
  o.customer_name, 
  o.status, 
  o.delivery_method,
  o.total_amount, 
  o.created_at, 
  o.updated_at, 
  o.carrier_id,
  c.name as carrier_name
FROM orders o
LEFT JOIN carriers c ON o.carrier_id = c.id
WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
ORDER BY o.created_at ASC

🔍 EXPLICACIÓN:
- Se hace un LEFT JOIN entre 'orders' y 'carriers'
- La conexión se hace através del campo 'carrier_id'
- Si carrier_id es NULL, carrier_name será NULL también
- Se obtienen todos los pedidos con estado: listo_para_entrega, empacado, o listo

📊 CAMPOS CLAVE:
- o.carrier_id: ID numérico de la transportadora
- c.name: Nombre de la transportadora (ej: "Interrapidísimo", "Envía")

🎯 AGRUPACIÓN:
Luego en el código se agrupa por transportadora usando carrier_name:
- "Interrapidísimo" -> grupo interrapidisimo
- "Envía" -> grupo envia
- "Camión Externo" -> grupo camion_externo
- etc.
`);
