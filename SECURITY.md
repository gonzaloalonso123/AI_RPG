# Seguridad y revisión de dependencias

## Fronteras

- Auth en todos los comandos; correo verificado y App Check en backend desplegado. El cliente de producción rechaza modo emulator. El servidor desplegado rechaza `AI_MODE=mock`.
- La callable valida membresía y rol antes de utilizar Admin SDK. Las Security Rules por sí solas no protegen escrituras Admin.
- Escrituras del navegador denegadas para estado canónico, sucesos, trabajos, presupuestos y assets. Reglas distintas para datos compartidos, privados y secretos.
- Storage permite lectura autenticada solo a miembros; no se generan download tokens públicos. RTDB solo admite presencia propia con un esquema limitado.
- Códigos aleatorios, hash en el índice de invitaciones, caducidad de 24 horas, rotación y límite de intentos fallidos incluido.
- IDs y esquemas limitados, textos acotados, modelos sin herramientas ni acceso a la base de datos, validación mecánica posterior. Texto de React escapado; no se renderiza HTML generado.
- Secret Manager `STORY_AI_KEY`; nunca `VITE_`, archivos de cuenta de servicio ni claves en Git.
- Producción debe configurar `ALLOWED_ORIGINS`, App Check, cuentas de servicio e IAM. Véase SETUP.md. No se ha validado un despliegue real.

## Auditoría de dependencias (revisión 2026-10-09)

`pnpm security` ejecuta la auditoría completa y la del paquete independiente de Functions. La última auditoría del paquete desplegable indicó **0 vulnerabilidades**. Se fijaron versiones corregidas de `@grpc/grpc-js`, `basic-ftp` y `uuid`; el lockfile de Functions incluye también el override de uuid.

La auditoría npm basada en versiones todavía anuncia dos incidencias en herramientas locales:

| Aviso | Situación | Tratamiento |
|---|---|---|
| GHSA-vfj7-8cjw-p6xm · braces | Alto; dependencia del watcher de Firebase CLI. La versión 3.0.4 anunciada por el aviso no estaba publicada en el registro consultado. | Parche `patches/braces@3.0.3.patch`: límite de profundidad antes de compilar recursivamente. pnpm conserva el checksum original y añade el hash del parche al lockfile. Una prueba adversarial verifica el rechazo y otra conserva el comportamiento de globs normales. El gate solo admite esta incidencia exacta si el parche funciona y todas las rutas son de Firebase CLI. |
| GHSA-8988-4f7v-96qf · OpenTelemetry core 1.x | Moderado; telemetría transitiva de Firebase CLI/PubSub. | No forma parte del navegador ni del paquete desplegado. Queda pendiente una actualización compatible del CLI; no se expone ese proceso a cabeceras de usuarios. Se informa explícitamente y se vuelve a revisar en cada auditoría. |

No se afirma que `pnpm audit` sin triage esté limpio. Cualquier incidencia nueva o ruta fuera de estas excepciones falla el gate. No se han desactivado TLS, firmas o comprobaciones de integridad. `pnpm check:secrets` detecta patrones frecuentes de claves en archivos versionados y nuevos; complementa una revisión humana y no garantiza descubrir cualquier secreto.

## Antes de producción

Ejecutar las pruebas de reglas y de autorización Admin. Verificar aislamiento de dos campañas en staging, revocación de acceso, tokens App Check, Cloud Tasks/IAM, límites, retención y borrado. Los controles de presupuesto de IA son reservas conservadoras de la aplicación; no son un límite universal de facturación Google Cloud.

Comunicar incidencias al responsable del repositorio evitando adjuntar claves o prompts privados. Rotar cualquier secreto expuesto antes de reutilizarlo.
