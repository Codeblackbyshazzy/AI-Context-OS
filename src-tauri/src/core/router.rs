use std::collections::BTreeMap;

use crate::core::types::{Config, MemoryMeta, MemoryOntology, SystemRole};

/// Generate the neutral router content.
/// Order follows attention positioning: RULES at top, L0 index at bottom.
/// This output is consumed by adapters in compat.rs to produce tool-specific files.
pub fn generate_router_content(memories: &[MemoryMeta], config: &Config) -> String {
    let mut out = String::with_capacity(8192);

    // ── Section 1: Rules (highest attention position) ──
    out.push_str("# RULES\n\n");
    let rules: Vec<&MemoryMeta> = memories
        .iter()
        .filter(|m| m.system_role == Some(SystemRole::Rule))
        .collect();
    if rules.is_empty() {
        out.push_str("_No rules defined yet. Add rules in .ai/rules/_\n\n");
    } else {
        for rule in &rules {
            out.push_str(&format!("- **{}**: {}\n", rule.id, rule.l0));
        }
        out.push('\n');
    }

    // ── Section 2: System overview (minimal) ──
    out.push_str("# How This Workspace Works\n\n");
    out.push_str("AI Context OS workspace. Knowledge lives in `.md` files with YAML frontmatter.\n");
    out.push_str("If MCP tools are available (get_context, save_memory, etc.), prefer them over reading files directly.\n\n");

    // ── Section 3: Reading rules ──
    out.push_str("# Reading Memories\n\n");
    out.push_str("1. Only read files needed for the current task\n");
    out.push_str("2. Start with L1 (summary). Load L2 (full) only if L1 lacks detail\n");
    out.push_str("3. Max 5 L2 files per query. For simple tasks, 2-3 L1 files suffice\n");
    out.push_str("4. Priority: rules > inbox > sources > user collections > skills\n");
    out.push_str("5. Memories with `always_load: true` are always included\n");
    out.push_str("6. If output exceeds 2000 tokens, write to `.ai/scratch/`\n\n");

    // ── Section 5: Writing rules (the critical fix) ──
    out.push_str("# Writing Memories\n\n");
    out.push_str("Every memory is a `.md` file with YAML frontmatter + body with level markers.\n\n");
    out.push_str("## Required frontmatter fields\n\n");
    out.push_str("```yaml\n");
    out.push_str("---\n");
    out.push_str("id: my-memory-name          # kebab-case, must match filename (without .md)\n");
    out.push_str("type: concept               # ontology: source | entity | concept | synthesis\n");
    out.push_str("l0: \"One-line description\"   # ultra-brief summary (shown in index)\n");
    out.push_str("importance: 0.6             # 0.0-1.0 (0.3=low, 0.5=normal, 0.7=high, 0.9=critical)\n");
    out.push_str("tags: [tag1, tag2]          # for search and categorization\n");
    out.push_str("version: 1                  # increment on each edit\n");
    out.push_str("created: 2026-01-15T10:00:00Z\n");
    out.push_str("modified: 2026-01-15T10:00:00Z\n");
    out.push_str("---\n");
    out.push_str("```\n\n");
    out.push_str("## Ontology types\n\n");
    out.push_str("- **source**: reference material, docs, articles (often protected)\n");
    out.push_str("- **entity**: people, projects, tools, organizations\n");
    out.push_str("- **concept**: ideas, patterns, principles, technical concepts\n");
    out.push_str("- **synthesis**: analysis, decisions, summaries derived from other memories\n\n");
    out.push_str("## Body structure (L1 + L2)\n\n");
    out.push_str("```markdown\n");
    out.push_str("<!-- L1 -->\n");
    out.push_str("Brief summary (50-150 words). Enough to decide if L2 is needed.\n");
    out.push_str("\n");
    out.push_str("<!-- L2 -->\n");
    out.push_str("Full detail. Extended content, examples, data, deep context.\n");
    out.push_str("```\n\n");
    out.push_str("## Where to save\n\n");
    out.push_str("- New memories: `inbox/` (default staging area)\n");
    out.push_str("- Rules: `.ai/rules/` (AI behavior directives)\n");
    out.push_str("- Skills: `.ai/skills/` (reusable skills with triggers)\n");
    out.push_str("- User collections: any folder you create at the root level\n");
    out.push_str("- Temporary outputs: `.ai/scratch/` (auto-cleaned after 7 days)\n\n");
    out.push_str("## Key rules\n\n");
    out.push_str("- `id` in frontmatter MUST match the filename (e.g., `id: my-note` → `my-note.md`)\n");
    out.push_str("- Always include both `<!-- L1 -->` and `<!-- L2 -->` markers, even if L2 is empty\n");
    out.push_str("- Increment `version` and update `modified` timestamp when editing existing memories\n");
    out.push_str("- Protected files (`protected: true`) must NOT be edited without explicit user unlock\n");
    out.push_str("- Folder/category is derived automatically from the file path — do not set it manually\n\n");

    // ── Section 6: Ingestion ──
    out.push_str("# Ingestion\n\n");
    out.push_str("Files in `inbox/` are staging. Read `inbox/_INGEST.md` first if it exists.\n\n");

    // ── Section 7: Workspace structure ──
    out.push_str("# Workspace Structure\n\n");
    out.push_str("```\n");
    out.push_str(&format!("{}/\n", config.root_dir));
    out.push_str("├── inbox/                  ← staging area for new memories\n");
    out.push_str("├── sources/                ← accepted reference material (protected)\n");
    out.push_str("├── claude.md               ← THIS FILE (master router, auto-generated)\n");
    out.push_str("├── .cursorrules            ← Cursor adapter (auto-generated)\n");
    out.push_str("├── .windsurfrules          ← Windsurf adapter (auto-generated)\n");
    out.push_str("├── .ai/                    ← system infrastructure\n");
    out.push_str("│   ├── config.yaml         ← workspace configuration\n");
    out.push_str("│   ├── index.yaml          ← L0 index of all memories (auto-generated)\n");
    out.push_str("│   ├── rules/              ← AI behavior directives\n");
    out.push_str("│   ├── skills/             ← reusable skills with triggers\n");
    out.push_str("│   ├── journal/            ← daily logs and session notes\n");
    out.push_str("│   ├── tasks/              ← task tracking files\n");
    out.push_str("│   └── scratch/            ← temporary AI outputs (TTL: 7 days)\n");
    out.push_str("└── [your folders]/         ← any structure you want\n");
    out.push_str("```\n\n");

    // ── Section 8: Session compaction ──
    out.push_str("# Session Compaction\n\n");
    out.push_str("After 15+ turns: write summary to `.ai/journal/sessions/YYYY-MM-DD-summary.md` (decisions, facts, pending tasks).\n");
    out.push_str("For long outputs: write to `.ai/scratch/` and reference the path in conversation.\n\n");

    // ── Section 9: Memory index (L0) ──
    out.push_str("# Memory Index\n\n");
    let mut grouped: BTreeMap<String, Vec<&MemoryMeta>> = BTreeMap::new();
    for memory in memories {
        let key = memory
            .folder_category
            .clone()
            .unwrap_or_else(|| "uncategorized".to_string());
        grouped.entry(key).or_default().push(memory);
    }

    if grouped.is_empty() {
        out.push_str("_No memories yet. Create your first memory in `inbox/`._\n\n");
    } else {
        for (category, group) in grouped {
            out.push_str(&format!("## {}\n", category));
            for m in group {
                let sticky = if m.always_load { " [pinned]" } else { "" };
                let role = m
                    .system_role
                    .as_ref()
                    .map(system_role_label)
                    .unwrap_or("-");
                out.push_str(&format!(
                    "- [{}] {} (imp:{:.1}, ont:{}, role:{}){}\n",
                    m.id,
                    m.l0,
                    m.importance,
                    ontology_label(&m.ontology),
                    role,
                    sticky
                ));
            }
            out.push('\n');
        }
    }

    // ── Section 10: Skill triggers ──
    let skills: Vec<&MemoryMeta> = memories
        .iter()
        .filter(|m| m.system_role == Some(SystemRole::Skill) && !m.triggers.is_empty())
        .collect();

    if !skills.is_empty() {
        out.push_str("# Skill Triggers\n\n");
        for skill in &skills {
            out.push_str(&format!(
                "- When user says: {} → load skill [{}]\n",
                skill.triggers.join(", "),
                skill.id
            ));
        }
        out.push('\n');
    }

    out
}

pub fn generate_index_yaml(memories: &[MemoryMeta]) -> String {
    let mut out = String::from(
        "# AI Context OS — Index L0 (autogenerated)\n# Do not edit manually\n\nmemories:\n",
    );
    for m in memories {
        out.push_str(&format!(
            "  - id: {}\n    type: {}\n    folder_category: {}\n    system_role: {}\n    l0: \"{}\"\n    importance: {}\n    tags: [{}]\n",
            m.id,
            ontology_label(&m.ontology),
            m.folder_category.as_deref().unwrap_or(""),
            m.system_role.as_ref().map(system_role_label).unwrap_or(""),
            m.l0.replace('"', "\\\""),
            m.importance,
            m.tags.join(", ")
        ));
    }
    out
}

fn ontology_label(ontology: &MemoryOntology) -> &str {
    match ontology {
        MemoryOntology::Source => "source",
        MemoryOntology::Entity => "entity",
        MemoryOntology::Concept => "concept",
        MemoryOntology::Synthesis => "synthesis",
    }
}

fn system_role_label(role: &SystemRole) -> &str {
    match role {
        SystemRole::Rule => "rule",
        SystemRole::Skill => "skill",
    }
}
