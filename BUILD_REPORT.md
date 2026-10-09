# Story Master — informe de construcción

Estado: versión 0.1.0 jugable de desarrollo, verificada en este entorno el 9 de octubre de 2026. No hay despliegue público ni llamadas a proveedores de pago. El nombre solicitado es **Story Master**. El idioma de la interfaz y el de la campaña se configuran por separado, inicialmente español e inglés.

## Implementado

- Monorepo TypeScript con React/Vite, Firebase y paquetes compartidos de contratos, reglas, configuración y proveedores.
- Autenticación, biblioteca de campañas, invitaciones caducables, personajes, mascotas y cooperación de 1–4 participantes. Validación de dos jugadores en navegadores independientes.
- La campana bajo el pozo: seis localizaciones, investigación con pistas persistentes y citas, inventario/equipo, comercio consensuado, habilidades, relaciones, progresión compartida, encuentros opcionales y resolución mediante investigación/negociación o combate.
- Intenciones simultáneas, validación del servidor, semilla estable, un commit transaccional por ronda, recibos idempotentes, control de versiones y recuperación de trabajadores con leases/fencing.
- Narración e imágenes en trabajos separados, retratos, caché visual versionada, resúmenes y memoria compartida con búsqueda vectorial y alternativa sin vectores. Adaptadores OpenAI reales implementados; verificación local mediante proveedores deterministas/inyección de fallos.
- Presupuestos estimados reservados transaccionalmente, concurrencia limitada, circuit breaker, ausencia de reintento automático de cobros inciertos y panel del anfitrión con métricas observadas.
- Reglas Firestore/Storage/Realtime Database, autorización adicional Admin SDK, App Check fuera de emuladores, borrado diferido, migración aditiva y datos privados separados.
- Interfaz adaptable, teclado, diálogos, reducción de movimiento, borradores persistentes, reconexión y escenas SVG originales con movimiento cinematográfico. Lectura autenticada de assets privados.
- Demo reproducible con plantilla, campaña y cuentas locales; scripts de instalación, CI, despliegue manual con identidad federada, preflight y documentación operativa.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Instalación completa `bash scripts/cloud-install.sh` con lockfile congelado | Correcta; Node 22.23.3, pnpm 11.19.0, build, paquete Functions, Chromium y checksums de emuladores |
| `pnpm typecheck`, `pnpm lint` | Correctos |
| `pnpm test` | 25 tests, 2 archivos, todos pasan |
| `pnpm test:rules` con emuladores activos | 19 tests, 3 archivos, todos pasan |
| `pnpm test:e2e` | 2 tests, todos pasan: aventura de dos jugadores y móvil/teclado/reducción de movimiento |
| `pnpm build` y `pnpm prepare:functions` | Web y Functions independientes construidos e instalados |
| Exportar, detener, reiniciar e importar emuladores | Datos recuperados; migrador aditivo ejecutado sobre campañas existentes |
| `pnpm seed`, `--reset`, repetición y login de ambas cuentas | Campaña demo creada/restablecida; repetición conserva datos; lectura autorizada correcta |
| `pnpm check:secrets` | Sin coincidencias de patrones de credenciales |
| `pnpm security` | Gate correcto con excepciones de herramientas explícitas; auditoría del paquete Functions: 0 vulnerabilidades conocidas |
| Capturas escritorio/móvil | Revisadas; prueba sin desbordamiento horizontal |

Los tests de recuperación cubren lease caducado, entrega duplicada, reservas concurrentes, fallo de imagen sin repetir mecánicas y resultado visual tardío sin sustituir una escena más reciente. Las pruebas de reglas y las de comandos/Admin son independientes. El recorrido completo de navegador valida la ruta pacífica; el combate se verifica en el dominio, no mediante una segunda aventura E2E completa.

La auditoría general de pnpm conserva dos avisos de herramientas de desarrollo: braces mitigado mediante un parche versionado y verificado; OpenTelemetry de Firebase CLI pendiente de actualización upstream. Consulta SECURITY.md. No se afirma que la auditoría general esté vacía.

## Infraestructura pendiente de configurar y verificar

Hace falta seleccionar un proyecto Firebase real y configurar facturación, cliente web, orígenes, autenticación, App Check, IAM, colas, índices y Secret Manager. Los límites monetarios por defecto son cero. No se han comprobado en infraestructura real el proveedor de texto/imágenes, embeddings, correo/Google, tareas programadas, CORS, facturación, retención ni recuperación en Cloud Tasks. Los detalles y los pasos previos están en SETUP.md y RELEASE_CHECKLIST.md.

El workflow manual de staging está preparado; no se ha ejecutado. El preflight remoto consulta recursos sin crearlos, y la existencia de una release de reglas no demuestra que su contenido coincida con este checkout. Las pruebas locales no certifican preparación para producción.

## Límites de producto y rendimiento

- La aventura inicial y sus seis lugares están escritos y acotados. La expansión procedural ilimitada de mundo/contenido no está implementada.
- El sistema de combate, relaciones, habilidades y economía es compacto; no constituye aún todo el contenido ni la profundidad de sistemas de la especificación extensa. Los enemigos contraatacan al atacar; no existe una simulación autónoma general de todos los NPC.
- El intérprete demo reconoce acciones ES/EN y solicita aclaración para otras frases; la interpretación libre requiere configurar el proveedor real.
- Las imágenes de demo son ilustraciones SVG locales. No se ha generado una imagen nueva con un proveedor real en esta sesión. No hay profundidad estimada real ni audio; el efecto actual es movimiento cinematográfico con alternativa estática.
- El bundle principal web genera una advertencia de tamaño (aproximadamente 1,22 MB minificado / 364 kB gzip). Conviene dividir la carga de gráficos y medir en dispositivos reales antes de producción.
- No hay medición de latencias ni coste Firestore bajo carga real. OPERATIONS.md describe el alcance de listeners y la estimación de operaciones, que debe contrastarse en staging. Exportar historiales muy grandes requiere paginación adicional.
- La interfaz admite dos idiomas; añadir otro requiere traducciones y ampliar el contrato. Cambiar el idioma de campaña no reescribe eventos históricos.

No quedan fallos sin explicar en las comprobaciones locales ejecutadas. Estas limitaciones no se ocultan con botones ni estadísticas inventadas.

## Entrega y próximos pasos

Repositorio de entrega: https://github.com/gonzaloalonso123/AI_RPG. Esta versión inicial reúne el código, las pruebas y la documentación; excluye secretos, dependencias instaladas y datos de emuladores. El remoto inicial estaba vacío. La restauración desde una tarea nueva no se ha probado: revisar/publicar la configuración del entorno es un paso distinto de versionar el código o desplegar la aplicación.

1. Usar la demo y revisar la experiencia de Story Master con dos cuentas.
2. Revisar la entrega en GitHub y revisar/publicar el entorno configurado.
3. Configurar staging siguiendo SETUP.md, fijar presupuestos y ejecutar las comprobaciones externas del checklist.
4. Medir experiencia/costes reales antes de decidir la expansión de contenido y el lanzamiento público.
