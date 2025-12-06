# Plan: Mostrar “fotos ya subidas” junto a la cámara en Empaque

Objetivo UX
- Que el usuario vea inmediatamente, y sin dudas, que la(s) foto(s) ya se subieron correctamente.
- Presentar una galería de “fotos subidas” al lado de la cámara, con estado visual de Subiendo → OK/Error, miniaturas clicables (ampliación), y conteo.

Alcance
- Frontend: agregar una galería de evidencias subidas a nivel del componente de captura (PackagingEvidenceCapture).
- Backend: exponer un endpoint simple para listar evidencias por pedido (si no existe). Opcional: eliminar evidencia.

## Cambios de Backend

1) Nuevo endpoint (lectura) para evidencias
- Ruta: GET /packaging/evidence/:orderId
- Respuesta: { success: true, data: { files: [{ id, url, photo_filename, description, taken_at, created_at, size, type }] } }
- Seguridad: requiere permiso ‘packaging’. Devuelve solo evidencias del orderId indicado.
- Implementación:
  - SELECT id, photo_filename, photo_path AS url, description, taken_at, created_at, photo_size AS size, photo_type AS type
    FROM packaging_evidence WHERE order_id = ? ORDER BY created_at DESC LIMIT 100;

2) Emisión opcional por sockets (mejora futura)
- Al subir evidencia (uploadPackagingEvidence), emitir evento ‘packaging-evidence-added’ con { orderId, files: [...] } para actualizar otras sesiones.
- Esta mejora no es imprescindible si la subida es inmediata en la misma sesión.

3) (Opcional) Eliminar evidencia
- Ruta: DELETE /packaging/evidence/:evidenceId
- Permisos: admin o dueño del lock del pedido (discutir política).
- Eliminar registro + archivo físico. No crítico para el objetivo actual.

## Cambios de Frontend

1) Servicio API
- En frontend/src/services/api.js → packagingEvidenceService:
  - Agregar list(orderId): GET /packaging/evidence/:orderId
  - (Opcional) remove(evidenceId): DELETE /packaging/evidence/:evidenceId

2) Componente PackagingEvidenceCapture (frontend/src/pages/PackagingPage.js)
- Estados nuevos:
  - uploadedPhotos: Array<{id, url, created_at, description}> → galería de evidencias ya subidas
  - galleryLoading: boolean
- Efectos:
  - Al montar o cuando cambia ‘orderId’: cargar uploadedPhotos desde packagingEvidenceService.list(orderId). Mostrar skeleton/loader.
  - Después de cada subida exitosa (uploadFiles), agregar los archivos devueltos a uploadedPhotos (al inicio), sin recargar toda la lista.
  - Al montar, usar uploadedPhotos.length para setHasEvidenceUploaded(uploadedPhotos.length > 0) (esto asegura la obligatoriedad desde el comienzo si ya existen fotos previas).

3) UI/UX de la galería
- Ubicación:
  - Escritorio (md+): panel derecho (misma columna donde hoy está la mini-galería de “previews”) renombrado a “Fotos subidas”.
  - Móvil: debajo de la cámara (grid 3 columnas), con scroll vertical limitado (max-h).
- Diseño:
  - Título: “Fotos subidas (N)”
  - Grid responsive: miniaturas (object-cover), ordenado por más recientes primero.
  - Al hacer click: abrir modal/lightbox con la imagen a tamaño grande.
  - Indicadores de estado:
    - Subiendo: overlay con spinner y texto “Subiendo…”
    - OK: check sutil en la esquina (opcional)
    - Error: borde rojo + botón “Reintentar” (si fuera necesario)
  - Acciones:
    - (Opcional) Eliminar (icono papelera) si la política lo permite. Confirmación previa.
  - Accesibilidad:
    - Alt con “Evidencia de empaque – fecha”
    - Focus visible en las miniaturas (teclado)

4) Estados y flujo
- Subida inmediata (ya implementada): al “Capturar” o “Elegir archivos”, llamar uploadFiles(files).
- Mientras sube:
  - Mostrar miniatura en una pequeña sección “En progreso” con estado.
- Al terminar:
  - Mover la miniatura a “Fotos subidas” y actualizar contador.
  - Asegurar setHasEvidenceUploaded(true).
- Error:
  - Mantener en “En progreso” con marca de error y acción “Reintentar” (vuelve a llamar uploadFiles([archivo])).

5) Rendimiento
- Límite inicial: mostrar últimos 12-24 elementos.
- Botón “Ver más…” para cargar más desde el backend (paginación simple futura con ?offset/limit).
- Carga diferida (lazy-load) de miniaturas usando loading="lazy".
- Evitar re-render innecesario con keys estables (id).

6) Detalles técnicos
- Rutas de imagen:
  - El backend guarda photo_path tipo “/uploads/delivery_evidence/<file>”. Es una ruta servida por Nginx/Express; usarla directo en src.
- Tamaños:
  - Miniaturas ~ h-20/h-24 (según diseño actual), object-cover, border radius leve.
- Lightbox:
  - Usar modal simple propio o una librería ligera (preferible modal propio para no aumentar bundle).

## QA / Pruebas

- Flujo normal:
  - Entrar a pedido en empaque → ver galería cargada (si hay evidencias previas).
  - Capturar una foto → aparece “Subiendo…” → pasa a “OK” y se ve en galería.
  - “Pausar” se habilita automáticamente una vez exista al menos 1 foto en la galería.
- Condiciones adversas:
  - Red lenta/intermitente: mostrar “Subiendo…” y “Error” con reintento.
  - Refresh de página: al recargar, la galería debe poblarse con las evidencias ya guardadas en BD.
- Móvil:
  - Rejilla y scroll se deben ver fluidos; sin desbordes.

## Estimación

- Backend (GET list): 0.5 h
- Servicio API + estados + UI galería (desktop+mobile): 2.5–3.5 h
- Manejo de estados Subiendo/OK/Error y lightbox: 1–1.5 h
- QA + ajustes: 0.5–1 h

Total estimado: 4.5–6.5 horas de implementación y pruebas.

## Entregables

- Endpoint GET /packaging/evidence/:orderId (y opcional DELETE)
- packagingEvidenceService.list(orderId)
- UI de galería “Fotos subidas” en PackagingEvidenceCapture, con:
  - Carga inicial,
  - Actualización tras subida,
  - Estados de subiendo/ok/error,
  - Miniaturas clicables y modal/lightbox,
  - Contador actualizado y sincronización con obligatoriedad.

## Notas de diseño

- Mantener consistencia con el estilo actual (botones, bordes, tipografía).
- No bloquear la cámara mientras sube; la galería se alimenta en paralelo.
- No romper el gating de “Pausar”/“Finalizar”; basarlo en uploadedPhotos.length > 0 (inicial + nuevas).
