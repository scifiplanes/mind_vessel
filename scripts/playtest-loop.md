# Softlock playtest loop (agent)

1. `npm run extract`
2. `npm run playtest` (or `playtest:full`)
3. On FAIL: read the `SOFTLOCK` JSON (`kind`, `seed`, `mindKey`, `site`)
4. Reproduce with that seed/mind in the harness or browser; fix root cause in `mind-vessel.html`
5. Extract again; re-run playtest from step 2 until PASS
6. Add a focused regression in `tests/t12-*.js` when the failure mode is new

```bash
npm run playtest -- --seeds 8 --seconds 75 --keep-going --json
```
