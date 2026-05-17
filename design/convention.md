---
title: Design Document Convention
description: Defines the metadata and section conventions used by design documents so they remain searchable and machine-parseable.
status: active
created: 2026-05-18
updated: 2026-05-18
---

# Design Document Convention

Every design document should start with YAML frontmatter. Keep field names stable so scripts can parse titles, descriptions, dates, status, and tags across the full `design/` tree.

Required fields are shown indented here so simple `^title:` searches only match real document frontmatter:

```yaml
---
  title: Short Human-Readable Title
  description: One sentence explaining the design intent and scope.
  status: draft | active | accepted | superseded
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
---
```

Recommended optional fields:

```yaml
  area: frontend | backend | platform | product | infrastructure
  tags:
    - monorepo
    - nextjs
  supersedes: path/to/older-design.md
  related:
    - path/to/related-design.md
---
```

Use exactly one H1 immediately after frontmatter, matching the `title` field:

```markdown
# Short Human-Readable Title
```

Preferred section order:

1. `## Summary`
2. `## Goals`
3. `## Current State`
4. `## Proposed Design`
5. `## Migration Plan`
6. `## Open Questions`

Short notes can omit irrelevant sections, but should keep the frontmatter and matching H1. Use stable markdown headings instead of decorative titles so files are easy to grep, index, and summarize.
