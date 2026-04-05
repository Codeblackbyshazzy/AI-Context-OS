# Documentation

This folder contains the long-form system documentation for AI Context OS.

It is designed for two audiences at the same time:

- humans who need to understand the product, review decisions, and evolve the system
- future AI agents that need a reliable explanation of how the workspace, memory model, routing, ontology, and ingestion strategy are supposed to work

## Recommended reading order

1. [Architecture And Operating Model](/Users/alexdc/Documents/GitHub/AI-Context-OS/docs/architecture-and-operating-model.md)
2. [Current State, Implemented Changes, And Roadmap](/Users/alexdc/Documents/GitHub/AI-Context-OS/docs/current-state-and-roadmap.md)

## Scope of this folder

These docs intentionally go deeper than the root README:

- system purpose and product thesis
- storage model and canonical boundaries
- progressive memory model (`L0`, `L1`, `L2`)
- ontology layer
- current workspace structure
- adapter-first integrations
- inbox and future ingestion design
- what is already implemented in code
- what is still planned
- constraints and invariants that should not be broken casually

## Source documents that informed this folder

- [README.md](/Users/alexdc/Documents/GitHub/AI-Context-OS/README.md)
- [README.es.md](/Users/alexdc/Documents/GitHub/AI-Context-OS/README.es.md)
- [AGENT.md](/Users/alexdc/Documents/GitHub/AI-Context-OS/AGENT.md)
- [AGENTS.md](/Users/alexdc/Documents/GitHub/AI-Context-OS/AGENTS.md)
- [REVISION-TECNICA-ALINEACION-2026-03-29.md](/Users/alexdc/Documents/GitHub/AI-Context-OS/REVISION-TECNICA-ALINEACION-2026-03-29.md)
- files under `roadmap/`

## Maintenance rule

When core architecture changes, update this folder in the same change whenever possible.
