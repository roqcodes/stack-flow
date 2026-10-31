# Module Development Template

This directory serves as the official reference implementation and architectural template for all business modules in Brightloop.

---

## Module Boundary Structure

```
src/modules/[module_name]/
├── types.ts          # Domain interfaces, statuses, payload types
├── validations.ts    # Zod schemas for all external inputs and mutations
├── actions.ts        # Next.js Server Actions ("use server") using ApiResult contract
└── components/       # Domain-specific UI components
    └── index.ts      # Public component exports
```

---

## Mandatory Engineering Rules for Module Authors

1. **Isolation:** Never import private components or private actions from another module.
2. **Server-Side Enforcement:** Always enforce `requireAuth()` or `requireRole([...])` at the top of Server Actions.
3. **Zod Validation:** Validate all inputs before any database queries.
4. **API Contract:** Always return `apiSuccess(...)` or `apiError(...)` from `src/lib/api-response`.
5. **No Floating Point:** For financial amounts, parse and store as numbers matching `NUMERIC(14,2)` precision.
6. **Zero Mock Data:** Never introduce fake data into business logic.
