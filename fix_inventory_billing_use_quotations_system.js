const fs = require('fs');
const path = require('path');

console.log('🔧 Arreglando sistema de inventario para usar el sistema exitoso de cotizaciones...');

// Leer el archivo actual del inventario billing
const inventoryBillingPath = path.join(__dirname, 'frontend', 'src', 'pages', 'InventoryBillingPage.js');
const inventoryContent = fs.readFileSync(inventoryBillingPath, 'utf8');

console.log('📝 Modificando InventoryBillingPage para usar el endpoint exitoso de cotizaciones...');

// Buscar la función processInvoice y reemplazarla completamente
const newProcessInvoiceFunction = `
  // Procesar facturación usando el sistema exitoso de cotizaciones
  const processInvoice = async () => {
    if (!selectedCustomer) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setProcessingInvoice(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // NUEVA ESTRATEGIA: Usar el endpoint exitoso de cotizaciones
      // que ya maneja correctamente el mapeo de códigos SIIGO
      const invoiceData = {
        customer_id: selectedCustomer.id,
        items: cart.map(item => ({
          // Usar el formato que funciona en cotizaciones
          code: item.siigo_code || item.product_code || item.barcode || \`PROD-\${item.id}\`,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          siigo_code: item.siigo_code || item.product_code || item.barcode,
          product_code: item.product_code || item.siigo_code
        })),
        invoice_type: 'FV-1',
        documentType: 'FV-1',
        notes: \`Factura FV-1 generada desde inventario directo - \${new Date().toLocaleString()}\`
      };

      console.log('📊 Enviando datos usando formato exitoso de cotizaciones:', invoiceData);

      // Usar el endpoint de cotizaciones que YA FUNCIONA PERFECTAMENTE
      const response = await fetch('/api/quotations/create-invoice', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(\`✅ Factura FV-1 creada exitosamente: \${data.data.siigo_invoice_number}\`);
        console.log('✅ Factura creada exitosamente:', data.data);
        
        // Mostrar información adicional si está disponible
        if (data.data.siigo_public_url) {
          toast.success(\`🔗 URL: \${data.data.siigo_public_url}\`);
        }
        
        // Limpiar carrito y cerrar checkout
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchValue('');
        setShowCheckout(false);
        
        // Recargar inventario para actualizar stock
        loadInventoryProducts();
      } else {
        console.error('❌ Error del servidor:', data);
        toast.error('Error creando factura: ' + (data.message || 'Error desconocido'));
        
        // Mostrar detalles adicionales del error si están disponibles
        if (data.details) {
          console.error('Detalles del error:', data.details);
        }
        if (data.error) {
          console.error('Error específico:', data.error);
        }
      }
    } catch (error) {
      console.error('❌ Error de red:', error);
      toast.error('Error de conexión al procesar factura');
    } finally {
      setProcessingInvoice(false);
    }
  };`;

// Reemplazar la función processInvoice existente
const updatedContent = inventoryContent.replace(
  /\/\/ Procesar facturación[\s\S]*?};/,
  newProcessInvoiceFunction
);

// Escribir el archivo actualizado
fs.writeFileSync(inventoryBillingPath, updatedContent);

console.log('✅ InventoryBillingPage.js actualizado exitosamente!');
console.log('🎯 Ahora el inventario usa el mismo sistema que funciona en cotizaciones');
console.log('📋 Los productos se enviarán con el formato correcto que SIIGO acepta');
console.log('🔄 Reinicia el frontend para ver los cambios');
