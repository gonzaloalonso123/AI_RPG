# Evaluación de IA

## Adaptadores implementados

Interpretación individual y por grupo, narración de resultados, resúmenes con citas, embeddings, ilustración y retrato mediante el SDK oficial de OpenAI. Los modelos son configuración del servidor. La demo utiliza interpretación y narración deterministas; no falsifica llamadas a proveedores.

Modelos predeterminados, con documentación oficial consultada el 2026-10-08:

- Texto: `gpt-5.4-mini-2026-03-17`.
- Imagen: `gpt-image-2.5-flare-2026-09-08`, paisaje 1536×1024, calidad media.
- Retrato: mismo modelo, 1024×1536, calidad media.
- Embeddings: `text-embedding-3-small`, dimensión 1536.

Referencias: [modelos de texto](https://platform.openai.com/docs/models/gpt-5.4-mini), [modelo de imagen](https://platform.openai.com/docs/models/gpt-image-2.5-flare), [generación de imágenes](https://platform.openai.com/docs/guides/image-generation), [SDK](https://github.com/openai/openai-node).

La documentación confirma APIs y parámetros; **no demuestra acceso de la cuenta del usuario**. No se han realizado llamadas pagadas ni medido latencia real de esos modelos. No se han configurado proveedores alternativos silenciosos.

## Límites y fallos

Salida de texto limitada a 900 tokens de completado y validada con Zod. Una interpretación debe pertenecer al vocabulario del dominio, usar objetos/skills conocidos y satisfacer objetivos, costes y estado actual. El prompt nunca puede conferir poderes.

Timeout configurable entre 1 y 45 segundos por llamada; el SDK no reintenta automáticamente. La tarea dispone de 120 segundos. Dos tareas de proveedor como máximo por campaña y tres dispatches simultáneos de la cola. Los trabajos almacenan leases, fencing tokens y reservas antes de llamar al proveedor. Los timeouts ambiguos conservan la reserva y requieren una acción explícita; no se repiten cargos a ciegas.

El estilo artístico `story-master-v1` es centralizado. Las imágenes dependen de hechos visibles confirmados y su hash incluye descriptor, modelo, calidad y estilo. Los elementos incidentales de una imagen no son botín ni entidades canónicas. Los retratos se aplican solo a la revisión de personaje correspondiente.

## Pruebas locales

- Distribución de atributos y prompts de poder ilimitado.
- IDs/efectos desconocidos, propuestas malformadas y recursos insuficientes.
- Mismo seed, mismas tiradas al reintentar.
- Recuerdos filtrados por campaña y deseos privados excluidos del contexto compartido.
- Reservas simultáneas y límites de concurrencia.
- Fallo de imagen sin repetir un turno ni botín; imagen antigua conservada en caché sin reemplazar escena actual.
- Recuperación de un lease caducado y entregas duplicadas.

Las pruebas de trabajadores inyectan un proveedor controlado; no demuestran calidad semántica de un modelo real. La narración permanece presentación, sin autoridad mecánica. Validar en staging que el estilo respeta hechos, no añade premios, no revela secretos y mantiene el idioma solicitado.

## Evaluación externa pendiente

1. Configurar proyecto/clave y presupuestos pequeños basados en precios actuales.
2. Ejecutar `pnpm test:live` con el opt-in explícito descrito en SETUP.md: una única petición de texto, 64 tokens máximos.
3. Revisar un turno en español y otro en inglés, una ilustración y un retrato; confirmar permisos de Storage.
4. Medir mediana/p95 con varias sesiones autorizadas. Objetivos de diseño: interfaz responde inmediatamente; confirmación local independiente de IA; no se promete un tiempo de proveedor sin medirlo.
5. Probar negativa de contenido, 429, timeout, límite de presupuesto y cambio de escena con una imagen pendiente.

Los importes configurados son estimaciones conservadoras; no se incluyen precios inventados. Ajustar tras consultar las páginas oficiales de precios.
