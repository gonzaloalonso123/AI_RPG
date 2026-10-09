# Operaciones

## Entornos y publicación

- Local: proyecto `demo-story-master`, emuladores y proveedor mock. El estado persiste mediante export/import. No hay recursos pagados.
- Staging: proyecto real separado; validación de Auth, App Check, índices, colas, secretos, proveedor y almacenamiento privado.
- Producción: solo tras el checklist y autorización de despliegue. No existe un despliegue público de esta implementación.

El entorno cloud conserva archivos y dependencias al publicarlo desde el producto; no conserva procesos activos. La configuración guardada describe instalación y arranque, pero guardarla no ejecuta ni publica nada.

## Arranque y salud

Desde `/workspace/AI_RPG`, activa `/workspace/toolchains/activate.sh`, ejecuta `pnpm emulators` y, en otra terminal, `pnpm dev`. Espera a que todos los emuladores estén listos y las funciones cargadas. La callable autenticada `health` devuelve versión de esquema, región y modo. Una conexión TCP por sí sola no demuestra juego funcional: ejecuta los tests de integración y de dos contextos.

Tras cambios en paquetes, reinicia Vite. Tras cambios en backend, ejecuta `node scripts/build-functions.mjs`; el emulador observa el artefacto compilado. No edites `functions/lib/index.cjs` a mano.

## Tareas y fallos

`jobs` es outbox duradero y registro de ejecución. Estados: pending, running, done, failed, uncertain. `leaseUntil` y `fence` coordinan invocaciones concurrentes; la semilla se guarda antes de resolver.

- `failed` antes de una llamada pagada: revisar error/configuración; se puede corregir la intención o reintentar solo presentación.
- `uncertain`: hay una reserva previa y no puede saberse con certeza si el proveedor terminó/cobró. No cambiarlo a pending indiscriminadamente. Revisar el request ID/portal y decidir una nueva llamada autorizada.
- `running` con lease caducado: el reconciliador vuelve a entregarlo. Si había una reserva, el trabajador detiene la repetición automática del cargo.
- Imagen antigua: puede completar caché, pero nunca aplica a otra `sceneVersion`.
- Texto fallido: se mantiene la narración factual del dominio.
- Presupuesto cero/agotado: la partida muestra el motivo y el estado confirmado sigue disponible.

Cloud Scheduler revisa cada cinco minutos trabajos y borrados. En local se prueba recuperación invocando el mismo trabajador, porque el scheduler no se reproduce fielmente. No asumas que cerrar la página cancela un trabajo.

## Límites y métricas

Máximo cinco instancias por función, tres dispatches de cola simultáneos y dos tareas pagadas por campaña. Límites por usuario para comandos y códigos. `operatorUsage` exige anfitrión y devuelve como máximo 100 trabajos recientes: número de fallos, tokens disponibles, importes reservados estimados y mediana/p95 de duración.

La duración de tarea y la espera en cola se guardan separadamente. No equivalen a latencia completa observada por un navegador ni constituyen un benchmark de OpenAI. Recoge telemetría real de staging antes de fijar un SLA.

Presupuestos de aplicación y alertas de facturación son controles distintos. Revisa lecturas de listeners y reconnects, invocaciones, cola, Storage y egress, además de tokens e imágenes. Deshabilitar IA se hace dejando reservas/límites en cero y deteniendo tareas pendientes si es necesario; nunca reutilices claves expuestas.

## Copias y restauración

1. Local: Ctrl+C permite exportar a `.emulator-data`; conserva una copia antes de resetear. `pnpm emulators` importa el export existente.
2. Real: programa backups/exports Firestore y Storage con retención elegida. Exporta ambos y conserva versiones de configuración, índices, reglas y aplicación.
3. Restaura primero en un proyecto staging. Ejecuta migraciones aditivas, prueba la membresía, versiones de ronda, trabajos y acceso privado a assets.
4. No reenvíes llamadas pagadas de reservas restauradas sin verificar el estado del proveedor.

Exportación del jugador: Ajustes → Exportar mis datos. Incluye la campaña compartida, su historial y los datos privados de ese jugador; no incluye los secretos canónicos del servidor ni deseos ajenos. Para grandes historiales deberá sustituirse la descarga cliente por exportación administrativa paginada antes de ampliar el tamaño de campaña.

## Borrado y retención

El anfitrión confirma el borrado. El comando archiva y crea `deletions/{id}` transaccionalmente. El trabajador cancela/fencea tareas, espera la expiración de leases, elimina assets y documentos anidados y limpia jobs, invitaciones, reservas y uso por lotes. El reconciliador continúa los lotes pendientes; no se afirma borrado inmediato si hay procesos en vuelo.

Los recibos de idempotencia incluyen `expiresAt` a siete días. Configura TTL de ese campo en Firestore; sin TTL, esos metadatos no desaparecen solos. La presencia propia se elimina con `onDisconnect`; Auth permanece porque una identidad puede pertenecer a otras campañas. Decide y documenta retención de Cloud Logging, backups y exportaciones del usuario antes de producción.

## Rotación y rollback

Rotar `STORY_AI_KEY` mediante Secret Manager y volver a desplegar las funciones que la vinculan. Verificar una llamada pequeña autorizada; retirar la versión anterior según el procedimiento del proveedor. No guardar la clave en logs/commits.

Para rollback, usa un artefacto y configuración previamente probados. No reviertas automáticamente datos del usuario: comprueba compatibilidad de esquema. Mantén la configuración de Firebase y los índices necesarios para ambas versiones durante una transición.

## Despliegue desde GitHub

CI no consume APIs de IA pagadas. El workflow de staging es manual y usa OIDC/WIF, sin JSON de cuenta de servicio. Configura un entorno GitHub protegido y las variables indicadas en SETUP.md. Ejecutar ese workflow sí modifica un proyecto real y requiere autorización del propietario.

## Alcance de listeners y estimación inicial de operaciones

Cada navegador escucha la biblioteca de campañas de las que es miembro, el documento de la campaña abierta, sus últimos 30 eventos y su documento privado. El diario añade hasta 5 resúmenes mientras está montado; la paginación histórica solicita 30 eventos por página. La presencia usa RTDB, no Firestore. La biblioteca permanece suscrita durante la partida: una modificación de la campaña puede generar una entrega tanto a la biblioteca como al listener del documento.

Para dos jugadores y una ronda sin cambio de escena, un cálculo preliminar por inspección del flujo es 4 modificaciones del documento principal (dos envíos, fase resolving y commit), unas 16 entregas de ese documento entre ambos listeners de ambos jugadores, más los eventos creados multiplicados por dos. La narración real y la publicación de imagen añaden modificaciones. En servidor, cada comando usa transacciones de rate limit/recibo/estado; cada trabajador añade claim, commit y finalización, y las llamadas de pago añaden reserva/liquidación. Un rango de planificación inicial es 20–50 lecturas y 15–35 escrituras de servidor por ronda sencilla, además del fan-out de clientes; no es una medición ni un límite garantizado.

Las lecturas iniciales, consultas vacías, reintentos de transacciones, reentregas, resúmenes, trabajos de imagen y reconexiones se facturan según las reglas del servicio y pueden aumentar el total. No se ha ejecutado un test de coste facturable. Antes de producción, medir una partida de 20 rondas en staging con dos cuentas, recoger métricas antes/después sin otro tráfico, separar bootstrap/reconnect y comparar rondas con/sin cambio de escena. Sustituir estos rangos por resultados observados antes de fijar expectativas de coste.
