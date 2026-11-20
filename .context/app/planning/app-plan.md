# ThreatWorker — app plan

Written 2026-11-18, re-cut 2026-11-20 to the Hub's shapes after a fit review against
Sunrise. Three files make up the plan, kept at `.context/app/planning/` in the fork:

1. **`app-plan.md`** (this file): the evaluation, what makes it worth building, what
   comes first, phases and milestones, ground rules, decisions, risks and how to load it
   into the Hub.
2. **[`spec.md`](./spec.md)**: the binding design. Philosophy, what Sunrise supplies, the
   tools we start with and add later, OWASP Top 10 coverage, scan profiles, the route
   inventory and access checks, the finding record, data model and API, the runner
   contract, the canary, the quick check, reports, the Shipshape badge, history, the
   commercial model, safety controls, programme rules, licences.
3. **[`feature-blocks.md`](./feature-blocks.md)**: one block per feature with the fields
   the Hub takes. Each block's **Spec** line names the `spec.md` sections it builds.

ThreatWorker is a commercial security-testing service built as a Sunrise leaf fork.
Owners who prove they control an app get continuous scanning, access-control testing
generated from the app's own routes, a full report, and fixes tracked to done. Anyone can
give it a URL for a read-only quick check and a short report. We run it on our own apps
first (milestones 1 to 5), then open it to customers (milestones 6 to 8). The first
milestone is a route map of our own apps that needs no scanner at all, so there is
something to open and use within three features.

## The proposal, evaluated

The proposal is sound on what to build and slow on order: nine phases in sequence put
the most valuable check fifth and leave nothing usable until the infrastructure is
built. Its architecture holds: a Sunrise control plane, scanners run as off-the-shelf
tools outside the web process, one normalised finding record, and the Hub reached as a
client. Six changes:

| #   | Proposal says                                       | This plan                                                                                                    | Why                                                                                                                                                                    |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Access-control testing in Phase 5                   | The route map in milestone 1; access checks in milestone 4                                                   | Highest-value check, the one commercial scanners miss. Sunrise declares each route's guard, tier and ownership rule, so unguarded routes show before any scanner runs. |
| E2  | Build a sandboxed worker tier in Phases 0–3         | GitHub-hosted Actions runners first for our own apps; own workers (`f-worker-tier`) before any customer scan | Removes the biggest piece of new infrastructure from the first phase. Ephemeral VMs we do not operate.                                                                 |
| E3  | Scope, ownership proof and approval gate in Phase 3 | Scope and ownership proof ship with the first scan; the approval gate ships with the first active check      | Nothing should be scannable by accident from day one. The first two phases are read-only, so the gate is not needed until active checks exist.                         |
| E4  | Run Semgrep, Gitleaks and Trivy on each repo        | Ingest the CodeQL, secret-scanning and Dependabot alerts each fork's CI already produces                     | Sunrise CI already runs these. Re-running doubles the noise; ingesting gives one view.                                                                                 |
| E5  | Tickets by hand in Phase 1, automated in Phase 2    | One click files to the Hub in milestone 5, on the feature a person picks                                     | The Hub files a bug on the feature that caused it (`triage.q3`); a scanner cannot know that feature.                                                                   |
| E6  | Canary app and AI triage late                       | Canary in milestone 3, before any report is trusted; AI triage after fingerprinting                          | A scanner that silently stops working looks like a clean app. AI triage only helps once repeats stop arriving as new findings.                                         |

Unchanged: the tool choices, the safety section and the build-or-buy conclusion (build
only what knows Sunrise, reuse the rest). One proposal decision is reversed: the
commercial phase is no longer parked (D2).

## Checked against Sunrise

The plan was checked against Sunrise `main` at `50fc085b9` on 2026-11-20. ThreatWorker is
feasible as a leaf fork. Sunrise supplies the control plane (tenancy, sign-up, secrets,
storage, jobs, privacy), not the scan pipeline. What the check changed:

- Access checks for apps that are not Sunrise forks moved up to ship before onboarding,
  so an outside customer's first report is more than the commodity scans.
- Unguarded routes are reported straight from the route inventory. The signed-out
  request can only confirm what the inventory already shows.
- The inventory records each route's tier, ownership rule, required switch and key
  scope, so the expected answer per identity comes from the route's own declaration.
- There is no viewer role. Sunrise's org roles are a closed set of three.
- The approval gate, the audit history and billing are the app's own. Sunrise's approval
  queue, audit log and (absent) billing cannot carry them.
- A scan run is not a Sunrise workflow. The orchestration layer is used for AI triage and
  the MCP tools.

The detail is in `spec.md` › What Sunrise supplies.

## Making it worth building

ThreatWorker is worth building if it matches what customers expect from a commercial
scanner by milestone 8, then wins on things those products structurally cannot do. It
should not try to win on scan-engine depth or threat research; it reuses the best
open-source engines for that.

**Parity: what buyers expect, and where the plan delivers it.**

| Buyers expect                                                  | Typical products                             | ThreatWorker                                                     | Milestone                              |
| -------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Scan a live app for misconfiguration, headers, TLS, known CVEs | Detectify, Intruder, StackHawk               | ZAP baseline, Nuclei, testssl.sh                                 | 2                                      |
| A report to share with a manager, client or auditor            | All of them                                  | HTML and PDF report with coverage and fix guidance               | 3                                      |
| Access-control testing (IDOR, BOLA)                            | Escape, StackHawk (partial)                  | Generated from the app's declared routes and guards              | 1 (unguarded routes), 4 (across users) |
| Code, dependency and secret scanning                           | Snyk, GitHub Advanced Security, Aikido       | Import GitHub's alerts; own rules later                          | 5                                      |
| Scheduled scans and re-tests                                   | All of them                                  | Schedules; fixes verified and regressions reopened               | 5                                      |
| An auditable, searchable history                               | Most of them                                 | Every scan, finding, state change and recommendation, exportable | 5                                      |
| A first look from a URL                                        | Mozilla Observatory, SSL Labs, vendor trials | Quick check (access terms: D7)                                   | 6                                      |
| Self-serve sign-up and teams                                   | All SaaS                                     | Sunrise orgs, ownership verification, onboarding                 | 7                                      |
| Something to show their own customers                          | Trust badges and trust pages                 | The Shipshape badge and its public verification page             | 7                                      |
| Tickets in the team's tracker                                  | Jira, GitHub, Slack integrations             | Hub first, then GitHub Issues, Jira, Slack                       | 5 (Hub), 8                             |
| Plans and billing                                              | All SaaS                                     | Plans enforced where a scan is dispatched                        | 8                                      |
| Authenticated crawl, API fuzzing, auth-flow tests              | Burp Enterprise, StackHawk, Escape           | Depth phase                                                      | Later                                  |
| Attack-surface and cloud posture                               | Detectify, Intruder, Wiz                     | Breadth phase                                                    | Parked                                 |

**More: what off-the-shelf products cannot easily do.**

1. **Access tests from the app's own declaration, not a crawl.** A crawler tests what it
   finds. ThreatWorker reads every route and what it declares (Sunrise apps from the
   repo; other Next.js apps through a small route-manifest package; any API through an
   OpenAPI import) and tests every route as every identity. That is the class of bug
   behind most real breaches (OWASP A01), tested completely rather than by sample.
2. **Reports that say what was not tested.** Each report lists what was checked, what
   could not be reached, and whether the canary was caught in the same run. "We found
   nothing" and "we could not look" are never the same line. Most vendor reports leave
   this out.
3. **Fixes as pull requests.** For findings whose fix is known for the stack (a missing
   guard, a header in `next.config`, a cookie flag, a dependency bump), ThreatWorker
   opens a PR in the customer's repo rather than a ticket.
4. **Every finding becomes a regression test.** A confirmed access finding exports as a
   test in the customer's own suite, so the bug cannot come back even if they stop
   paying.
5. **Scan before merge.** Each pull request's preview deployment gets the passive and
   access checks, with results as a PR comment, before the code reaches production.
6. **Built for AI-assisted development.** An MCP server lets Claude Code and other
   agents list findings, read evidence and fix them in the editor.
7. **Closed loop with proof.** A ticket closes when the code merges; the finding
   resolves only when a re-scan agrees, and reopens if it returns.
8. **Your data, your choice.** An option to decide (D7): a self-hosted edition would keep
   the map of a customer's weaknesses inside their own infrastructure.

**Who it is for.** Teams on Sunrise and Next.js first. The Shipshape badge also aims it
at people who built their own product and are taking it to market, beside ConQuest for
lead generation and HowDoesThisLand for marketing copy: ThreatWorker is the name the
person running scans sees, and Shipshape is what their customers see.

**Where we deliberately do not compete:** proprietary scan engines, a vulnerability
research team, compliance attestation, and human penetration testing. We integrate or
partner for those, and our reports are written to be a tester's starting map.

**Pricing:** not decided. Plans, prices, whether any part is free and whether to offer a
self-hosted edition are open (D7).

## What we build first

The checks are ranked by value for effort, using the proposal's coverage table and the
fit review.

| Rank | Check or capability                                                            | Value                                                                                  | Effort                                                                            | Milestone   |
| ---- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------- |
| 1    | The route map: every route and what it declares, with unguarded routes flagged | High: a missing guard is the most damaging Sunrise bug class, and this needs no runner | Low: the route list comes from the repo                                           | 1           |
| 2    | Passive web baseline: headers, cookies, CSP, TLS, known misconfigurations      | Medium–high, safe on production                                                        | Low: official tool images                                                         | 2           |
| 3    | The report: summary, coverage, findings, fix guidance, the canary result       | What a customer actually buys                                                          | Medium                                                                            | 3           |
| 4    | Every route called as another user, per tier and org                           | Highest single check                                                                   | Medium: seeded test accounts, and route parameters mapped to seeded rows          | 4           |
| 5    | Schedules, Hub filing, fixes re-checked, code alerts, history                  | Turns findings into fixes                                                              | Medium                                                                            | 5           |
| 6    | Quick check of any URL                                                         | Shows what ThreatWorker finds before anyone verifies a site                            | Medium: one page load and a TLS handshake, with abuse controls built from nothing | 6           |
| 7    | Own workers, terms, routes for any app, onboarding, the badge                  | Others can use it                                                                      | High                                                                              | 7           |
| 8    | Plans and integrations                                                         | Others can pay for it                                                                  | High                                                                              | 8           |
| 9    | Fix PRs, regression tests, preview scans, MCP tools                            | The reasons to choose us                                                               | Medium each                                                                       | Edge phase  |
| 10   | Authenticated crawl, API fuzzing, auth-flow checks                             | High, but active and noisy                                                             | High                                                                              | Depth phase |

The signed-out request ranks below the cross-user check: a guarded route refuses before
its handler runs, so the request only confirms that the deployed build matches the repo.

## Phases

Five phases: two planned in full, one active as summaries, one upcoming and one parked.
A phase is a whole effort, not an order. Order comes from feature dependencies
(`model.dependencies`).

| Phase                           | Status   | What it is                                                                                                                                                                 | Holds                          |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `own-apps` · Our own apps       | Active   | ThreatWorker as a tool we run on Sunrise and its forks: map, scan, report, access checks, fixes tracked to done                                                            | 15 features, milestones 1 to 5 |
| `open-door` · Open to customers | Active   | Everything a stranger needs: the public quick check, sign-up to first report, our own workers, terms, the badge, plans, their trackers                                     | 8 features, milestones 6 to 8  |
| `edge` · Reasons to choose us   | Active   | The differentiators, each startable when its dependency ships: MCP tools, AI triage, fix pull requests, regression tests, preview scans, our own rules, compliance mapping | 7 features, summaries only     |
| `depth` · Deeper checks         | Upcoming | Active checks behind an approval gate: write-method access checks, signed-in crawl, API fuzzing, auth-flow checks                                                          | 4 features, summaries only     |
| `breadth` · Wider surface       | Parked   | Attack-surface discovery, cloud posture, infrastructure, supply chain. Parked because it is worth less to our apps than the depth phase                                    | Not planned                    |

Tenancy stays on from the first model (D2). What moves to the second phase is the
selling machinery, not the isolation.

The Hub creates the standing features itself: Upstream for taking Sunrise releases, and
Housekeeping for CI and tooling. Image-pin updates and the divergence ledger belong
there, not in a phase.

## Milestones

Eight demo points. Numbers are names, not an order; milestones overlap and none gates
work. After the report, three things can proceed side by side: access checks, the fix
loop and the public quick check. Titles are plain labels of what each holds.

### Phase own-apps

**1 · Route map.** Three features: App frame, Targets, Route inventory.

- Sign in, add one of our apps with its repo, and see every API route it has, with who
  may call each one.
- See the routes that have no guard and are not on the app's public list, flagged at the
  top.
- Sign in as a member of a second org and see none of it.
- Stand-in: flagged routes show on the map only. They become findings in milestone 2.

**2 · Passive scans and findings.** Four features: Scan scope, Scan runs, Findings,
Passive baseline.

- Add a staging host, see it refused for scanning until we prove we own it, then prove
  it.
- Start a passive scan and watch it run to completion.
- Read the findings, one per issue, with evidence and the tool that found it.
- Run it again and see the same list, each finding now seen twice.
- Stand-in: findings are read in the app. The report arrives in milestone 3.

**3 · Reports and the canary.** Two features: Canary, Reports.

- Open the report for a run as a page and as a PDF: grade, what was tested and what was
  not, findings with fixes.
- See in the same report that the scanner caught every planted bug in the canary app.
- Remove one planted bug's finding and see the run fail, naming it.
- Send someone an expiring link to the report, then revoke it.
- Stand-in: findings reach the Hub by copying them out of the report, until milestone 5.

**4 · Access checks.** Two features: Test identities, Access checks.

- Seed test accounts into a staging app: a platform admin, and an owner, admin and
  member in each of two orgs.
- See every route called as each of them, and every place one could read what belongs to
  another, in the report.
- See the canary's planted cross-user and cross-org reads caught, and nothing else
  reported there.

**5 · Schedules and tracked fixes.** Four features: Schedules, Tracked fixes, Code
alerts, History.

- Scans run nightly and the report arrives without anyone asking.
- File a finding to the Hub on the feature we choose, with no secret in its text.
- Fix a finding and see it resolve on the next run; bring it back and see its Hub task
  reopen.
- See CI's code, secret and dependency alerts beside scan findings.
- Open any finding's timeline: who did what, when and why. Export the record for a date
  range.

### Phase open-door

**6 · Quick check.** One feature: Quick check. Needs D7's answer on whether it is free.

- Paste any URL on the public site and get a grade with up to ten plain-English fixes.
- Paste an internal address and see it refused.
- Follow the next step from the grade into proving ownership.

**7 · Customer onboarding.** Five features: Scan workers, Scan terms, Routes for any
app, Onboarding, Shipshape badge. Needs the legal review in D9.

- A new person signs up from a quick-check grade, gets their own org, connects a repo or
  uploads a route file, proves their domain and accepts the terms for it.
- Their first full report arrives with no help from us. The cross-user check joins once
  they have seeded test accounts.
- Their scan ran on our own workers, which cannot reach any host off their list.
- They put the Shipshape badge on their own site. It links to a public page saying what
  was tested, when, and what was not covered, and it shows "not current" by itself once
  a serious finding opens or the last run is over 30 days old.

**8 · Plans and integrations.** Two features: Plans, Integrations. Needs D7 in full.

- Choose a plan and pay; a scan the plan excludes is refused, and upgrading unlocks it.
- A finding filed to GitHub Issues closes when its fix is proven; Jira and Slack work the
  same way.
- ThreatWorker's own production passes its own full scan. This is a Housekeeping task
  committed to this phase, waiting on both features.

## Ground rules

- **Owners only, for full scans.** A target is scannable only once its ownership is
  verified and its hosts are on its allowlist. The dispatcher refuses anything else, and
  the job re-checks before running.
- **The quick check is the only unverified input**, and it is limited to what one
  browser visit sees: one page load, its headers and cookies, and a TLS handshake. No
  spidering, no templates, no access checks. Private and internal addresses are refused,
  and checks are rate-limited per visitor and per domain.
- **Authority recorded.** Every customer accepts terms stating they own or are
  authorised to test each target, and that acceptance is stored with the target.
- **Passive until approved.** Phases `own-apps` and `open-door` run read-only checks
  only. Any check that submits data waits for `f-approval-gate` and runs against staging
  only.
- **Test accounts, never real people.** Authenticated checks sign in as seeded test
  accounts against seeded staging data.
- **No scanner code in the web process.** Tools run as their official, digest-pinned
  images on a runner. Our own apps may use GitHub-hosted runners; customer targets run
  only on our own workers.
- **A scan run is not a Sunrise workflow.** The run's state, callback and token are the
  app's own. The orchestration layer is for AI triage and the MCP tools.
- **Findings are sensitive.** Org-scoped reads, evidence sealed at rest, secrets
  redacted before anything leaves ThreatWorker, reports shared only by expiring links.
  Sunrise's own findings never go to a public GitHub issue.
- **Every change is recorded** in the app's own append-only history, in the same
  transaction as the change: who, against what, with which profile.
- **Members read; admins and owners act.** There is no viewer role.
- **API first.** Every capability is a route under `app/api/v1/` before it is a page.
- **Tenancy on from the first model** (D2): `TENANCY_MODE=multi`, one org per customer,
  every app model with `orgId` and its isolation policy, and a test that one org cannot
  see another's rows.
- **The model steps** for each new model: `orgId` and its policy SQL in the migration;
  `onDelete` on any `User` FK (`SetNull` for audit columns such as `triggeredById`);
  subject-export, org-export and erasure registration; migration SQL reviewed;
  `db:tenancy:enable` re-run.
- **Extend through the seams** (`sunrise.golden-rule`). Own modules declared in
  `lib/app/own-modules.ts`; each seam filled re-pins its `defaults.test.ts` row; any edit
  to a Sunrise-owned file gets a divergence-ledger row in the same PR.
- **Gates before every PR**, in the order of `CLAUDE.md`; written once here, not in every
  task row.
- **Plain English copy**, in reports most of all, and a `<FieldHelp>` on every
  non-trivial form field.

## Decisions

| #   | Question                               | Answer                                                                                                                                                                                              | Status                           | Needed before                     |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------- |
| D1  | Separate fork or inside the Hub?       | Separate Sunrise leaf fork                                                                                                                                                                          | Decided: repo created 2026-11-20 | —                                 |
| D2  | Commercial from day one?               | Yes: tenancy on from the first model; our own apps first, then customers                                                                                                                            | Decided 2026-11-18               | —                                 |
| D3  | Worker runtime?                        | GitHub-hosted runners for our own apps; own isolated workers for every customer target. Which runtime: containers on our own host, Fly Machines or a cloud jobs service                             | Open                             | `f-worker-tier`                   |
| D4  | First targets?                         | Staging of Sunrise and one fork; production passive only. Which fork is open                                                                                                                        | To confirm                       | `f-scan-scope` ships              |
| D5  | Tickets to GitHub, the Hub or both?    | Hub for us; GitHub Issues, Jira and Slack for customers                                                                                                                                             | Assumed                          | —                                 |
| D6  | Name                                   | ThreatWorker for the product; Shipshape as the working name of the badge                                                                                                                            | Decided 2026-11-20               | —                                 |
| D7  | Pricing and billing                    | Not decided: whether the quick check is free, first; then the pricing model, plans, prices and whether to offer a self-hosted edition                                                               | Open                             | `f-quick-check`, then `f-billing` |
| D8  | How non-Sunrise apps get access checks | An OpenAPI import and a route-manifest package for Next.js, both in milestone 7                                                                                                                     | Assumed                          | —                                 |
| D9  | Legal readiness                        | Terms, authority record and liability cover reviewed by a lawyer                                                                                                                                    | Open                             | Milestone 7 opens sign-up         |
| D10 | Retention                              | Not decided: how long scan history, findings, evidence and audit events are kept, and whether customers can choose                                                                                  | Open                             | `f-history` is planned            |
| D11 | Shipshape badge criteria               | Not decided: how fresh a run must be, which severities block it, whether a badge can be held without access checks, and the badge's name and domain. Starting values in `spec.md` › Shipshape badge | Open                             | `f-badge` is planned              |
| D12 | A viewer role?                         | No. Members read; admins and owners act                                                                                                                                                             | Recommended, to confirm          | `f-app-frame`                     |
| D13 | Repo access                            | A GitHub App (what customers will need in milestone 7) or a per-target token (quicker now)                                                                                                          | Open                             | `f-targets`                       |
| D14 | Billing: ours or Sunrise's             | Build in the fork, or wait for Sunrise's own billing proposal, which has no rulings yet                                                                                                             | Open                             | `f-billing`                       |

Hypotheses are written on the feature that settles them, in
[`feature-blocks.md`](./feature-blocks.md), and gathered in `spec.md` › Build or buy,
licences, and what to confirm.

## Risks

| #   | Risk                                                                                         | Mitigation                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | On GitHub-hosted runners, scope is enforced in software, not by the network                  | Only our own targets and read-only checks there; customer targets wait for `f-worker-tier`                                                                                                           |
| R2  | Static reading misses routes                                                                 | The unclassified count in `f-route-inventory`'s first PR decides; unknown routes are listed, never silently passed                                                                                   |
| R3  | Noise buries the findings                                                                    | Fingerprinting, a false-positive state, coverage stated in every report, AI triage later                                                                                                             |
| R4  | A read-only request triggers a side effect on a badly built `GET`                            | Staging only for access checks, seeded data, rate caps; the side effect is itself a finding                                                                                                          |
| R5  | Findings or reports leak                                                                     | Org isolation, sealed evidence, redaction, expiring report links                                                                                                                                     |
| R6  | The quick check is abused to probe others' sites or our own network                          | One page load only, private addresses refused at resolve and at connect, rate limits per visitor and domain, a bot challenge, logged                                                                 |
| R7  | A customer scans a site they do not own, or a scan causes an outage                          | Ownership proof, recorded authority, passive by default, throttling, terms and liability cover (D9)                                                                                                  |
| R8  | Funded competitors outspend us on breadth                                                    | Compete on the eight differentiators, not on engine depth; Sunrise and Next.js teams first                                                                                                           |
| R9  | Commercial use breaks a tool's licence                                                       | Licence table cleared in `f-scan-terms` before milestone 7                                                                                                                                           |
| R10 | The repo is public while it starts, and Actions logs on a public repo are readable by anyone | Make the repo private before `f-runner` ships: scan output from our staging apps would otherwise be in public logs. The canary's list of planted bugs and these planning files are public until then |
| R11 | A badge is read as "this site is secure"                                                     | The badge and its page never say secure or safe, name what was not covered, and lapse by themselves (`spec.md` › Shipshape badge)                                                                    |

## Loading this into the Hub

Run from a session in the fork's checkout, never from Sunrise's.

1. **Planning files.** Done: these three files are committed at `.context/app/planning/`.
2. **Repo and project.** The repo exists (`human-centric-engineering/threatworker`, from
   Sunrise `v0.19.0`, with Sunrise as the `upstream` remote). Create the Hub project with
   Sunrise as its upstream. Add `.mcp.json` with the project key. Save the block from
   `get_project_bootstrap` as `CLAUDE.local.md`; it should point at
   `hub://process/sunrise-fork`.
3. **Phases.** `create_phase` for `own-apps`, `open-door` and `edge` as active, `depth`
   as upcoming, and `breadth` as parked with its reason.
4. **Milestones.** `create_milestone` for the eight, each with its name, a summary of
   what it contains, and the demo lines above. Put D7 and D9 in the needs of milestones
   6 to 8.
5. **Features, in dependency order** (`feature-blocks.md`, top to bottom).
   `create_feature` with phase, milestone, slug, title, summary, description, done-when,
   references (this plan, then each `spec.md` section named), dependencies and
   indicative tasks. Later-phase features are created with their summary and
   dependencies only.
6. **The one better-first link.** `add_better_first` for History before Tracked fixes,
   with its reason.
7. **Decisions.** `record_decision` for those already settled: D1, D2 and D6 on
   `f-app-frame`, plus each other row as it is ruled, on the feature it gates.
8. **Sweep.** `create_sweep` for the model steps.
9. **Stop there.** Real tasks wait for a claim. The first claim is `f-app-frame`; its
   owner reads the spec sections, reconciles the indicative tasks against the tree
   (`fp1`), and calls `plan_feature`.

The field names in steps 3 to 5 are from the process text. Read each tool's own
description at load time, and read each created record back.
