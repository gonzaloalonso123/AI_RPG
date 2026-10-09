# Arquitectura

## Flujo de una intención

1. React guarda el borrador localmente por usuario/campaña. Una mención conserva un ID, además de su nombre visible.
2. La callable `command` valida Auth, App Check en producción, membresía, versión, límites y esquema Zod. Cada petición lleva un ID persistido hasta recibir respuesta definitiva.
3. Firestore guarda la intención. Al estar todos preparados, la misma transacción bloquea la ronda y crea un documento `jobs` con semilla de dados.
4. El dispatcher envía el ID a Cloud Tasks. En emuladores llama al mismo trabajador directamente. Un reconciliador programado reenvía como máximo 40 trabajos pendientes o con lease caducado por ejecución.
5. El trabajador reclama la tarea con lease de 110 segundos y fencing token creciente. La fase pasa de `locked` a `resolving`.
6. Las acciones simples usan interpretación determinista. Las ambiguas pueden usar una llamada agrupada al proveedor, fuera de cualquier transacción. La salida nunca escribe datos directamente.
7. El dominio calcula el resultado desde la semilla persistida. Una transacción vuelve a comprobar versión, fase y fencing token, y escribe estado, sucesos y siguientes tareas a la vez.
8. Narración, ilustración, retratos y resúmenes se ejecutan por separado. El fracaso de presentación no revierte mecánicas. Una ilustración solo se publica si su versión de escena sigue vigente.

`collecting → locked → resolving → collecting/ended`. Una intención inválida vuelve a `collecting` con un mensaje y sin modificar recursos. Pausa y archivo son persistentes. No hay autopiloto para participantes ausentes: sin sus intenciones la ronda no se bloquea. Una ronda ya bloqueada puede completarse aunque se cierren todos los navegadores.

## Datos y límites

| Ruta | Lectores del cliente | Escritura | Contenido |
|---|---|---|---|
| `campaigns/{id}` | Miembros | Servidor | Proyección actual acotada, hasta 4 personajes, intenciones y conocimientos descubiertos |
| `campaigns/{id}/events/{id}` | Miembros | Servidor | Registro de hechos, descubrimientos y resultados; páginas de 30 |
| `campaigns/{id}/summaries/{version}` | Miembros | Servidor | Resúmenes con IDs de sucesos originales |
| `campaigns/{id}/private/{uid}` | Solo el propietario miembro | Servidor | Invitación del anfitrión y hasta 20 deseos personales |
| `campaigns/{id}/hidden/world` | Nadie | Servidor | Causa canónica del misterio |
| `campaigns/{id}/memories/{version}` | Nadie | Servidor | Resúmenes y vectores; visibilidad compartida filtrada antes de consultar |
| `campaigns/{id}/assets/{hash}` | Nadie | Servidor | Caché de ilustraciones por descriptor/modelo/estilo |
| `invitations/{hash}` | Nadie | Servidor | Código criptográfico de ocho caracteres, expiración de 24 horas |
| `jobs/{id}` | Nadie | Servidor | Outbox y tarea duradera, estado, lease, fencing token, métricas |
| `receipts/{uid_requestId}` | Nadie | Servidor | Resultado idempotente de un comando |
| `rates`, `usage`, `reservations` | Nadie | Servidor | Límites, presupuestos estimados y llamadas inciertas |
| `deletions/{id}` | Nadie | Servidor | Solicitud persistente de borrado |
| RTDB `presence/{uid}/{connection}` | Solo ese usuario | Ese usuario | Conexión efímera, nunca autoridad de juego |
| Storage `campaigns/{id}/{asset}` | Miembros comprobados con Firestore | Servidor | Bytes privados; el cliente usa lecturas autenticadas, no tokens públicos |

La proyección actual es deliberadamente compacta; no incluye el historial entero ni secretos mezclados con campos públicos. La campaña pequeña limita la cantidad de objetos y lugares. Un futuro mundo más extenso requerirá mover inventarios y entidades a subcolecciones antes de acercarse al límite de documento de Firestore.

Los sucesos son inmutables durante el juego; una eliminación solicitada por el anfitrión elimina también su historial. La interfaz trata texto generado como texto, no como HTML.

## Empaquetado

`pnpm build` produce `apps/web/dist` y un único `functions/lib/index.cjs`. Esbuild integra los paquetes de workspace y el SDK de IA. Firebase Admin y Functions son dependencias externas normales de un `package.json` independiente, con su propio lockfile. `pnpm prepare:functions` prueba la instalación con `npm ci`; el despliegue no depende de enlaces `workspace:*`.

## Idiomas

`apps/web/src/i18n.ts` contiene textos de interfaz. La preferencia personal se conserva en localStorage. `Campaign.locale` se guarda en el servidor y controla narración/reglas textuales; solamente el anfitrión la cambia fuera de una ronda en curso. Los sucesos históricos mantienen el idioma con el que fueron escritos. El contenido nuevo usa el idioma actualizado. Los conocimientos descubiertos incluyen versiones ES/EN, sin enviar pistas aún ocultas al navegador.

## Memoria y presupuesto

El contexto usa sucesos recientes exactos y un conjunto acotado de recuerdos. Una consulta vectorial busca exclusivamente dentro de la subcolección de esa campaña y con `visibility=shared`. Si falla el embedding o el índice, se usa el índice de visibilidad/fecha. Los deseos privados no se envían a la narración compartida.

Cada trabajo pagado reserva un importe configurado, número de peticiones y un hueco de concurrencia mediante transacción. No se devuelve dinero estimado basándose en precios inventados: las reservas son conservadoras; los tokens disponibles se registran separadamente. Hay un límite diario y otro para la vida de la campaña, dos tareas de proveedor simultáneas por campaña y circuit breaker tras tres fallos. Una llamada cuyo resultado/cobro es incierto no se repite automáticamente. Los costes reales se concilian operativamente con el proveedor.

## Límites del emulador

El dispatcher local prueba los mismos contratos, transacciones y trabajadores. No demuestra IAM de Cloud Tasks, entrega autenticada real, Cloud Scheduler, App Check remoto ni facturación. La búsqueda vectorial real y todos los proveedores necesitan staging. No se ha desplegado ningún recurso real.
