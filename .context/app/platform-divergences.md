# Platform divergences

Every edit ThreatWorker carries to a file Sunrise owns, recorded in the same PR
as the edit. Read this before resolving any conflict in an upstream sync. The
row format and the sync steps that retire rows are in
[`CUSTOMIZATION.md`](../../CUSTOMIZATION.md#the-divergence-ledger).

| #   | File                                  | Change                                                                        | Why no seam could carry it                                                                                                       | Merge action                                            | Upstream                                                      | Delete when                                                                                                            |
| --- | ------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `tests/unit/lib/app/defaults.test.ts` | Pin the `lib/app/reserved-tiers.ts` row to `['.context/app']` instead of `[]` | The seam is filled on purpose, and this table asserts every seam ships empty; its FORK NOTE says to pin the row, never delete it | Take theirs, then re-apply the one-line pin to that row | none: every fork that fills this seam pins this row by design | Sunrise reads the seam's declared value in this row instead of asserting `[]`, or `.context/app` is no longer declared |

Next row: 2
