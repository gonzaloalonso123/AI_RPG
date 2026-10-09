# Story Master: instalación y puesta en marcha

## 1. Qué está construido

El repositorio contiene una aplicación React y un backend Firebase ejecutable: creación e invitación de campañas, personajes con atributos limitados, mascotas, turnos cooperativos persistentes, reglas deterministas, inventario, intercambios, comercio, diario, combate, recuperación y dos finales del misterio inicial. La interfaz y la historia tienen ajustes independientes de español/inglés.

La demo usa Auth/Firestore/Functions/Storage/Realtime Database locales, sin llamadas de IA de pago. Los adaptadores reales de IA, colas, secretos y Hosting están implementados y configurables, pero **no se ha creado ni desplegado un proyecto Firebase real**. Faltan los valores y pruebas de staging indicados abajo. [BUILD_REPORT.md](BUILD_REPORT.md) distingue capacidades comprobadas, límites de contenido y verificaciones externas.

## 2. Requisitos

| Herramienta | Versión del proyecto |
|---|---|
| Node.js | **22.23.3**, `.node-version`; runtime Functions `nodejs22` |
| pnpm | **11.19.0**, campo `packageManager` |
| Java | **21**; validado aquí con OpenJDK **21.0.12.1** |
| Firebase CLI | **15.33.0**, dependencia local: `pnpm exec firebase` |
| Firebase Web SDK | **12.19.0** |
| Firebase Admin / Functions | **14.5.0 / 7.4.0** |
| TypeScript / React / Vite | **6.0.3 / 19.3.0 / 8.3.4** |
| Playwright / Vitest | **1.64.0 / 5.0.3** |

No hace falta Docker ni GPU. Google Cloud CLI es opcional para el desarrollo local y necesario para los comandos de índices vectoriales, IAM y preflight remoto. Node 22 se eligió tras consultar la [documentación de runtimes](https://firebase.google.com/docs/functions/manage-functions) el 2026-10-08.

En esta máquina cloud:

```bash
cd /workspace/AI_RPG
bash scripts/cloud-install.sh
source /workspace/toolchains/activate.sh
```

El script instala herramientas en `/workspace`, verifica el SHA256 del archivo oficial de Node, respeta el lockfile, compila el proyecto y prepara emuladores/navegador. No contiene claves. Repetirlo no borra campañas. La activación debe hacerse en cada terminal nueva.

En tu ordenador instala las versiones indicadas, abre la raíz del repositorio y ejecuta:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm prepare:functions
pnpm exec firebase setup:emulators:firestore
pnpm exec firebase setup:emulators:database
pnpm exec firebase setup:emulators:storage
pnpm exec playwright install chromium
```

## 3. Ejecutar la demo local

Terminal 1, desde la raíz:

```bash
pnpm emulators
```

Terminal 2:

```bash
pnpm dev
```

En tu ordenador abre `http://127.0.0.1:5173`. El onboarding cloud no ofrece una vista previa navegable; sus comprobaciones se hacen con peticiones y navegadores internos. El Hosting emulator del puerto 5000 sirve el build de producción y no sustituye la demo de Vite.

Pulsa **Entrar en la demo**, crea una campaña y confirma un personaje. Para jugar con tu hermano utiliza dos perfiles de navegador o una ventana privada: cada contexto tiene una identidad distinta. Copia el código de ocho letras del anfitrión y úsalo en la segunda ventana. Cada jugador debe confirmar su personaje; después el anfitrión inicia la partida.

Todos preparan una intención o **Esperar**. Para viajar, todos eligen el mismo destino. Una ruta de investigación: plaza → taberna → plaza → posada → bosque → ruinas, investigando en tres lugares y renovando el pacto al final. También hay un desenlace de combate. El diario conserva los sucesos de la partida.

El idioma personal cambia en la cabecera/Ajustes y queda en el navegador. El anfitrión elige el idioma de la historia al crear la campaña y puede cambiarlo fuera de una ronda en curso. Los sucesos anteriores conservan su idioma original.

## 4. Emuladores, datos y migraciones

| Servicio | Puerto local |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Realtime Database | 9000 |
| Hosting | 5000 |
| Vite | 5173 |

`pnpm emulators` importa `.emulator-data` si existe y exporta al salir normalmente con Ctrl+C. Los procesos no sobreviven a una restauración del entorno: hay que arrancarlos de nuevo. Una terminación forzada puede perder cambios posteriores a la última exportación.

```bash
pnpm seed
pnpm seed --reset
```

El seed prepara una plantilla y una campaña local versionada con semilla 42, dos personajes y mascotas, usando el motor real. Puedes entrar con `alba@story-master.test` y `bruno@story-master.test`, contraseña demo pública `StoryMaster-demo42!`. Solo opera sobre emuladores; `--reset` sustituye únicamente `demo-briarhollow-v1` y rechaza trabajos activos. Ejecutarlo otra vez sin `--reset` conserva el progreso. No crea usuarios de producción ni borra otras campañas. Para reiniciar **toda** tu base local, detén emuladores y mueve `.emulator-data` a una copia de respaldo antes de volver a arrancar; no lo hagas sobre datos que quieras conservar.

Migración aditiva e idempotente de campos de esquema v1, con emuladores activos:

```bash
GCLOUD_PROJECT=demo-story-master FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm migrate
```

Para staging/producción, exporta primero con las herramientas de backup de Firestore/Storage, revisa la migración y ejecuta `GCLOUD_PROJECT=TU_PROYECTO pnpm migrate --apply` usando ADC autorizado. El migrador recorre páginas de 100 y verifica cada documento en transacción; no rebaja versiones ni borra datos. Una expansión de esquema incompatible requiere una migración nueva y una estrategia de rollback.

## 5. Preparar Firebase real

Estos pasos requieren tu cuenta y autorización de facturación. No han sido ejecutados por el agente.

1. Crea un proyecto **staging** en Firebase, activa **Blaze** y registra una app web. Usa un proyecto diferente para producción.
2. Activa Google y correo/contraseña en Authentication. Configura nombre público, correo de soporte, dominios autorizados y enlaces de verificación/restablecimiento. El backend exige correo verificado fuera del emulador.
3. Crea Firestore **Standard, Native mode**. Elige una ubicación europea compatible con tus requisitos; `europe-west1` es la región de Functions propuesta. Comprueba disponibilidad vigente antes de crear recursos cuya ubicación no puedas cambiar.
4. Crea el bucket de Storage y una instancia RTDB europea para presencia. Copia sus identificadores/URL reales; no asumas sufijos: buckets recientes pueden acabar en `.firebasestorage.app`.
5. Configura App Check web con reCAPTCHA v3; la clave pública va en el cliente. Verifica que las llamadas sin token válido se rechazan. App Check complementa Auth, no lo sustituye.
6. Activa las APIs de Functions, Run, Cloud Build, Artifact Registry, Eventarc, Firestore, Cloud Tasks, Cloud Scheduler, Secret Manager, Storage y los servicios Firebase asociados. Declara presupuestos y alertas; **las alertas no cortan el gasto**.
7. Usa identidades de servicio/ADC o Workload Identity Federation. No añadas JSON de cuenta de servicio al repositorio. Aplica los roles mínimos descritos en la documentación oficial de cada servicio.

La configuración web identifica el proyecto y puede ser pública. La clave del proveedor de IA y las credenciales privilegiadas nunca pueden estar en variables `VITE_`.

## 6. Variables y secretos

Copia `apps/web/.env.example` a `apps/web/.env.local` y rellena los valores públicos. Variables del frontend se incorporan **al compilar**; cambiarlas requiere otro build.

| Nombre | Componente | Requisito | Sensibilidad y origen |
|---|---|---|---|
| `VITE_FIREBASE_PROJECT_ID` | Web | Real | Público; ajustes del proyecto Firebase |
| `VITE_FIREBASE_API_KEY` | Web | Real | Público; configuración de la app web, no da privilegios de base de datos |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web | Real | Público; configuración Firebase |
| `VITE_FIREBASE_APP_ID` | Web | Real | Público; configuración Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Web | Real | Público; nombre exacto del bucket |
| `VITE_FIREBASE_DATABASE_URL` | Web | Real | Público; URL HTTPS exacta de RTDB |
| `VITE_FIREBASE_REGION` | Web | Opcional | `europe-west1`; debe coincidir con Functions |
| `VITE_APPCHECK_SITE_KEY` | Web | Real | Pública; registro App Check/reCAPTCHA |
| `VITE_MODE` | Web | Opcional | `live`; `emulator` solo durante desarrollo. El build de producción rechaza demo |
| `VITE_PRODUCT_NAME` | Web | Opcional | Público; predeterminado Story Master |
| `GCLOUD_PROJECT` | CLI | Despliegue/preflight/migración | ID explícito del proyecto; nunca el demo para despliegue |
| `AI_MODE` | Functions | Real | `live`; local predeterminado `mock` |
| `REGION` | Functions/CLI | Opcional | `europe-west1`, coherente con cola y frontend |
| `ALLOWED_ORIGINS` | Functions | Real | Orígenes HTTPS exactos separados por coma, incluidos staging/preview autorizados |
| `TEXT_MODEL` | Functions | Opcional | Snapshot de texto documentado en AI_EVALUATION.md |
| `IMAGE_MODEL` | Functions | Opcional | Snapshot de imagen documentado en AI_EVALUATION.md |
| `EMBEDDING_MODEL` | Functions | Opcional | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | Functions | Opcional | 1536; exige índice coincidente |
| `AI_TIMEOUT_MS` | Functions | Opcional | 45000, máximo 45000 |
| `DAILY_AI_REQUEST_LIMIT` | Functions | Opcional | 30 trabajos pagados/campaña/día |
| `DAILY_BUDGET_USD` | Functions | Real | Límite estimado diario/campaña; 0 desactiva llamadas |
| `SESSION_BUDGET_USD` | Functions | Real | Límite estimado de la vida de la campaña; 0 desactiva llamadas |
| `TEXT_RESERVATION_USD` | Functions | Real | Estimación conservadora para texto y embeddings de una tarea |
| `IMAGE_RESERVATION_USD` | Functions | Real | Estimación conservadora para una imagen o retrato |
| `STORY_AI_KEY` | Functions/Secret Manager | IA real | **Secreto**; cuenta OpenAI. Introducir por Secret Manager, nunca en chat/Git |
| `STORY_ALLOW_PAID_SMOKE` | CLI | Solo smoke real | `yes` autoriza la prueba limitada descrita abajo |

Tras `pnpm build`, copia `functions/.env.example` a `functions/lib/.env.TU_PROYECTO` y configura los parámetros del servidor. Este archivo se conserva en builds posteriores y está ignorado por Git. No añadas la clave de IA ahí. Los emuladores utilizan `mock` por defecto; no les copies accidentalmente configuración de pago.

## 7. Configurar y validar OpenAI

Activa facturación en tu cuenta OpenAI, crea una clave de proyecto y comprueba acceso a los modelos configurados. Las páginas oficiales se consultaron, pero no se ha verificado tu cuenta. Si un modelo no está disponible, elige explícitamente otro compatible con los endpoints y esquemas; no se cambia de proveedor a escondidas.

Guarda el secreto mediante un prompt seguro de terminal:

```bash
pnpm exec firebase functions:secrets:set STORY_AI_KEY --project TU_PROYECTO
```

Para desarrollo cloud también puede declararse `STORY_AI_KEY` en ajustes seguros del entorno con destino `api.openai.com`. Eso no sustituye el binding de Secret Manager del backend desplegado.

La prueba real **no se ejecuta automáticamente**:

```bash
# Con STORY_AI_KEY inyectada de forma segura y TEXT_MODEL configurado:
STORY_ALLOW_PAID_SMOKE=yes pnpm test:live
```

Hace una sola petición de texto, máximo 64 tokens de completado, timeout de 30 segundos, sin reintentos. Registra ID, modelo y uso, nunca el secreto. Una ilustración/retrato real requiere una comprobación adicional autorizada con presupuesto acotado.

## 8. Colas y tareas

`processJob` es una task queue function de segunda generación. `dispatchJob` recibe el outbox Firestore y encola fuera de la transacción. `recoverJobs` corre cada cinco minutos y revisa como máximo 40 trabajos y diez borrados por ejecución.

Límites declarados: cinco instancias por función, tres dispatches simultáneos, dos dispatches/segundo, tres intentos de transporte, espera entre 10 y 60 segundos, deadline de 120 segundos, lease de 110 segundos. Cada operación pagada tiene reserva duradera y no se repite si su resultado es incierto.

El runtime del dispatcher necesita permiso de encolar (`roles/cloudtasks.enqueuer`) y la identidad que invoca el destino debe poder invocar el servicio Cloud Run de la función (`roles/run.invoker` para gen2). Comprueba las identidades realmente desplegadas; no concedas acceso `allUsers`. Consulta [Firebase task functions](https://firebase.google.com/docs/functions/task-functions). El emulador local utiliza un dispatcher directo y no demuestra estos permisos.

Son facturables: proveedor de IA, Functions/Cloud Run, Cloud Build, Artifact Registry, Eventarc/PubSub cuando corresponda, Cloud Tasks, Cloud Scheduler, Secret Manager, Firestore y sus índices/lecturas, Storage/egress, Hosting y RTDB. Aplicar `maxInstances` no limita todos estos costes.

## 9. Build y despliegue

Revisa y autoriza el proyecto de destino antes de ejecutar comandos de despliegue. No se ha realizado un despliegue público durante esta implementación.

```bash
pnpm exec firebase use --add
# Crea alias staging/production con los IDs reales; .firebaserc solo trae demo.
export GCLOUD_PROJECT=TU_PROYECTO_STAGING
pnpm preflight --live
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm prepare:functions
pnpm security
pnpm exec firebase deploy --project "$GCLOUD_PROJECT" --only firestore:rules,firestore:indexes,storage,database
pnpm exec firebase deploy --project "$GCLOUD_PROJECT" --only functions,hosting
```

`pnpm deploy` utiliza `GCLOUD_PROJECT` explícito y ejecuta preflight/build antes de llamar al CLI. Firebase instala el paquete independiente de `functions/lib`; no depende de enlaces de pnpm presentes en tu ordenador.

Los índices compuestos ordinarios están en `firestore.indexes.json`. Para memoria vectorial:

```bash
GCLOUD_PROJECT=TU_PROYECTO_STAGING bash scripts/vector-index.sh
```

Hosting usa `apps/web/dist`, rewrite de SPA y cabeceras de seguridad/caché. Configura dominios/TLS en Firebase, orígenes callable, dominios autorizados de Auth, App Check y CORS del bucket para los orígenes exactos que sirven tu app. Las descargas privadas utilizan el SDK autenticado, sin URLs públicas persistentes.

Preview de **staging**:

```bash
pnpm exec firebase hosting:channel:deploy review --project "$GCLOUD_PROJECT"
```

Un canal Hosting no crea un backend separado: el bundle utiliza el proyecto incluido en `VITE_FIREBASE_PROJECT_ID`. Compila siempre con staging para evitar modificar producción desde una preview.

El workflow manual de despliegue usa WIF y un entorno GitHub `staging`. Antes de activarlo configura `WIF_PROVIDER`, `DEPLOY_SERVICE_ACCOUNT` y todas las variables del frontend/servidor. No hay credenciales ni IDs reales en el workflow.

## 10. Preflight y comprobaciones

```bash
pnpm preflight
pnpm typecheck
pnpm lint
pnpm test
pnpm check:secrets
pnpm security
pnpm emulators:test
```

`emulators:test` requiere emuladores parados y el paquete de Functions preparado. Si ya están activos, ejecuta:

```bash
pnpm test:rules
pnpm test:e2e
```

En el contenedor cloud, para tests Node que usan Realtime Database:

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy pnpm test:rules
```

Esto se aplica solo a conexiones locales de pruebas. Los instaladores conservan el proxy y verifican TLS. `scripts/emulators.mjs` aplica el mismo ajuste porque esta versión de Firebase CLI no respeta `NO_PROXY` en todas las llamadas loopback.

Con proyecto staging y ADC/Google Cloud CLI autorizados: `pnpm preflight:remote`. Comprueba APIs, ubicación, runtime, índices, cola, binding de secreto y presencia de releases de reglas. No imprime tokens. No se ha ejecutado aquí contra un proyecto real. Verifica también que el contenido de reglas desplegado coincide con este checkout.

Prueba manual staging: dos cuentas verificadas, creación/unión por código, un único commit compartido, listeners iguales, desconexión/reconexión, reinicio de worker, imagen privada, diario compartido y denegación a un tercer usuario. Comprueba rechazo de App Check, IAM de cola, CORS y recuperación de tareas sin clientes conectados.

## 11. Invitar, pausar y continuar

El anfitrión comparte el código desde el lobby. El código da membresía una vez, no sustituye la identidad Auth. Se puede renovar y caduca a las 24 horas. Una campaña iniciada no acepta nuevos participantes en esta versión.

Cada jugador crea su personaje y mascota; el anfitrión inicia. Ajustes permite pausar cuando se están recogiendo intenciones y reanudar después. Cerrar una ventana no elimina la campaña. Regresa con la misma cuenta y pulsa Continuar. Para protegerte de borradores perdidos, estos se conservan por campaña/usuario en el navegador, incluidas referencias seleccionadas.

## 12. Profundidad y audio opcionales

La versión actual ofrece imagen estática de respaldo y movimiento cinematográfico PixiJS, con reducción de movimiento y suspensión cuando la pestaña está oculta. **No hay un proveedor de mapas de profundidad conectado ni se afirma parallax real.** La integración de profundidad y el audio ambiental son opcionales pendientes; no hacen falta para jugar. Ajustes indica que el sonido no está disponible, en lugar de mostrar un control de audio ficticio.

## 13. Operaciones y datos

Consulta [OPERATIONS.md](OPERATIONS.md). Exporta una campaña desde Ajustes; el archivo contiene su proyección, sucesos y tus datos privados. Los backups administrativos de una base completa deben realizarse con las herramientas de Firestore y Storage de tu proyecto y restaurarse primero en staging.

La eliminación es solicitada por el anfitrión con confirmación. Archiva primero la campaña y crea un trabajo duradero. Cancela tareas, espera leases activos y elimina documentos anidados y assets; el reconciliador completa lotes pendientes. Los recibos idempotentes tienen un campo de expiración de siete días: configura TTL para `receipts.expiresAt` en Firestore. No se borra una cuenta Auth al eliminar una campaña porque puede pertenecer a otras.

## 14. Resolución de problemas

| Síntoma | Comprobación |
|---|---|
| Pantalla vacía tras actualizar dependencias | Reinicia Vite; comprueba consola y Node 22. La caché optimizada anterior no debe usarse con otro lockfile |
| Demo no conecta | Arranca todos los emuladores, revisa puertos y usa Vite 5173; no copies variables live al modo local |
| CLI cancela peticiones a localhost | Usa `pnpm emulators`; comprueba que los binarios se descargaron antes con el proxy normal |
| Login Google/callback | Revisa authDomain, dominio autorizado y configuración del proveedor |
| Correo no llega / enlace caducado | Reenvía verificación o restablecimiento; revisa plantillas, dominio y spam; vuelve a iniciar sesión |
| Callable rechazada | Correo verificado, token Auth, App Check, `ALLOWED_ORIGINS`, región y membresía |
| Listener denegado | Usuario correcto, membresía en proyección y reglas desplegadas; reglas no filtran consultas no autorizadas |
| Modelo no disponible | Confirma ID y acceso/facturación de la cuenta; configura explícitamente una alternativa compatible |
| IA desactivada | `AI_MODE`, secreto y cuatro importes/límites; cero significa desactivado |
| Ilustración pendiente o fallida | Inspecciona job/reserva; no repitas una llamada incierta sin revisar su estado. Reintentar imagen no vuelve a tirar dados |
| Índice vectorial ausente | Crea el índice; mientras tanto funciona el fallback por visibilidad/fecha |
| Imagen privada falla | Membresía, reglas Storage, CORS y bucket; no la arregles publicando el objeto |
| Turno no avanza | Todos deben preparar intención; para viajar, el mismo destino. Un desconectado no juega automáticamente |
| CI no encuentra Functions SDK | Ejecuta build y `pnpm prepare:functions` antes de arrancar emuladores |
| Borrado pendiente | Espera a que caduquen leases y al siguiente reconciliador; en local Cloud Scheduler no se reproduce automáticamente |

## 15. Checklist de lanzamiento

[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) contiene los criterios. No publiques como producción hasta comprobar identidad, aislamiento, colas, índices, proveedores reales, costes, backups y eliminación. Los tests de emuladores son evidencia local, no certificación de un servicio desplegado.

## 16. Costes

No se prometen precios ni latencias. Consulta [OpenAI](https://openai.com/api/pricing/), [Firebase](https://firebase.google.com/pricing) y [Google Cloud Tasks](https://cloud.google.com/tasks/pricing), y actualiza reservas según modelos/región y uso reales.

Una estimación útil:

`sesiones × turnos × (tokens_entrada × precio_entrada + tokens_salida × precio_salida + fracción_de_turnos_con_imagen × precio_imagen) + retratos + embeddings + lecturas/escrituras/listeners de Firestore + Functions/colas/schedules + almacenamiento/egress + presencia + hosting/builds/logs/secretos`.

Los listeners se limitan al estado actual, datos privados propios, campañas del usuario, 30 sucesos recientes y hasta cinco resúmenes. Un turno de dos jugadores requiere aproximadamente dos comandos transaccionales, una reclamación de trabajo y un commit; contando rate limits, recibos, outbox y estados de trabajo, espera del orden de decenas de lecturas/escrituras, no una sola escritura. Los reintentos transaccionales, trabajos de presentación y fan-out multiplican ese coste. Esta es una estimación de arquitectura, no una medición de facturación. Ajustes muestra muestras reales de duración de tareas, tokens registrados y reservas estimadas; compara con los informes de los proveedores.
