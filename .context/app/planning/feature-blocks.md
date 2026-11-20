# ThreatWorker — feature blocks

One block per feature, with what the Hub's `create_feature` takes. Plan:
[`app-plan.md`](./app-plan.md). Written against the Hub process at version 1.60.0
(`hub://process/core` and `hub://process/sunrise-fork`).

**Tasks here are indicative only.** The person who claims a feature reconciles them
against the tree (`fp1`) and plans the real ones with `plan_feature`. Sizes are on the
Hub's task scale (XS to XL) and are a sketch until then.

**Shipped when** is the feature's done-when and needs a deployed build (`fp3b`). A task's
own done-when holds only what is provable at merge.

**How a feature uses the spec.** Each block has a **Spec** line naming the sections of
[`spec.md`](./spec.md) it builds. The claimer reads those sections before reconciling,
task descriptions link to them rather than copying them (`model.spec`), and a reviewer
checks the PR against them. If the design changes, the spec changes, and the blocks stay
true.

## Phase own-apps — Our own apps

ThreatWorker as a tool we run on Sunrise and its forks: map, scan, report, access
checks, fixes tracked to done. Fifteen features and 37 indicative tasks. Everything here
is passive or read-only, and runs on GitHub-hosted runners.

The critical path is App frame, Targets, Scan scope, Scan runs, Findings, Passive
baseline, Canary, Reports. Route inventory runs beside it from Targets, and Test
identities into Access checks follows.

### Milestone 1 · Route map

#### `f-app-frame` · App frame

The fork stood up with ThreatWorker's brand and navigation, multi-tenancy on, and only
the Sunrise sections we use left open. Members read; admins and owners act. There is no
viewer role.

- **Depends on:** nothing.
- **Spec:** Commercial model (tenancy) · Data model and API surface · What Sunrise
  supplies.
- **Shipped when:** a signed-in member reaches their org's ThreatWorker pages, and an org
  admin cannot open a closed Sunrise section.
- **Indicative tasks:** Stand up the fork and fill the brand and navigation seams (M) ·
  Turn on multi-tenancy in development and CI (M) · Close the Sunrise sections customers
  will not use (S).
- **Decisions recorded here:** D1, D2, D6. D12 (no viewer role) to confirm.

#### `f-targets` · Targets

An app we look after: its name, environment, repo and the routes it means to be public.

- **Depends on:** `f-app-frame`.
- **Spec:** Data model (`Target`) · API (`/targets`).
- **Shipped when:** a real fork is added as a target with its repo connected, and a
  member of another org cannot read it by id.
- **Indicative tasks:** Add targets with their routes and pages, and the cross-org test
  helper every later model uses (L) · Connect a target's GitHub repo read-only (M).
- **Owner question (D13):** a GitHub App or a per-target token for repo access. The App
  is more work now and is what customers will need in milestone 7.

#### `f-route-inventory` · Route inventory

Every API route in a target's repo at a given commit, with what it declares: guard,
tier, ownership, required switch and key scope.

- **Depends on:** `f-targets`.
- **Spec:** Route inventory and access checks · Data model (`RouteInventory`).
- **Shipped when:** the inventory for a real fork lists its routes with their
  declarations, and a route with no guard that is not on the public list is flagged.
- **Indicative tasks:** Read routes and their declarations from a repo (L) · Store the
  inventory per commit and show the route map (M).
- **Hypotheses:** under 5% of routes fall outside the three classes (guarded,
  self-authenticating, public); the count on Sunrise `main` goes in the first PR.
  Parsing can run in a web function from a repo archive; if not, it moves to the runner
  and this feature waits on `f-runner`.

### Milestone 2 · Passive scans and findings

#### `f-scan-scope` · Scan scope

The hosts a target may be scanned on, proof that we own each, and the one check every
dispatch passes through.

- **Depends on:** `f-targets`.
- **Spec:** Safety controls (scope, ownership, rules of engagement) · Scan profiles
  (scope rules) · Data model (`TargetHost`).
- **Shipped when:** a target with an unverified host cannot be scanned, and one verified
  against a real staging app can.
- **Indicative tasks:** Add hosts and verify ownership by DNS record or file (M) · Add
  the one scope check every dispatch calls (S).
- **Decision needed before it ships:** D4 (first targets).

#### `f-runner` · Scan runs

The app dispatches a scan to a GitHub-hosted runner and takes each tool's output back.

- **Depends on:** `f-scan-scope`.
- **Spec:** Runner contract · Data model (`ScanRun`, `ToolRun`) · API (`/runs`).
- **Shipped when:** a run started from the app completes on a GitHub runner and its
  output is ingested.
- **Indicative tasks:** Dispatch a run and take its results back (L) · Write the scan
  workflow with pinned tool images (M) · Show runs and their logs (M).
- **Hypotheses:** results go to storage and the callback posts a reference, so report
  size is not limited by the web host; GitHub's terms allow scanning our own staging
  from hosted runners.
- **Before it ships:** make the repo private. Actions logs on a public repo are readable
  by anyone (R10).

#### `f-findings` · Findings

One record per issue, however many tools and runs see it.

- **Depends on:** `f-runner`.
- **Spec:** The finding record · Data model (`Finding`, `FindingSighting`).
- **Shipped when:** two runs against one target give one record per issue, each seen
  twice.
- **Indicative tasks:** Normalise and fingerprint tool output into findings (L) · Add
  findings pages and triage states (M) · Turn the route map's flagged routes into
  findings (S). The last is the swap for milestone 1's stand-in.

#### `f-baseline-scans` · Passive baseline

The read-only profile that is safe on production: web baseline, templated checks, TLS.

- **Depends on:** `f-findings`.
- **Spec:** Toolbox for our own apps · Scan profiles (`passive-baseline`) · Data model
  (`ScanProfile`).
- **Shipped when:** the profile against a real staging app produces findings from each of
  its three tools.
- **Indicative tasks:** Add the passive profile with the ZAP driver and parser (M) · Add
  the Nuclei and testssl.sh drivers and parsers (M). The first is the checkpoint that
  proves the whole path; the second repeats its recipe.

### Milestone 3 · Reports and the canary

#### `f-canary` · Canary

A small app with planted bugs, scanned in every run, so a scanner that stops working
fails loudly.

- **Depends on:** `f-baseline-scans`.
- **Spec:** Canary · Scan profiles (`canary`).
- **Shipped when:** removing a plant's expected finding from a run fails that run with
  the plant named.
- **Indicative tasks:** Build the canary app and its list of plants (M) · Fail any run
  that misses a plant (S).

#### `f-reports` · Reports

A frozen report per run or per target: grade, what was and was not tested, findings with
fixes, and the canary result.

- **Depends on:** `f-findings`, `f-canary`.
- **Spec:** Reports · OWASP Top 10 coverage.
- **Shipped when:** a run against the canary produces a report whose findings, coverage
  and canary result match the run.
- **Indicative tasks:** Freeze a report and write the fix guidance for every rule (L) ·
  Render the PDF in the runner (M) · Share by expiring link and export JSON and SARIF
  (M).

### Milestone 4 · Access checks

#### `f-test-identities` · Test identities

Seeded test accounts in a target's staging data, with credentials ThreatWorker holds and
hands to a run as short-lived sessions.

- **Depends on:** `f-targets`, `f-runner`.
- **Spec:** Data model (`TestIdentity`) · Route inventory and access checks (test
  identities, filling route parameters) · Safety controls (test accounts, short-lived
  credentials).
- **Shipped when:** a run obtains a session for each seeded identity on a real staging
  target.
- **Indicative tasks:** Write the seed unit for test accounts in the target app (M) ·
  Store identities and issue sessions per run (M) · Map each route's parameters to the
  rows each identity owns (M).

#### `f-access-checks` · Access checks

Every route called signed out and as every identity; any answer the route's own
declaration says should have been refused is a finding.

- **Depends on:** `f-route-inventory`, `f-findings`, `f-canary`, `f-test-identities`.
- **Spec:** Route inventory and access checks · Toolbox for our own apps (both access
  checks) · Scan profiles (`authz-signed-out`, `authz-cross-user`) · Canary (access
  plants).
- **Shipped when:** the check against the canary reports its planted unguarded route,
  cross-user read and cross-org read, and no others.
- **Indicative tasks:** Confirm guarded routes refuse a signed-out caller (M) · Call
  every route as every identity and classify the answers (L). The first needs no
  identities, so it can land with milestone 3 and count toward it.

### Milestone 5 · Schedules and tracked fixes

#### `f-schedules` · Schedules

A target and profile on a repeating schedule.

- **Depends on:** `f-runner`, `f-reports`.
- **Spec:** Running it as a programme (scan cadence) · Data model (`ScanSchedule`).
- **Shipped when:** a scheduled run starts on time, completes, and its report arrives by
  email.
- **Indicative tasks:** Add schedules that start each due run once (M) · Email the report
  when a scheduled run finishes (S).

#### `f-tracked-fixes` · Tracked fixes

A finding filed to the Hub, resolved only when a re-scan agrees, and reopened if it
returns.

- **Depends on:** `f-findings`.
- **Spec:** The finding record (states, `slaDueAt`, `hubTaskId`) · Running it as a
  programme · Safety controls (no public disclosure).
- **Shipped when:** a fixed canary plant resolves its finding on the next run, restoring
  it reopens the Hub task, and the filed text holds no secret.
- **Indicative tasks:** File a finding to the Hub on a chosen feature (M) · Resolve
  fixed findings and reopen returning ones on ingest (M) · Add fix deadlines by severity
  and expiry on accepted risks (M).
- **Hypothesis:** the Hub accepts a direct HTTP call with a project key. If not, file to
  a private GitHub issue first.

#### `f-code-alerts` · Code alerts

The target repo's CodeQL, secret-scanning and Dependabot alerts shown as findings.

- **Depends on:** `f-findings`, `f-targets`.
- **Spec:** Toolbox for our own apps (GitHub alert feeds) · Scan profiles
  (`code-alerts`).
- **Shipped when:** a target's open alerts appear as findings, including the canary's
  planted dependency and token.
- **Indicative tasks:** Import a repo's code, secret and dependency alerts as findings
  (M) · Refresh alerts hourly and resolve the ones GitHub closes (S).

#### `f-history` · History

Every scan, finding, state change and recommendation kept as a record nobody can alter,
searchable and exportable.

- **Depends on:** `f-findings`, `f-reports`. Needs D10 (retention) before it is planned.
- **Spec:** History and audit.
- **Shipped when:** a search for a rule returns every run and finding that matched it in
  that org, and a resolved finding's timeline shows each change with who, when and why.
- **Indicative tasks:** Record every change as an event that cannot be altered (L) · Add
  search and the per-finding timeline (M) · Export the record for a date range (S).
- **Better first:** History before Tracked fixes. Its event writes sit inside every state
  change, so landing it first saves reworking the resolve and reopen paths.

## Phase open-door — Open to customers

Everything a stranger needs: the public quick check, sign-up to first report, our own
workers, terms, the badge, plans, their trackers. Eight features and 17 indicative
tasks.

Quick check waits only on Reports, so it can be built while milestones 4 and 5 are
under way. The path to a paying customer is Scan workers, Scan terms and Routes for any
app into Onboarding, then Plans.

### Milestone 6 · Quick check

#### `f-quick-check` · Quick check

Paste any URL on the public site and get a short read-only grade on headers, cookies,
TLS and redirects. The only check that runs without proof of ownership, so it does only
what one browser visit does.

- **Depends on:** `f-reports`. Needs D7's answer on whether it is free.
- **Spec:** Quick check · Safety controls (quick-check limits).
- **Shipped when:** a check of a public site returns a grade, and a check of an internal
  address is refused.
- **Indicative tasks:** Build the one-page check with its address guard (L) · Add the bot
  challenge and the per-visitor and per-domain limits (M) · Add the public page, the
  grade and the step into proving ownership (M).
- **Hypothesis:** the host can run the check in a function with its own outbound
  network, apart from the main app.

### Milestone 7 · Customer onboarding

#### `f-worker-tier` · Scan workers

Short-lived workers we run, whose network can reach only a target's listed hosts. Every
customer scan runs here.

- **Depends on:** `f-runner`. Needs D3 (which runtime).
- **Spec:** Runner contract · Safety controls (isolated runs).
- **Shipped when:** a run on a worker cannot reach any host outside its target's list.
- **Indicative tasks:** Choose and stand up the worker runtime (L) · Send every customer
  org's runs to workers (M).

#### `f-scan-terms` · Scan terms

The customer's recorded statement that they may test each target, licence clearance for
every bundled tool, and a public page on how we scan.

- **Depends on:** `f-scan-scope`. Needs D9 (legal review).
- **Spec:** Commercial model (terms and authority) · Build or buy, licences.
- **Shipped when:** a target cannot be verified until its authority statement is
  accepted, and the record shows the wording version.
- **Indicative tasks:** Record the authority statement for each target (M) · Clear every
  tool's licence and publish how we scan (S).

#### `f-any-app-routes` · Routes for any app

Access checks for apps that are not Sunrise forks: an OpenAPI file with the expected
access per route, or a small package that publishes a Next.js app's routes and guards.

- **Depends on:** `f-route-inventory`, `f-access-checks`.
- **Spec:** Route inventory and access checks (apps that are not Sunrise forks) · Data
  model (`RouteInventory` source field). The package needs a new spec section when
  planned.
- **Shipped when:** a sample non-Sunrise API and a plain Next.js app each get signed-out
  and cross-user checks.
- **Indicative tasks:** Import routes and expected access from an OpenAPI file (L) ·
  Publish the route-manifest package for Next.js apps (L).

#### `f-onboarding` · Onboarding

From sign-up to a first full report with no help from us.

- **Depends on:** `f-quick-check`, `f-worker-tier`, `f-scan-terms`, `f-any-app-routes`.
- **Spec:** Commercial model (onboarding).
- **Shipped when:** a new account goes from sign-up to a first full report with no admin
  step.
- **Indicative tasks:** Walk a new owner from sign-up to their first scan (M) · Send
  first-run emails and fill the empty pages (S).
- **Reconcile note:** Sunrise gives an uninvited sign-up its own org and has a
  welcome-step seam, so this is the wizard only. Both landed on Sunrise `main` after
  `v0.19.0`, so the fork needs the release that carries them first.

#### `f-badge` · Shipshape badge

A badge an owner shows on their own site, and the public page behind it. ThreatWorker is
the name the person running scans sees; Shipshape is what their customers see. It is
aimed first at people taking a product they built to market, and every badge links back
to us.

- **Depends on:** `f-scan-scope`, `f-reports`, `f-schedules`. Needs D11 (the criteria).
- **Spec:** Shipshape badge.
- **Shipped when:** a verified target that meets the criteria shows the badge on a real
  site, and opening a high finding against it turns the badge and its page to "not
  current" within the hour.
- **Indicative tasks:** Work out a target's badge state from its runs and findings (M) ·
  Serve the public badge image and its verification page (M).
- **Hypothesis:** the badge page can be served from its own domain by the same
  deployment, with its own strict content policy.

### Milestone 8 · Plans and integrations

#### `f-billing` · Plans

Plans, checkout, and limits enforced where a scan is dispatched.

- **Depends on:** `f-onboarding`. Needs D7 in full.
- **Spec:** Commercial model (plans and limits).
- **Shipped when:** an org cannot start a profile its plan excludes, and moving to a plan
  that includes it unlocks it.
- **Indicative tasks:** Define plans as switches and meters, enforced at dispatch (M) ·
  Add checkout, payment webhooks and the billing page (L).
- **Owner question (D14):** Sunrise has its own billing proposal with no rulings yet.
  Decide whether ThreatWorker builds its own or waits, before this is claimed.

#### `f-integrations` · Integrations

Customer findings to GitHub Issues, Jira and Slack, created once and updated when a
finding resolves or returns.

- **Depends on:** `f-tracked-fixes`.
- **Spec:** Commercial model (integrations).
- **Shipped when:** a finding filed to GitHub Issues closes when its fix is proven.
- **Indicative tasks:** Put the Hub behind one adapter and add GitHub Issues (M) · Add
  Jira and Slack (M).

## Later phases

Eleven features held as summaries. Each gets a spec section, a full block and indicative
tasks when someone is about to claim it. None has a milestone yet; insert one when there
is something to show.

| Phase | Feature                                     | Depends on                             | Summary                                                                                                                                                                   |
| ----- | ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| edge  | `f-mcp-server` · MCP tools                  | `f-findings`                           | Claude Code and other agents list findings, read evidence and ask for a re-scan. Built on Sunrise's MCP server; check that one org's key cannot reach another's findings. |
| edge  | `f-ai-triage` · AI triage                   | `f-tracked-fixes`                      | An agent in each org explains a finding and suggests a fix, labelled as AI-written. It redacts secrets, holds no write tools and never creates findings.                  |
| edge  | `f-sunrise-rules` · Sunrise rules           | `f-code-alerts`                        | Our own rules for Sunrise anti-patterns, run in each fork's CI.                                                                                                           |
| edge  | `f-preview-scans` · Preview scans           | `f-access-checks`                      | Passive and access checks on each pull request's preview, with results as a comment.                                                                                      |
| edge  | `f-regression-tests` · Regression tests     | `f-access-checks`                      | A confirmed access finding exported as a test in the app's own suite.                                                                                                     |
| edge  | `f-fix-prs` · Fix pull requests             | `f-integrations`                       | A pull request with the fix for findings whose fix is known for the stack.                                                                                                |
| edge  | `f-compliance-mapping` · Compliance mapping | `f-reports`                            | Findings and coverage mapped to OWASP ASVS and SOC 2 controls in the report.                                                                                              |
| depth | `f-approval-gate` · Approval gate           | `f-runner`                             | Active profiles need an approved, time-boxed window on a staging target. The app's own record, not Sunrise's approval queue. Unlocks write methods in the access checks.  |
| depth | `f-authenticated-crawl` · Signed-in crawl   | `f-test-identities`, `f-approval-gate` | A browser-driven crawl as each test identity.                                                                                                                             |
| depth | `f-api-fuzzing` · API fuzzing               | `f-route-inventory`, `f-approval-gate` | Schema-seeded fuzzing from the route inventory, staging only.                                                                                                             |
| depth | `f-auth-flow-checks` · Sign-in flow checks  | `f-test-identities`, `f-approval-gate` | Checks written for better-auth's sign-in, reset and session flows.                                                                                                        |

The first five edge features are useful on our own apps and wait only on phase one, so
they are the natural picks whenever someone is free between milestones.

**Parked:** phase `breadth` (attack-surface discovery, cloud posture, infrastructure,
supply chain). It is worth less to our apps than the depth phase.
