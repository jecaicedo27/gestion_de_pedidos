# Flujo de Cobros en Bodega (Logística y Cartera)

Objetivo: soportar de forma efectiva ambos escenarios de cobro en pedidos de Recoge en Bodega/Tienda: (a) cuando Cartera no está presente y Logística recibe el dinero, y (b) cuando Cartera está presente y recibe el dinero directamente. El sistema debe registrar, controlar y cerrar las actas de entrega diarias de Bodega.

## Roles y permisos
- Logística: puede registrar cobros en bodega (status = pending). No puede aceptar los cobros.
- Cartera: puede registrar cobros en bodega y se aceptan de inmediato (status = collected), o aceptar los cobros pendientes registrados por Logística.
- Admin/Super Admin: mismo alcance que Cartera.

Campos clave (tabla `cash_register`):
- `order_id`, `amount`, `payment_method`, `delivery_method`, `registered_by`, `notes`.
- `status`: 'pending' (registrado por Logística), 'collected' (aceptado por Cartera/Admin).
- `accepted_by`, `accepted_at`, `accepted_amount`.

## Flujo A: Logística recibe dinero (Cartera ausente)
1) Logística abre Pedidos por Entregar y pulsa "Registrar Pago" en un pedido de Recoge en Bodega.
2) Backend (`POST /logistics/receive-pickup-payment`) crea `cash_register` en status 'pending' con `registered_by=usuario logística`.
3) El pedido se mantiene visible; no se entrega automáticamente.
4) Cartera entra a Cartera > Entrega de Efectivo:
   - En la tarjeta "Facturas pendientes por recibir efectivo" aparecen tanto:
     - Entregas de mensajero pendientes.
     - Cobros de bodega en `cash_register` con status 'pending'.
   - Cartera pulsa "Aceptar" en cada fila de bodega (endpoint `POST /cartera/cash-register/:id/accept`).
5) Una vez aceptado, el registro pasa a status 'collected' y alimenta el consolidado diario de Bodega (acta de bodega), visible en la tarjeta derecha "Actas de entrega (cierres de caja)". Cartera puede imprimir recibos y cerrar el día por fecha.

## Flujo B: Cartera recibe dinero directamente (Cartera presente)
1) Cartera registra pago en bodega desde Logística (o desde un flujo propio si se habilita botón en su vista):
   - Backend (`POST /logistics/receive-pickup-payment`) detecta rol Cartera/Admin y registra **aceptado en el acto**: `status='collected'`, `accepted_by=usuario cartera`, `accepted_amount=amount`.
2) Este cobro **no aparece** en "pendientes" (ya está aceptado), sino que entra directo al consolidado diario de Bodega por fecha (`/cartera/handovers/bodega/:date`).
3) Cartera puede:
   - Abrir el consolidado del día para revisar ítems.
   - Imprimir recibo por cada entrada (endpoint `/cartera/cash-register/:id/receipt`).

## Entornos de consulta y cierres
- Pendientes Cartera: `GET /cartera/pending`
  - Incluye: entregas de mensajero sin aceptar y registros de bodega `cash_register.status='pending'`.
- Actas por mensajero: `GET /cartera/handovers` y detalle `GET /cartera/handovers/:id`.
- Bodega consolidado diario:
  - Listado: `GET /cartera/handovers` (registros con `source='bodega'`).
  - Detalle por fecha: `GET /cartera/handovers/bodega/:date`.
  - Recibo: `GET /cartera/handovers/bodega/:date/receipt`.
  - Para cada ítem de bodega: `GET /cartera/cash-register/:id/receipt`.

## Consideraciones de UI
- Logística (Pedidos por Entregar):
  - "Registrar Pago" crea registro en caja:
    - Si lo hace Logística: queda pendiente para Cartera.
    - Si lo hace Cartera/Admin: se acepta en el acto y alimenta consolidado.
  - El pedido **permanece** en la lista hasta pulsar "Entregar".

- Cartera (Entrega de Efectivo):
  - Izquierda (pendientes): muestra mensajero + bodega pendientes (botones "Aceptar").
  - Derecha (actas):
    - Mensajero: actas con totales por cierre normal.
    - Bodega: consolidado por día (sumatoria de `cash_register.status='collected'`), con detalle e impresión.
  - Detalle Bodega por día corrige el problema de TZ: la fecha se envía como YYYY-MM-DD puro (evita desfases de un día).

## Registros y trazabilidad
- Cada `cash_register` almacena `registered_by`, `accepted_by`, `status`, `accepted_at`, `notes` (incluyendo referencia a evidencia si aplica).
- Los cambios de estado del pedido no se alteran con el registro/aceptación del cobro; la entrega en bodega se realiza con `POST /logistics/mark-pickup-delivered` cuando corresponda.

## Reglas de negocio claves
- Solo Cartera/Admin pueden **aceptar** dinero (cambiar a `collected`). Logística solo **registra** (pending).
- Si Cartera recibe y registra, **se acepta en el acto** para no duplicar pasos.
- Los consolidado diarios de Bodega se construyen con `cash_register.status='collected'` agrupados por `DATE(accepted_at)`.
- La entrega final en bodega requiere:
  - No requerir cobro o tener pago validado por Cartera (según reglas del pedido), antes de `mark-pickup-delivered`.

## Endpoints relevantes
- Registrar pago en bodega (Logística/Cartera): `POST /logistics/receive-pickup-payment`
- Aceptar registro de bodega (Cartera): `POST /cartera/cash-register/:id/accept`
- Pendientes cartera: `GET /cartera/pending`
- Bodega, detalle día: `GET /cartera/handovers/bodega/:date`
- Entrega en bodega: `POST /logistics/mark-pickup-delivered`
- Recibos (HTML): `/cartera/cash-register/:id/receipt`, `/cartera/handovers/bodega/:date/receipt`

## Validaciones adicionales
- Transferencia en bodega requiere evidencia fotográfica.
- Evitar duplicidad: un pedido solo puede tener un `cash_register` asociado.
- Si `orders.requires_payment=0` (sin cobro), se permite entregar en bodega sin validación adicional.

## Estado actual del código
- Backend:
  - logisticsController.receivePickupPayment: acepta roles Cartera/Admin/Logística; Cartera/Admin -> `status=collected` (aceptado); Logística -> `status=pending`.
  - Rutas de Cartera implementadas para pendientes, aceptación y consolidado.
- Frontend:
  - CashierCollectionsPage: formato de fecha robusto para consolidado Bodega (corrige TZ) y carga de detalle/recibos.
  - ReadyToDeliverPage: tras "Registrar Pago" el pedido se mantiene hasta "Entregar".

Esto cubre los dos escenarios operativos y asegura visibilidad completa para Cartera, con trazabilidad de quién registró y quién aceptó cada cobro.
