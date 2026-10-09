# Reglas de Story Master · v1

El estado confirmado por el servidor tiene autoridad. El texto del jugador o de la IA no puede añadir dinero, objetos, acciones o éxitos.

## Personajes

Los diez atributos son Strength, Agility, Endurance, Intelligence, Perception, Willpower, Charisma, Empathy, Arcana y Luck. Cada personaje empieza con **90 puntos**, entre **3 y 16** por atributo. La descripción orienta preferencias temáticas (explorador, mago, guerrero), pero nunca cambia el presupuesto. La distribución usa aleatoriedad inyectable; el servidor elige la semilla.

| Recurso | Fórmula |
|---|---|
| Salud | `20 + 2 × Endurance` |
| Vigor | `10 + Agility` |
| Maná | `6 + Arcana` |
| Defensa | `floor(Endurance / 4)` |
| Iniciativa | `Agility + floor(Perception / 3)` |
| Capacidad | `15 + 2 × Strength` kg |

La iniciativa ordena acciones; Luck solo desempata, seguido del UID estable. No aumenta todas las tiradas. Cada 25 XP se obtiene un nivel, hasta 10; el atributo más alto que todavía esté por debajo de 20 mejora un punto.

## Turnos y exploración

Una acción consecuente por personaje/ronda. Todos preparan una intención o Esperar. Las intenciones se pueden editar o retirar antes del bloqueo. El servidor valida todos los recursos y objetivos y no cobra nada si la propuesta no es válida.

Viajar requiere que todos elijan el mismo destino conectado. Inspeccionar, conversar sobre el misterio y usar la capacidad de la mascota descubren pistas accesibles sin una tirada artificial. Una pista nueva concede 5 XP y una práctica a cada miembro; repetirla solo recuerda el hecho y cita su suceso original. Repetir información trivial no concede nuevas habilidades.

Descansar avanza 60 minutos, repone salud/vigor/maná, elimina condiciones y recupera la mascota. No se permite descansar ante el guardián activo. Las demás rondas avanzan cinco minutos. Los jugadores permanecen juntos; no hay PvP ni robo entre miembros.

## Combate y consecuencias

Atacar al guardián cuesta dos puntos de vigor. `d20 + floor((Strength−10)/2) + asistencia` produce daño:

- 15 o más: `8 + floor(Strength/3)`.
- 10–14: 5.
- 7–9: 3.
- Menos de 7: 0.

La ayuda de uno o más compañeros suma como máximo +2. La tirada registrada proviene de la semilla de la ronda y no cambia por un reintento. El guardián contraataca los ataques que no lo derrotan: 3 de daño base en dificultad tranquila, 5 en las demás, menos defensa y protección. El daño nunca es negativo. Sus puntos iniciales son 24/32/42 según dificultad.

Si un miembro queda incapacitado, Ada recupera al grupo en la taberna: al menos la mitad de la salud máxima, coste de dos monedas por personaje (sin saldo negativo). Se puede descansar y regresar; la partida nunca se borra por derrota. La huida exige consentimiento del grupo. Las mascotas no mueren.

Investigar tres pistas permite renovar el pacto en las ruinas. También puede derrotarse al guardián. Cada final concede una única recompensa de 25 XP y 10 monedas por miembro; la campaña entra en estado `ended` y no acepta más rondas. La posada sigue teniendo propietaria: desear restaurarla no la entrega al jugador.

## Habilidades y mascotas

Golpe firme y Ojo atento están disponibles al inicio. Los umbrales de práctica 3, 5, 7, 9, 11 y 13 desbloquean Alivio, Amparo, Paso de sombra, Voz serena, Chispa y Vínculo. Los efectos están definidos en el dominio, no son código producido por IA.

Alivio recupera hasta ocho puntos de salud; Amparo reduce daño durante dos rondas; Paso de sombra permite una retirada consentida; Voz serena mantiene las condiciones de conocimiento para negociar; Chispa utiliza el ataque limitado; Vínculo utiliza la capacidad de la mascota. Las habilidades mágicas cuestan tres puntos de maná; los ataques conservan su coste de vigor. No se aceptan IDs de habilidades no aprendidas.

Zorro de musgo, búho de ceniza y nutria de río tienen una capacidad de descubrimiento. La mascota se agota tras usarla, recupera su capacidad descansando y gana vínculo solo ante un descubrimiento nuevo, con máximo diez.

## Objetos y economía

Todos los objetos tienen ID estable, plantilla, propietario dentro de la proyección, cantidad, peso, precio y etiquetas. Botín único: una sola transferencia aunque dos jugadores lo soliciten a la vez. El orden de iniciativa y sus desempates decide; el resultado informa al otro participante.

La tienda vende tónicos por cinco monedas y conserva su stock. La venta concede `floor(value/2)`. Los intercambios requieren una oferta vigente y aceptación del destinatario, propiedad actual y capacidad suficiente. No se transfiere equipo puesto. Usar un tónico/hierba consume el objeto y recupera hasta 15 de salud. Equipar, usar, vender, comprar y soltar pasan por un turno; el cliente no escribe recursos directamente.

## Alcance de contenido

La campaña inicial es una aventura breve completa, no un generador infinito. Sus reglas y plantillas son extensibles. Las interacciones creativas que no encajen en el vocabulario validado se aclaran sin cobrar recursos. El vocabulario no pretende simular cualquier ley física. El bosque y la posada permiten encuentros opcionales con un retoño de raíces (12 HP base) y un eco (18 HP base). La dificultad ajusta sus puntos; resolverlos concede una sola recompensa de 10 XP y 3 monedas por miembro. Sus derrotas persisten y no entregan premios al repetir acciones.
