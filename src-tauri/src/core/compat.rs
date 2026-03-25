/// Generate .cursorrules from claude.md content.
/// Cursor uses the same format, so minimal transformation needed.
pub fn generate_cursorrules(claude_md: &str) -> String {
    let mut out = String::from("# AI Context OS — Cursor Rules\n");
    out.push_str("# Auto-generated from claude.md. Do not edit manually.\n\n");
    out.push_str(claude_md);
    out
}

/// Generate .windsurfrules from claude.md content.
pub fn generate_windsurfrules(claude_md: &str) -> String {
    let mut out = String::from("# AI Context OS — Windsurf Rules\n");
    out.push_str("# Auto-generated from claude.md. Do not edit manually.\n\n");
    out.push_str(claude_md);
    out
}
