# Plan del Sistema de Postventa Integral

Estado: Propuesta técnica y operativa
Autor: Cline
Fecha: 2025-11-28

## Objetivo y Alcance

Construir un sistema de Postventa robusto que:
- Retenga clientes, incremente frecuencia de compra y ticket promedio.
- Reduzca churn, reclamos y tiempos de resolución.
- Potencie crecimiento vía referidos, reseñas y cross/upsell.
- Provea una vista 360 del cliente (historial, valor, riesgo, feedback, interacciones).
- Orqueste journeys omnicanal (WhatsApp/SMS/Email) con consentimiento y medición.

El diseño se integra con los módulos actuales de la app: Órdenes, Logística/Mensajería, Cartera/Tesorería, Facturación (Siigo), y Analytics.

## Principios de Diseño

- Base en eventos: cada hito postventa dispara acciones (survey, ticket, journey).
- Segmentación dinámica y scoring (RFM, valor, riesgo).
- Omnicanal con plantillas aprobadas, tracking y opt-in/opt-out.
- Servicios desacoplados y “job-safe” (reintentos, idempotencia).
- Medición full-funnel: desde pedido → experiencia → recompra → LTV.

## Arquitectura (alto nivel)

Servicios (backend/services/postventa):
- eventBusService: publicación/consumo de eventos internos, con outbox table para durabilidad.
- surveyService: NPS/CSAT/CES; envíos y recepción de respuestas (webhook).
- messagingService: adaptadores de WhatsApp/SMS/Email; plantillas; registro de interacciones.
- ticketService: creación automática, SLA/estados, notas y adjuntos.
- segmentationService: reglas RFM y segmentos dinámicos.
- journeyService: motor de workflows (post-entrega, reactivación, cobranza).
- loyaltyService y referralsService: puntos, niveles y referidos.
- riskService: score de riesgo y políticas preventivas.
- analyticsService: KPIs, cohortes, LTV y reportes.

Integraciones:
- orderController y logisticsController: emiten eventos “order.delivered”, “delivery.incident”, “order.returned”.
- carteraController/treasuryController: eventos “payment.pending/overdue/resolved”.
- messengerController: calidad de entrega/evidencia → feedback trigger.
- siigoInvoiceService: datos fiscales para enriquecer 360 y valor monetario.

## Modelo de Datos (MySQL)

Claves y convenciones:
- Todas con `id` autoincrement, `created_at`, `updated_at` donde aplique.
- `customer_id` referencia a tabla `customers`.
- Índices en `(customer_id, created_at)` para historiales; campos de búsqueda por estado/segmento.

Tablas nuevas (DDL de referencia):

1) customer_profiles
- customer_id (unique, FK)
- rfm_recency INT
- rfm_frequency INT
- rfm_monetary DECIMAL(12,2)
- rfm_segment ENUM('champion','leal','potencial','en_riesgo','dormido','nuevo') NULL
- value_score DECIMAL(5,2)
- risk_score DECIMAL(5,2)
- avg_order_value DECIMAL(12,2)
- returns_rate DECIMAL(5,2)
- complaints_count INT
- last_order_at DATETIME NULL
- attributes JSON NULL
- INDEX (rfm_segment), INDEX (risk_score), INDEX (value_score)

2) customer_consents
- customer_id
- channel ENUM('whatsapp','sms','email')
- scope ENUM('transaccional','marketing','todos')
- opt_in_at DATETIME NULL
- opt_out_at DATETIME NULL
- source VARCHAR(100) NULL
- UNIQUE KEY (customer_id, channel, scope)

3) customer_interactions
- customer_id
- order_id NULL
- channel ENUM('whatsapp','sms','email','telefono','interno')
- direction ENUM('incoming','outgoing')
- template_key VARCHAR(100) NULL
- content TEXT NULL
- metadata JSON NULL
- status ENUM('sent','delivered','failed','read','responded') NULL
- user_id NULL
- INDEX (customer_id, created_at), INDEX (order_id)

4) tickets
- customer_id
- order_id NULL
- source ENUM('nps','logistica','cartera','manual','otros')
- category ENUM('entrega','producto','pago','atencion','otros')
- status ENUM('nuevo','en_progreso','esperando_cliente','resuelto','escalado','cerrado') DEFAULT 'nuevo'
- priority ENUM('baja','media','alta','critica') DEFAULT 'media'
- sla_due_at DATETIME NULL
- assignee_id NULL
- INDEX (status), INDEX (priority), INDEX (sla_due_at)

5) ticket_updates
- ticket_id
- user_id NULL
- note TEXT NULL
- attachments JSON NULL
- prev_status ENUM(...) NULL
- new_status ENUM(...) NULL
- created_at DATETIME

6) surveys
- customer_id
- order_id
- channel ENUM('whatsapp','sms','email')
- nps TINYINT NULL
- csat TINYINT NULL
- ces TINYINT NULL
- comment TEXT NULL
- sent_at DATETIME
- responded_at DATETIME NULL
- attributes JSON NULL
- INDEX (order_id), INDEX (responded_at)

7) segments
- name VARCHAR(120)
- rule_json JSON
- is_dynamic TINYINT(1) DEFAULT 1
- created_by INT NULL

segment_members
- segment_id
- customer_id
- computed_at DATETIME
- UNIQUE (segment_id, customer_id)

8) campaigns
- type ENUM('broadcast','triggered')
- template_id
- segment_id NULL
- status ENUM('draft','scheduled','running','paused','finished') DEFAULT 'draft'
- scheduled_at DATETIME NULL
- name VARCHAR(120)
- metadata JSON NULL

campaign_logs
- campaign_id
- customer_id
- channel ENUM('whatsapp','sms','email')
- status ENUM('sent','delivered','failed','clicked','responded')
- metadata JSON NULL
- created_at DATETIME

9) journeys
- name VARCHAR(120)
- definition_json JSON
- active TINYINT(1) DEFAULT 0

journey_executions
- journey_id
- customer_id
- state ENUM('waiting','executing','paused','completed','cancelled') DEFAULT 'waiting'
- step_index INT DEFAULT 0
- last_event_at DATETIME
- metadata JSON NULL
- INDEX (journey_id, state), INDEX (customer_id, state)

10) templates
- channel ENUM('whatsapp','sms','email')
- `key` VARCHAR(100) UNIQUE
- content TEXT
- variables JSON NULL
- approved TINYINT(1) DEFAULT 0

11) loyalty_points
- customer_id UNIQUE
- balance INT DEFAULT 0
- level ENUM('bronze','silver','gold','platinum') DEFAULT 'bronze'

loyalty_movements
- customer_id
- points INT
- reason ENUM('purchase','feedback','referral','adjustment')
- order_id NULL
- meta JSON NULL
- created_at DATETIME

12) referrals
- referrer_customer_id
- referred_customer_id NULL
- code VARCHAR(20) UNIQUE
- state ENUM('generated','registered','first_purchase','rewarded','cancelled') DEFAULT 'generated'
- reward_points INT DEFAULT 0

13) churn_risk
- customer_id UNIQUE
- score DECIMAL(5,2)
- features_json JSON
- updated_at DATETIME

14) audit_logs
- entity VARCHAR(60)
- entity_id INT
- action VARCHAR(60)
- user_id INT NULL
- meta JSON NULL
- created_at DATETIME
- INDEX (entity, entity_id), INDEX (created_at)

15) postventa_events (outbox)
- event_type VARCHAR(100)
- payload JSON
- processed TINYINT(1) DEFAULT 0
- processed_at DATETIME NULL
- retries INT DEFAULT 0
- INDEX (event_type, processed)

## Eventos a Instrumentar (payload ejemplo)

- order.delivered
```json
{
  "type": "order.delivered",
  "orderId": 12345,
  "customerId": 678,
  "deliveredAt": "2025-11-28T10:15:00Z",
  "city": "Bogotá",
  "carrier": "Mensajero X",
  "paymentMethod": "contraentrega",
  "total": 123000
}
```

- delivery.incident
```json
{
  "type": "delivery.incident",
  "orderId": 12345,
  "customerId": 678,
  "incident": "paquete_dañado",
  "notes": "Caja abollada",
  "reportedAt": "2025-11-28T10:20:00Z"
}
```

- payment.overdue
```json
{
  "type": "payment.overdue",
  "orderId": 12345,
  "customerId": 678,
  "daysOverdue": 3,
  "amount": 123000,
  "dueDate": "2025-11-25"
}
```

Hook sugerido (Node):
```js
await eventBusService.emit('order.delivered', { ...payload });
```

## Endpoints Propuestos (backend/routes/postventa.js)

- GET /postventa/customers/:id/360
- CRUD /postventa/tickets; POST /postventa/tickets/:id/assign; POST /postventa/tickets/:id/close
- POST /postventa/surveys/send; POST /postventa/surveys/webhook (respuesta proveedor)
- CRUD /postventa/segments; GET /postventa/segments/:id/members
- CRUD /postventa/campaigns; POST /postventa/campaigns/:id/execute
- CRUD /postventa/journeys; POST /postventa/journeys/:id/activate; POST /postventa/journeys/:id/pause
- CRUD /postventa/templates
- GET/POST /postventa/loyalty; GET/POST /postventa/referrals
- GET/POST /postventa/consents
- GET /postventa/reports/kpis; /cohortes; /rfm; /tickets-sla

## Servicios y Lógica Clave

- surveyService
  - Enviar NPS/CSAT por WhatsApp/SMS/Email dentro de 2–6h post-entrega.
  - Webhook de respuesta: guardar nps/csat, comentario, disparar automatizaciones.
  - Regla: NPS < 7 → auto-ticket con prioridad segun categoría.

- ticketService
  - Estados: nuevo → en_progreso → (esperando_cliente) → resuelto/cerrado/escalado.
  - SLA por severidad; alertas por vencimiento. Notas, adjuntos, macros.
  - Auto-creación por delivery.incident, payment.overdue, NPS bajo.

- messagingService
  - Adaptadores pluggables (proveedor WhatsApp/SMS/Email).
  - Plantillas con variables; seguimiento de estados; registro en customer_interactions.

- segmentationService
  - Cálculo RFM recurrente; asignación de segmentos y tags.
  - Segmentos dinámicos por reglas JSON (ej: morosos>7 días, reclamos>2, AOV>100k).

- journeyService
  - Workflows: post-entrega, reactivación 30/60/90, cobranza preventiva, cross/upsell.
  - Ventanas horarias, límites de frecuencia, opt-out respeto, reintentos.

- loyaltyService y referralsService
  - Puntos por compra/feedback/referido; niveles con beneficios.
  - Códigos de referido únicos; atribución a primera compra; recompensas antifraude.

- riskService
  - Score por morosidad, devoluciones, reclamos, ticket, promesa de pago incumplida.
  - Políticas: anticipo obligatorio o verificación extra para alto riesgo.

- analyticsService
  - KPIs: Retención, Recompra, LTV, Churn, NPS, TTR/TTResolve, Cohortes.
  - Desempeño por producto, mensajero, ciudad, campaña, segmento.

## Frontend (React)

Nuevas páginas:
- Customer360Page: KPIs, timeline, segmentos, consentimientos, puntos, tickets.
- TicketsPage: cola, filtros, SLAs, panel de agente, notas, adjuntos, macros.
- SurveysPage: envíos, respuestas, análisis de temas/sentimiento (v2).
- SegmentsPage: constructor de reglas y vista de miembros.
- JourneysPage: diseñador y monitoreo de flujos.
- CampaignsPage: plantillas, ejecuciones, resultados.
- LoyaltyPage y ReferralsPage.
- ReportsPostventaPage: NPS/CSAT, Retención, Recompra, Churn, Cohortes, SLA.

Componentes:
- SurveyModal, TicketModal, TagEditor, ConsentSwitch, RFMCard, Timeline, SLAChip.

## Journeys de Referencia

1) Post-Entrega
- T+0h: Gracias + info de soporte.
- T+4h: Encuesta NPS/CSAT.
  - Detractor (<7): crear ticket, asignar agente, pedir más info.
  - Promotor (9–10): solicitar review/referral, otorgar puntos.
- T+7d: Cross-sell basado en categoría comprada si sin reclamos.

2) Reactivación
- 30/60/90 días sin compra: ofertas graduales y contenido relevante.
- Si no hay consentimiento marketing: solo transaccional o nada.

3) Cobranza Preventiva
- D+0: recordatorio cordial con opciones de pago.
- D+3: escalamiento suave; D+7: intensivo; si “alto riesgo”: ruta especial.
- Cierre: agradecer pago + puntos o beneficio.

## KPIs y Métricas

- Retención 30/60/90; Repeat Purchase Rate; Frecuencia media; AOV; LTV; Churn.
- NPS/CSAT/CES por producto/mensajero/ciudad/campaña/cohorte.
- TTR/TTResolve, % SLA cumplido, % reclamos por pedido.
- % referidos, revenue de referidos, uso de puntos.
- Eficacia de journeys: open/click/recompra; uplift vs control.

## Roadmap por Fases

Fase 1 (1–2 semanas): Fundaciones y Quick Wins
- Eventos post-venta desde Órdenes/Logística.
- Survey post-entrega (NPS/CSAT) por WhatsApp/SMS + panel simple.
- Auto-ticket para NPS <7 y para “incidencia de entrega”.
- Customer 360 v1 (historial de pedidos, feedback, tickets).

Fase 2 (2–3 semanas): Segmentación, Journeys y Omnicanal
- RFM y segmentos dinámicos.
- Journeys: post-entrega completo y reactivación 30/60/90.
- messagingService unificado con plantillas y consentimiento.
- Tickets con SLA y prioridades.

Fase 3 (2–3 semanas): Fidelización, Referidos y Riesgo
- Puntos y niveles + reglas de canje.
- Programa de referidos con tracking y antifraude.
- Cobranza preventiva y flags de riesgo integrados con Cartera.

Fase 4 (2 semanas): Analytics avanzado y Marca
- Dashboards completos, cohortes y LTV.
- Análisis de feedback (temas/sentimiento).
- UGC/testimonios y playbooks de experiencia.

## Criterios de Éxito

- +X% tasa de recompra y retención 60/90 días.
- −Y% en TTR y reclamos por pedido; +NPS promedio.
- Conversión a recompra de journeys > umbral.
- % de referidos en ventas y uso de puntos significativo.
- Identificación confiable de “Champions”, “En riesgo” y “Morosos” con acciones.

## Siguientes Pasos Inmediatos (Fase 1)

1) Migraciones iniciales:
- surveys, tickets, ticket_updates, customer_profiles, customer_consents, customer_interactions, templates, postventa_events.

2) Instrumentación de eventos:
- orderController/logisticsController: emitir order.delivered y delivery.incident.
- carteraController/treasuryController: payment.pending/overdue/resolved.

3) surveyService:
- POST /postventa/surveys/send (por orderId) y webhook de respuesta.
- Guardar respuesta y disparar auto-ticket si NPS <7.

4) ticketService:
- CRUD tickets + asignación/cierre; SLA básico e indicadores.

5) Customer 360 v1:
- GET /postventa/customers/:id/360 agregando pedidos, tickets, encuestas e interacciones.
- Página simple en frontend para consulta interna.

6) Plantillas iniciales:
- “Gracias por tu compra” (transaccional)
- NPS/CSAT (post-entrega)
- Rescate detractor (soporte) y solicitud de reseña a promotores.

## Riesgos y Mitigaciones

- Saturación de mensajes: límites de frecuencia y ventanas horarias; opt-out respetado.
- Calidad de datos de contacto: validaciones y consolidación de identidad.
- Dependencias de proveedor de mensajería: adaptador y fallback de canal.
- Escalabilidad: outbox + reintentos; colas si crecimiento (BullMQ u otro, en Fase 2/3).
- Cumplimiento y consentimientos: auditoría y scopes claros (marketing vs transaccional).

## Conexión con el Repo Actual

- Hooks en:
  - backend/controllers/orderController.js
  - backend/controllers/logisticsController.js
  - backend/controllers/carteraController.js y backend/controllers/treasuryController.js
  - backend/controllers/messengerController.js
- Nuevos módulos:
  - backend/routes/postventa.js
  - backend/controllers/postventa/*
  - backend/services/postventa/*
  - backend/scripts/migrations_postventa/*
- Frontend:
  - frontend/src/pages/Customer360Page.js
  - frontend/src/pages/TicketsPage.js
  - frontend/src/pages/SurveysPage.js
  - frontend/src/pages/ReportsPostventaPage.js
  - frontend/src/components/postventa/*

## Ejemplo de Plantilla NPS (WhatsApp)

Clave: postventa_nps_v1  
Contenido:
“Hola {first_name}, soy del equipo de {brand}. ¿Qué tan probable es que nos recomiendes a un amigo o colega? Responde con un número de 0 a 10. ¡Gracias!”

Reglas:
- Si respuesta < 7: crear ticket “Detractor”, prioridad “alta”, pedir comentario adicional.
- Si respuesta 9–10: agradecer y enviar link de reseña/referral con puntos.

---

Este documento es la guía de implementación. A partir de aquí, iniciamos Fase 1 con migraciones, eventos, encuestas y tickets, para entregar valor rápido y medir impacto desde el día 1.
