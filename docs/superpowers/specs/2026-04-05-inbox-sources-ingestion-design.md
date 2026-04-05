# Inbox, Sources & Ingestion System — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Approach:** Big Bang (single PR, atomic commits)

---

## Overview

Add a two-stage ingestion pipeline to AI Context OS: `00-inbox/` (temporary capture zone) and `01-sources/` (protected reference material). Includes folder renumbering, new metadata fields, UI protection controls, and an LLM-driven ingestion protocol via `_INGEST.md`.

## Goals

- Clean folder hierarchy with sources as a first-class concept
- Per-file protection toggle (candado) to prevent accidental edits
- Status tracking for inbox items (unprocessed/processed)
- Traceability from compiled knowledge back to sources (`derived_from`)
- LLM-agnostic ingestion protocol that works today with external LLMs and tomorrow with a local model

## Non-goals

- Automatic ingestion within the app (future — local model)
- OS-level file permissions (app-level policy only)
- Migration tool for existing workspaces (manual renumber for now, beta phase)

---

## 1. Folder Renumbering

### New structure

```
00-inbox/
01-sources/
02-context/
03-daily/
  sessions/
04-intelligence/
05-projects/
06-resources/
07-skills/
08-tasks/
09-rules/
10-scratch/
.cache/
```

### Changes required

**Rust — `MemoryType` enum (types.rs):**
- Add variant `Source`
- Update `folder_name()`: Source → "01-sources", Context → "02-context", Daily → "03-daily", Intelligence → "04-intelligence", Project → "05-projects", Resource → "06-resources", Skill → "07-skills", Task → "08-tasks", Rule → "09-rules", Scratch → "10-scratch"
- Update `from_folder()` with matching reverse mapping

**Rust — all files referencing folder numbers:**
- `core/router.rs`
- `core/mcp.rs`
- `core/index.rs`
- `core/governance.rs`
- `core/journal.rs`
- `core/tasks.rs`
- `commands/onboarding.rs`
- `commands/config.rs`
- `commands/journal.rs`
- `commands/daily.rs`
- `commands/governance.rs`
- `cli.rs`

**TypeScript — mirror changes:**
- `types.ts` — add Source type, update folder mappings
- Any component referencing folder paths

**Onboarding (`create_workspace_structure`):**
- Update dirs array with new numbering
- Add `01-sources/` to created dirs

### Default ontology mapping update

```
Source   → MemoryOntology::Source
Resource → MemoryOntology::Source
Context  → MemoryOntology::Entity
Project  → MemoryOntology::Entity
Task     → MemoryOntology::Entity
Skill    → MemoryOntology::Concept
Rule     → MemoryOntology::Concept
Daily    → MemoryOntology::Synthesis
Intelligence → MemoryOntology::Synthesis
Scratch  → MemoryOntology::Synthesis
```

---

## 2. New Metadata Fields

### `MemoryMeta` additions

| Field | Rust type | Serde | Default | Description |
|-------|-----------|-------|---------|-------------|
| `status` | `Option<MemoryStatus>` | `#[serde(default)]` | `None` | `unprocessed` or `processed`. Relevant for inbox/sources. |
| `protected` | `bool` | `#[serde(default)]` | `false` | Blocks edit/rename/move/delete in UI. |
| `derived_from` | `Vec<String>` | `#[serde(default)]` | `[]` | IDs of source memories this was derived from. |

### `MemoryStatus` enum

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MemoryStatus {
    Unprocessed,
    Processed,
}
```

### Default values by folder

| Folder | status | protected |
|--------|--------|-----------|
| 00-inbox | `unprocessed` | `false` |
| 01-sources | `processed` | `true` |
| Everything else | `None` | `false` |

### TypeScript mirror (types.ts)

```typescript
type MemoryStatus = "unprocessed" | "processed";

interface MemoryMeta {
  // ... existing fields ...
  status?: MemoryStatus;
  protected: boolean;
  derived_from: string[];
}
```

---

## 3. UI Changes

### Explorer icons

- `00-inbox/` — inbox tray icon (replaces generic folder icon)
- `01-sources/` — document/book icon (source material concept)
- Other folders — keep current icons

### Protection toggle (candado)

- Location: memory inspector/properties panel
- Icon: lock (closed when protected, open when not)
- Label: "Protect"
- When `protected: true`:
  - TipTap editor → readonly mode
  - Rename, move, delete buttons → disabled (grayed out)
  - Closed lock icon next to filename in explorer
- When `protected: false`:
  - Normal behavior, no lock icon or open lock

### Inbox status badge

- Files in `00-inbox/` show a visual indicator:
  - `unprocessed` → orange dot/badge, label "Sin procesar"
  - `processed` → green dot/badge, label "Procesado"
- Status badge not shown for files outside inbox/sources

### No changes to

- TipTap toolbar (stays hidden, keyboard shortcuts only)
- Editor markdown behavior
- Any other existing UI

---

## 4. `_INGEST.md` — Ingestion Protocol

### File location

`00-inbox/_INGEST.md` — created during onboarding alongside other system files.

### File characteristics

- Prefixed with `_` → system file, not indexed as a memory
- Not editable by the protection system (it's an instruction file, not a memory)

### Content

```markdown
# Instrucciones de Ingesta — AI Context OS

Cuando proceses archivos de 00-inbox/, sigue este protocolo:

## 1. Analisis
- Lee el archivo completo
- Identifica: tipo de contenido, tema, idioma, relevancia

## 2. Preguntas al usuario (si esta disponible)
- A que proyecto o area pertenece esto?
- Que nivel de importancia le asignas?
- Hay algun tag o relacion con memorias existentes?
Si el usuario no responde, clasifica autonomamente con tu mejor criterio.

## 3. Procesamiento
- Genera frontmatter YAML completo (id, type, l0, importance, tags, ontology, etc.)
- Estructura el contenido con marcadores <!-- L1 --> y <!-- L2 -->
- L1: resumen ejecutivo (2-3 lineas)
- L2: contenido completo procesado

## 4. Clasificacion y destino
- Si es material de referencia original -> mover a 01-sources/ con protected: true
- Si es conocimiento a integrar -> crear/actualizar memoria en la carpeta correspondiente, anadir derived_from
- Si no tiene valor -> marcar como processed y dejar en inbox (el usuario decide si borrar)

## 5. Post-proceso
- Actualizar status: processed en el archivo original del inbox
- Si genero nuevas memorias, asegurar que derived_from apunte al source
```

### Router integration

The generated router files (`claude.md`, `.cursorrules`, `.windsurfrules`) include a rule:

> "Si trabajas con archivos de `00-inbox/`, lee primero `00-inbox/_INGEST.md` y sigue su protocolo."

This is added to the router generation in `core/router.rs`.

---

## 5. Data Flow

```
User drops file into 00-inbox/
       │
       ▼
  status: unprocessed
  protected: false
       │
       ▼
  LLM reads _INGEST.md
  LLM asks user questions (optional)
  LLM analyzes content
       │
       ├──► Reference material → 01-sources/
       │    status: processed, protected: true
       │
       ├──► Knowledge to integrate → 02-context/, 05-projects/, etc.
       │    derived_from: ["source-id"]
       │
       └──► No value → stays in inbox
            status: processed (user deletes later)
```

---

## 6. Files to Modify

### Rust (src-tauri/src/)

| File | Changes |
|------|---------|
| `core/types.rs` | Add `Source` to `MemoryType`, add `MemoryStatus` enum, add `status`/`protected`/`derived_from` to `MemoryMeta`, update `folder_name()`/`from_folder()`/`default_ontology_for_memory_type()` |
| `core/router.rs` | Update folder references, add inbox ingestion rule to generated router |
| `core/mcp.rs` | Update folder references |
| `core/index.rs` | Update folder references, respect `protected` in write operations |
| `core/governance.rs` | Update folder references |
| `core/journal.rs` | Update folder path (03-daily) |
| `core/tasks.rs` | Update folder path (08-tasks) |
| `commands/onboarding.rs` | Update folder references, create `_INGEST.md`, create `01-sources/` |
| `commands/config.rs` | Update `create_workspace_structure` dirs array |
| `commands/journal.rs` | Update folder path |
| `commands/daily.rs` | Update folder path |
| `commands/governance.rs` | Update folder references |
| `cli.rs` | Update folder references |

### TypeScript (src/)

| File | Changes |
|------|---------|
| `lib/types.ts` | Add Source type, MemoryStatus, protected, derived_from fields |
| Explorer components | Add inbox/sources icons, lock icon for protected files, status badge |
| Editor components | Respect `protected` flag (readonly mode) |
| Memory inspector | Add "Protect" toggle |

---

## 7. Commit Strategy

4 atomic commits in one PR:

1. **`refactor: renumber workspace folders and add Source type`** — All folder renumbering in Rust + TS, new MemoryType::Source
2. **`feat: add protected, status, derived_from fields to memory model`** — MemoryMeta changes in Rust + TS, MemoryStatus enum
3. **`feat: add inbox/sources UI — icons, protection toggle, status badges`** — Explorer icons, candado toggle, readonly enforcement, status indicators
4. **`feat: add _INGEST.md and router ingestion rule`** — Create ingestion protocol file in onboarding, add router rule
