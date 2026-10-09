# Story Master

Un RPG cooperativo de fantasía para 1–4 jugadores. Escribe lo que quieres intentar; las reglas del servidor resuelven el turno y el mundo conserva los resultados. Interfaz e historia configurables en **español e inglés**, de forma independiente.

La campaña inicial, **La campana bajo el pozo**, transcurre en Zarzavilla/Briarhollow. Incluye seis lugares, investigación, conversaciones, mascotas, inventario, comercio, combate y dos finales. La demo utiliza Firebase local y las mismas reglas que el modo con IA; no realiza llamadas de pago.

## Empezar

Requisitos: Node **22.23.3**, pnpm **11.19.0**, Java **21**. Versiones y configuración completa en [SETUP.md](SETUP.md).

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm prepare:functions
pnpm emulators
```

En otra terminal:

```bash
pnpm dev
```

En este entorno cloud, ejecuta antes `source /workspace/toolchains/activate.sh` en cada terminal. Para reconstruir las herramientas y dependencias: `bash scripts/cloud-install.sh`.

No hay un despliegue público. El modo con proveedores reales necesita un proyecto Firebase, facturación, secretos, configuración del cliente y comprobaciones en staging. El estado y los límites están en [BUILD_REPORT.md](BUILD_REPORT.md) y [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Comprobaciones

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:secrets
pnpm security
pnpm emulators:test
```

`emulators:test` inicia sus propios emuladores: detén antes los de desarrollo. Si ya están activos, ejecuta `pnpm test:rules` y `pnpm test:e2e`. En este contenedor, los tests Node de Realtime Database necesitan excluir el proxy para loopback; [SETUP.md](SETUP.md) contiene el comando exacto.

## Estructura

- `apps/web`: React, Vite, interfaz accesible, traducciones y escenas PixiJS con imagen de respaldo.
- `functions`: comandos autenticados, coordinador transaccional, outbox, trabajadores e integración Firebase.
- `packages/domain`: reglas puras y contenido de la campaña; los secretos narrativos permanecen fuera de la entrada del navegador.
- `packages/contracts`, `packages/ai`, `packages/config`: esquemas, proveedores y límites compartidos.
- `tests`: reglas de juego, permisos, recuperación, presupuesto y dos navegadores independientes.
- `scripts`: instalación, emuladores, migraciones, auditoría y comprobaciones operativas.

La especificación original se conserva en `docs/PRODUCT_SPEC.md`; el nombre y los idiomas solicitados posteriormente tienen prioridad. Consulta [GAME_RULES.md](GAME_RULES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) y [OPERATIONS.md](OPERATIONS.md).
