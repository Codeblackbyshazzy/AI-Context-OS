# Revisión Técnica y Plan de Ejecución (AI Context OS)

Fecha: 2026-03-29
Propósito: Documento guía para la IA (Bycoding) sobre el estado arquitectónico y el roadmap técnico inmediato.

## 1. Visión Core y Principios de Ingeniería

AI Context OS es la **capa de memoria (Brain Layer) y contexto universal** para agentes de IA.
No es un chat. No depende de una herramienta exclusiva. 

**Principios técnicos intocables:**
1.  **Determinista y Transparente:** El contexto se maneja en el workspace local (`01-context`, etc.) mediante resolución en capas (L0/L1/L2).
2.  **Motor Híbrido, no puro Vectorial:** Evitamos bases de datos vectoriales opacas. Se mantiene el algoritmo híbrido actual (`scoring.rs`) basado en BM25, Proximidad de Grafo, Recencia y Metadatos, ya que no pierde relaciones estructurales ni palabras clave exactas.
3.  **Adapter-First:** El núcleo gestiona contexto; la salida se adapta al cliente (Claude, Cursor, etc.).

---

## 2. Diagnóstico Arquitectónico y Deuda Técnica Actual

**Fortalezas a mantener:**
- Presupuesto estricto de tokens con resolución por capas escalonada (`engine.rs`).
- Puntuación híbrida multidimensional.
- Integración real vía servidor MCP local (stdio y HTTP).

**Deuda técnica a priorizar (Cuellos de botella):**
- **Acoplamiento Fuerte:** El código Rust (ej. `commands/router.rs`) usa `claude.md` como *Source of Truth*. Las `.cursorrules` se derivan de ahí textualmente. Esto limita y confunde la propuesta de valor universal.
- **Falsa Promesa (UI/UX):** El onboarding permite elegir herramientas (GPT, Gemini) que no poseen una integración o *adapter* real habilitado, provocando un *Value Promise Gap*.
- **Falta de Abstracción de Conectores:** No existe un registro interno predecible sobre qué capacidades tiene cada herramienta (Local Native vs Bridge).

---

## 3. Hoja de Ruta de Ejecución (Action Plan)

### Fase 1: Desacoplar el Núcleo (Adapter Pattern)
Objetivo: Eliminar el hardcoding hacia clientes específicos en la lógica core.
1.  **Fuente Neutral:** Crear un router maestro abstracto (ej. `_brain-router.json` o mantenerlo puramente en el estado de Rust).
2.  **Artefactos Derivados:** Modificar los comandos de generación para que `claude.md`, `.cursorrules` y `.windsurfrules` sean **salidas (outputs)** del adaptador, no la fuente primaria.

### Fase 2: Refactor UI de Conectores
Objetivo: Sinceridad en el Onboarding y claridad de conexión.
1.  Eliminar la selección de herramientas engañosa del `OnboardingWizard`.
2.  Tipificar los modelos de conexión internamente:
    *   **Local Native:** Claude Desktop, Cursor, Windsurf (Soportan MCP y local fs directo).
    *   **Bridge/Handoff:** ChatGPT Web (Sólo portapapeles o exportaciones).
3.  Mover la configuración a una nueva vista dedicada ("Adapters" o "Conectores") fuera de Observabilidad.

### Fase 3: Evolución Matemática del Motor de Contexto
Objetivo: Exprimir la arquitectura algorítmica y de grafo existente en `scoring.rs`.

**1. Pesos Dinámicos Consistentes (Intent Routing)**
*   *Problema actual:* Pesos fijos (Semántica 0.3, BM25 0.15, Grafo 0.1...).
*   *Implementación Elegante:* Crear 2 o 3 *Profiles* hardcodeados de multiplicadores basados en un chequeo rápido de la query.
    *   `Profile::Debug`: Si el input contiene `(error|bug|fix|panic|falla)`, el BM25 y Grafo suben al 30% c/u (se busca el archivo exacto y sus dependencias).
    *   `Profile::Default`: El balance actual.
    *   *Por qué funciona:* Es determinista, predecible y no requiere llamadas a embeddings externos. Solo condicionales limpios sobre la query de entrada.

**2. Grafo de Nivel 2 (Spreading Activation Ligero)**
*   *Problema actual:* Solo hacemos *boost* a memorias con conexión directa (Profundidad 1) a los "Top 5".
*   *Implementación:* Durante el Second Pass en `engine.rs`, cargar en memoria los IDs de los hijos de los hijos (Profundidad 2). Asignar un bonus de `+0.10` a los de nivel 1, y `+0.03` a los de nivel 2. Permite descubrir contexto adyacente que el programador olvidó enlazar directamente.

**3. Expansión Simple de Query**
*   *Implementación:* Antes de ejecutar `compute_bm25`, tener un pequeño diccionario rústico (HashMap) o un normalizador de raíces léxicas. Si la query dice `error`, expandir el input real contra BM25 a `error bug fix excepcion`. Es súper liviano en CPU e infla el *recall* del BM25 un 20%.

**4. Penalizador por Decaimiento de Atención (Over-exposure Penalty)**
*   *Problema actual:* Memorias que el motor siempre empuja pero el usuario/IA nunca usa.
*   *Implementación:* Cruce matemático rápido: Si `(times_served / access_count) > X_UMBRAL` (La métrica ya vive en `ObservabilityDb` y metadatos), aplicar multiplicador `-0.1`. Obliga al sistema a "purgar" archivos que han perdido relevancia activa a favor de frescura.

### Fase 4: Abstracción MCP 
1. Estandarizar comandos para que no asuman que el cliente es Claude. Nombrar las tools como `contextos_get`, `brain_save_memory`, logrando que sean protocolos universales de este SO de contexto.
