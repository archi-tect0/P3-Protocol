# Atlas Constraint Architecture

## The Substrate Moat

Atlas is **open to extension but closed to corruption**. Developers can build on Atlas, but they cannot bypass its substrate rules.

---

## Manifest Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPER INPUT                                    │
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │  Web2 API    │    │  Web3 Flow   │    │  Custom App  │                 │
│   │  Manifest    │    │  Manifest    │    │  Manifest    │                 │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
│          │                   │                   │                          │
└──────────┼───────────────────┼───────────────────┼──────────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION LAYER                                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Schema Validation                                │   │
│   │  • JSON/XML structure check                                         │   │
│   │  • Required fields verification                                     │   │
│   │  • Endpoint signature validation                                    │   │
│   │  • Auth requirement declaration                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                            ┌───────┴───────┐                               │
│                            │   PASS/FAIL   │                               │
│                            └───────┬───────┘                               │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    ▼               │               ▼                       │
│              ┌─────────┐           │         ┌─────────┐                   │
│              │ REJECT  │           │         │  PASS   │                   │
│              │ + Error │           │         └────┬────┘                   │
│              └─────────┘           │              │                        │
│                                    │              │                        │
└────────────────────────────────────┼──────────────┼────────────────────────┘
                                     │              │
                                     │              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         META-ADAPTER (Chokepoint)                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Normalization Layer                              │   │
│   │  • Convert to internal catalog format                               │   │
│   │  • Generate NL patterns automatically                               │   │
│   │  • Assign unique endpoint keys                                      │   │
│   │  • Map auth requirements to Vault                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Safety Enforcement                               │   │
│   │  • Rate limit declaration                                           │   │
│   │  • Credential injection rules                                       │   │
│   │  • Execution boundary enforcement                                   │   │
│   │  • No raw code execution                                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CATALOG REGISTRY                                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  catalogStore.ts                                                     │   │
│   │  • Indexed by category, provider, capability                        │   │
│   │  • Queryable via DevKit                                             │   │
│   │  • Versioned and auditable                                          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CANVAS VISIBILITY                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Every registered endpoint is:                                       │   │
│   │  • Visible in Canvas UI                                             │   │
│   │  • Queryable via DevKit NL                                          │   │
│   │  • Inspectable by any user                                          │   │
│   │  • Testable with sample inputs                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Transparency is enforced, not optional.                                   │
│   If it's in Atlas, it's visible.                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECOSYSTEM EXECUTION                                  │
│                                                                             │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│   │   Voice/NL       │  │   Flow Composer  │  │   Direct API     │         │
│   │   Interface      │  │   (Compound)     │  │   Execution      │         │
│   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘         │
│            │                     │                     │                    │
│            └─────────────────────┼─────────────────────┘                    │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌─────────────────────────┐                              │
│                    │   Executor Service      │                              │
│                    │   • Credential inject   │                              │
│                    │   • Rate limit check    │                              │
│                    │   • Response normalize  │                              │
│                    │   • Anchor if needed    │                              │
│                    └─────────────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Cloning Doesn't Work

| Layer | What They'd Need to Replicate |
|-------|------------------------------|
| Validation | Schema enforcement logic, rejection handling |
| Meta-Adapter | Normalization pipeline, NL pattern generation |
| Catalog | Indexing, versioning, query interface |
| Canvas | Introspection UI, visibility enforcement |
| Executor | Credential injection, rate limits, anchoring |

**The substrate IS the value.** Copying endpoints is easy. Replicating the constraint architecture is not.

---

## Extension vs Corruption

### What Developers CAN Do

```
✓ Write new manifests (Web2, Web3, custom)
✓ Remix existing flows (add steps to portfolio-brief)
✓ Publish flows to ecosystem
✓ Query via DevKit
✓ Trigger via voice/NL
```

### What Developers CANNOT Do

```
✗ Bypass schema validation
✗ Inject raw code into execution
✗ Hide endpoints from Canvas
✗ Access credentials directly
✗ Skip rate limiting
✗ Execute without audit trail
```

---

## The Moat Statement

> Atlas is infrastructure that welcomes extension but prevents corruption.
> Developers plug INTO Atlas — they don't replicate it.
> The constraint architecture is the product.
