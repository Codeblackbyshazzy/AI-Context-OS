# AI Context OS — Features Pendientes

## Scoring & Contexto Inteligente

- [ ] **Semantic scoring real** — Actualmente `semantic_free` usa una heurística por longitud. Implementar embeddings locales (ej. `rust-bert` o llamada a API) para similitud semántica real entre query y memorias
- [ ] **Persistir access_count a disco periódicamente** — El watcher actualiza el index en memoria pero no persiste los counters incrementados externamente. Añadir flush periódico o al cerrar la app
- [ ] **Skills: campo `optional` como boost** — Las memorias en `optional` de un skill deberían recibir un boost de score (no force-load como `requires`, pero sí priorización)
- [ ] **Compat files diferenciados** — `.cursorrules` y `.windsurfrules` actualmente son copias idénticas de `claude.md`. Adaptar formato según las convenciones de cada herramienta

## Router (claude.md)

- [ ] **Secciones por herramienta activa** — El router debería generar secciones diferentes según `active_tools` en config (ej. sección Claude vs sección Cursor)
- [ ] **Attention positioning configurable** — Permitir al usuario reordenar la prioridad de secciones en el router

## Journal

- [ ] **Scroll infinito de días** — Actualmente solo muestra un día. Implementar vista tipo Logseq con scroll vertical que carga días anteriores dinámicamente
- [ ] **Linked references** — Mostrar qué memorias referencian la fecha actual (backlinks)
- [ ] **Templates de día** — Bloques pre-configurados según el día (ej. lunes = standup, viernes = retrospectiva)
- [ ] **Extracción automática de tags** — Detectar #tags en bullets y añadirlos al frontmatter de memorias relacionadas

## Tasks

- [ ] **Drag & drop para reordenar** — Priorización visual arrastrando cards
- [ ] **Vista Kanban** — Columnas por estado (todo/in_progress/done)
- [ ] **Tasks desde journal** — Checkbox en journal que crea/sincroniza task en 07-tasks/
- [ ] **Due dates** — Campo de fecha límite con indicador visual de urgencia
- [ ] **Subtasks** — Jerarquía de tareas con progreso porcentual

## Graph

- [ ] **Filtros interactivos** — Filtrar nodos por tipo, importancia mínima, tags
- [ ] **Clusters automáticos** — Agrupar memorias por comunidades detectadas en el grafo
- [ ] **Decay visual** — Opacidad de nodos según decay score (ya está en el modelo, falta en la UI)
- [ ] **Click para editar** — Al hacer click en un nodo, navegar al editor de esa memoria

## Governance

- [ ] **Acciones desde la UI** — Botones para: archivar decay candidates, promover scratch a permanente, resolver conflictos
- [ ] **Consolidación ejecutable** — Que las sugerencias de consolidación se puedan aplicar con un click (merge entries → nueva memoria)
- [ ] **Scratch auto-cleanup** — Opción para eliminar automáticamente archivos scratch expirados
- [ ] **Historial de governance** — Log de acciones tomadas (archivados, promovidos, etc.)

## Explorer & Editor

- [ ] **Context menu** — Click derecho en el tree: renombrar, mover, duplicar, eliminar
- [ ] **Drag & drop entre carpetas** — Mover memorias entre tipos arrastrando en el tree
- [ ] **Búsqueda global** — Cmd+K para buscar por contenido/tags/id en todas las memorias
- [ ] **Preview de markdown** — Toggle entre editor y preview renderizado
- [ ] **TipTap: toolbar opcional** — Aunque el diseño es markdown-only por atajos, opción de mostrar toolbar para usuarios nuevos

## Simulation

- [ ] **Perfiles de simulación guardados** — Guardar combinaciones de query + budget para reutilizar
- [ ] **Comparar simulaciones** — Vista side-by-side de dos simulaciones con diferente query/budget
- [ ] **Export de contexto** — Botón para copiar el contexto simulado al clipboard (lo que iría en claude.md)

## Infraestructura

- [ ] **Tests** — Unit tests para scoring, decay, frontmatter parsing, router generation
- [ ] **Auto-update** — Integrar tauri-plugin-updater para actualizaciones automáticas
- [ ] **Backup/restore** — Exportar/importar todo el workspace como .zip
- [ ] **Métricas de uso** — Dashboard con estadísticas: memorias más accedidas, evolución de tokens, efectividad del contexto
- [ ] **Multi-workspace** — Soporte para múltiples workspaces (ej. uno personal, otro por proyecto)
- [ ] **Import desde Obsidian/Logseq** — Migrador que convierte vaults existentes al formato AI Context OS

## UX

- [ ] **Onboarding mejorado** — Tutorial interactivo post-setup que explique el flujo completo
- [ ] **Keyboard shortcuts completos** — Cmd+N (nueva memoria), Cmd+S (guardar), Cmd+K (búsqueda), Cmd+G (graph)
- [ ] **Notificaciones toast** — Feedback visual para acciones (guardado, error, conflicto detectado)
- [ ] **Responsive sidebar** — Colapsar sidebar icon-only en pantallas pequeñas (ya parcial)
- [ ] **Temas adicionales** — Más allá de dark/light: variantes de color accent
