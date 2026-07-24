# Graph Report - VaxTrace  (2026-07-10)

## Corpus Check
- 10 files · ~20,699 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 99 nodes · 95 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `VaxTrace — UI/UX Master Plan` - 12 edges
2. `4. Design System & Component Library` - 6 edges
3. `5. Screen Inventory — 28 screens` - 6 edges
4. `scripts` - 5 edges
5. `figure_fullpage()` - 4 edges
6. `add_complex_field()` - 3 edges
7. `make_table()` - 3 edges
8. `_caption()` - 3 edges
9. `_png_size()` - 3 edges
10. `compilerOptions` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (13 total, 3 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (10): add_complex_field(), _caption(), figure_fullpage(), make_table(), _png_size(), Return (width, height) in pixels from a PNG header (no extra deps)., Place any diagram on its own A4 portrait page, scaled to fit the shared box., set_cell() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (11): 0. Purpose of this document, 10. Open follow-ups, 1. Design Principles (govern every screen), 2. Actors, Roles & Permission Matrix, 3. Information Architecture & Route Map (Next.js App Router), 6. Key User Journeys / Flows, 7. Responsive & Mobile Adaptations, 8. UX Improvements Beyond the SRS (folded into the 28 screens) (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (11): dependencies, next, react, react-dom, devDependencies, autoprefixer, postcss, tailwindcss (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): 4.1 Foundations (Figma variables / design tokens), 4.2 Core components, 4.3 Composite / data patterns (reused; not counted as screens), 4.4 Dashboard widgets, 4.5 Domain primitives (VaxTrace-specific, reused everywhere), 4. Design System & Component Library

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): 5. Screen Inventory — 28 screens, A. Authentication & Onboarding — 4, B. Parent / Guardian (mobile-first, light) — 6, C. Healthcare Worker (ops console, tablet/desktop) — 6, D. Administrator (data-dense, dark-first) — 8, E. Shared / System — 4

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, @/*

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

## Knowledge Gaps
- **37 isolated node(s):** `baseUrl`, `@/*`, `nextConfig`, `name`, `version` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VaxTrace — UI/UX Master Plan` connect `Community 2` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `4. Design System & Component Library` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `5. Screen Inventory — 28 screens` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `Return (width, height) in pixels from a PNG header (no extra deps).`, `Place any diagram on its own A4 portrait page, scaled to fit the shared box.`, `baseUrl` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._