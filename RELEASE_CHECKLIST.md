# Checklist de lanzamiento

## Evidencia local

- [x] Monorepo instalado con lockfile y Node 22.
- [x] Build web y paquete independiente de Functions.
- [x] Reglas deterministas y reintentos con semilla estable.
- [x] Reglas Firestore/Storage/RTDB y autorización Admin SDK probadas por separado.
- [x] Dos contextos de navegador completan una ruta de investigación; revisión final registrada en BUILD_REPORT.md.
- [x] Reconexión, borrador local y cambio de idioma.
- [x] Recuperación de lease, entrega duplicada y presupuestos concurrentes.
- [x] Fallo de imagen y resultado obsoleto sin repetir mecánicas.
- [x] Capturas escritorio/móvil y reducción de movimiento revisadas.
- [x] Auditoría del paquete desplegable sin vulnerabilidades conocidas; triage local específico en SECURITY.md.

## Antes de staging real

- [ ] Crear/seleccionar un proyecto Firebase separado y autorizar Blaze.
- [ ] Confirmar ubicaciones europeas, APIs, nombres reales de bucket/RTDB y dominios.
- [ ] Configurar Google + correo verificado/reset y comprobar errores/enlaces caducados.
- [ ] Configurar App Check; demostrar rechazo de tokens ausentes/no válidos fuera del emulador.
- [ ] Vincular STORY_AI_KEY en Secret Manager e introducir variables públicas/servidor.
- [ ] Configurar importes conservadores, límites de instancia, presupuestos y alertas reales.
- [ ] Desplegar y verificar contenido de reglas e índices, incluido vector.
- [ ] Verificar IAM de dispatcher, Cloud Tasks, Cloud Run y Cloud Scheduler.
- [ ] Ejecutar preflight remoto y registrar qué comprobaciones manuales faltan.

## Antes de producción

- [ ] Ejecutar el smoke de texto con presupuesto autorizado.
- [ ] Generar una escena y un retrato reales; comprobar privacidad/CORS y calidad en ES/EN.
- [ ] Completar dos cuentas reales: unión, intención simultánea, un solo commit, diario idéntico y reconnect.
- [ ] Intentar leer datos/assets de otra campaña y comprobar denegación.
- [ ] Reiniciar worker con tarea en vuelo; demostrar recuperación sin duplicar cobros/recompensas.
- [ ] Probar fallo de proveedor, límite de presupuesto y cola sin ningún navegador conectado.
- [ ] Medir latencia real, fan-out y lecturas/escrituras por turno.
- [ ] Configurar TTL/retención, probar backup/restore y borrado completo de una campaña.
- [ ] Revisar contenido del producto, privacidad/términos y límites de esta versión.
- [ ] Obtener autorización explícita para despliegue público.

Profundidad real, audio y expansión adicional de contenido son opcionales y no se presentan como disponibles. El estado actual es una versión jugable de desarrollo, no una certificación de preparación para producción.
