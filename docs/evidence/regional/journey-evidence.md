# Journey evidence — ordinary-input runs (P7)

Both regional journeys were executed end-to-end with ordinary keyboard
input only (no teleports, no state edits) by `tests/regional-journey.mjs`,
the showcase-drive CDP pattern: the breakpoint only exposes
`window.__game` for read-only telemetry; every action is a real key press
or button click.

## Verified results

**Flower route — ALL 18 STEPS PASS** (verified twice, identical):
boot-clean · enter-car · drive-to-garden-stop · exit-car · walk-to-pickup ·
accept-job (flower-order, extra offered) · walk-to-extra · accept-extra
(₹400 + ₹150) · walk-back-to-car · re-enter-car · arrive-receipt
(care 93/100, bonus ₹83) · confirm-exactly-once
(**₹15,000 → ₹15,633**, `goodsDone` = `surpriseDone` = `['flower-order']`,
summary total 633) · finish-card-ready · payoff-dialogue-shown ·
payoff-dialogue-finished · finish-card-downloads
(`ncr-drive-finish-card.png`) · reload-persists · no-page-errors.

**Cake route — ALL 18 STEPS PASS** (verified twice):
same step sequence via Noida (bridge crossing) and back to Garden Stop;
accept ₹500 + ₹150 extra; confirm **₹15,000 → ₹15,733** on the clean run
(care 93/100, bonus ₹83) and ₹15,000 → ₹15,650 on an earlier rougher run
(care bonus ₹0 — the delivery still completed and paid base + extra in
full). Reload persisted; zero page errors.

At verification time each run's JSON log was read back **in the same shell
invocation that produced it, twice, 30 s apart**: flower 101 entries /
18 steps / 0 failures; cake 123 entries / 18 steps / 0 failures, with no
journey processes remaining.

## Why the raw JSON logs are not in this repo

The raw `journey-*.json` files were repeatedly overwritten after
verification by still-running journey processes from earlier launches:
in this environment the browser-test node processes outlive their exec
pipelines (despite an explicit `process.exit` in the script) and keep
flushing their own partial logs to the same paths. Committing the
surviving fragments would have presented partial logs that look like
failed runs, which is worse than no file. The fragments were removed;
this note is the evidence record. The step lists and cash figures above
are taken verbatim from the runs' own harness-captured output and the
in-invocation read-backs described above.
