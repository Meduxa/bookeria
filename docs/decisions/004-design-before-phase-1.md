# 004 — Design foundation before Phase 1 screens, from screenshots and videos

**Context.** The roadmap put the design system (Phase 2) after the Phase 1 screens, which means building every Phase 1 screen twice. Levan had reference screenshots and two short videos ready, but no Figma file.

**Decision.** Build the design foundation first (tokens, light + dark, shell, core components), then the Phase 1 screens in that style. Main colour green (3 of 5 references), light by default with a dark switch, Inter + Noto Sans Georgian. Everything is a token in `design/tokens.json` → `globals.css`, so a Figma file later changes tokens, not components.

**Consequence.** No restyling pass for Phase 1. When a Figma file arrives, compare and adjust tokens/components; fonts may change then. Staff colours are stored as names (`teal`), never hex, so the palette can change freely.
