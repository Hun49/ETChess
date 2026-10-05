## Summary
<!-- Provide a brief description of the changes made and the motivation behind them. -->

## Changes
- 

## Verification & Testing
- [ ] `pnpm run lint` passes with 0 errors
- [ ] `pnpm run check-types` passes across all 11 workspace packages
- [ ] `pnpm test` automated test suite passes 100%
- [ ] Production builds verified (`@etchess/admin`, `@etchess/web`)

## Security & Protocol Checklist
- [ ] No secrets committed to source code or wrangler vars
- [ ] Proper authentication, authorization, and rate limiting enforced
- [ ] Realtime frames validate Zod schema with `expectedPly`
- [ ] Database mutations are durable, idempotent, and error-safe
