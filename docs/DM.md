# LinkedIn DM — Copy-paste ready

---

Tuna — built a diff-aware Excel lint engine and wrapped it as an MCP server this week. The idea: your review agent calls `lint_diff(v3.1, v3.2)` and gets back only the issues the new version introduced, not the full audit. Scoped signal, no new UI surface.

Not a competing product — it is a building block that slots into the Provenance review queue.

Prototype, one day of work. Live demo: https://provenance-model-guard.vercel.app (drop two .xlsx files into diff mode). Code: https://github.com/Prahaasn/provenance-model-guard.

Happy to walk through it on a 15-minute call if useful.

— Prahaas
