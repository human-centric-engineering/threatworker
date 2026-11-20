# ThreatWorker — spec

The binding design for ThreatWorker's first phase and the shape of what follows. It
brings the proposal's research into one place: which tools, how they run, what they
cover against OWASP, and the records and routes the app is built from. Tool versions and
image names are as of the proposal (mid-2026) and are confirmed at each feature's
reconcile.

**How the plan uses this file.** Every feature in the plan has a **Spec** line naming the
sections here that it builds. This file is the spec the Hub points at (`model.spec`):
tasks link to it and never copy it, so a design change is made once, here. Plan:
[`app-plan.md`](./app-plan.md).

**Milestones and features.** Milestone numbers and feature ids are the Hub plan's. Our own
apps: 1 Route map · 2 Passive scans and findings · 3 Reports and the canary · 4 Access
checks · 5 Schedules and tracked fixes. Open to customers: 6 Quick check · 7 Customer
onboarding · 8 Plans and integrations.

**Checked against Sunrise.** The design was checked against Sunrise `main` at `50fc085b9`
on 2026-11-20. What that found is under What Sunrise supplies.

**Sections:** Philosophy · What Sunrise supplies · Toolbox for our own apps · Toolbox
later · OWASP Top 10 coverage · Scan profiles · Route inventory and access checks · The
finding record · Data model and API surface · Runner contract · Canary · Quick check ·
Reports · Shipshape badge · History and audit · Commercial model · Safety controls ·
Running it as a programme · Build or buy, licences, and what to confirm

## Philosophy

ThreatWorker is an orchestrator and a memory, not a scanner. Its value is choosing the
right proven tools, running them safely against apps their owners have verified,
remembering every finding, and proving each fix. Eight principles decide the design:

1. **Orchestrate, never re-implement.** Every generic check comes from a maintained
   open-source tool run as its official image. ThreatWorker writes only what no tool
   can: checks that use Sunrise's own knowledge of its routes, guards, tiers and orgs. If
   it starts growing its own scan engine, it has lost the plot.
2. **Stack-aware beats generic.** A commercial scanner has to discover routes by
   crawling and guess who should see what. Sunrise declares both. The access checks
   built from that declaration are the product's reason to exist, so they come first.
3. **Passive first, active by approval.** A read-only check is safe enough to run
   anytime against staging, and against production if a target allows it. Anything that
   submits data needs an approved window, a staging target and test accounts.
4. **Owners only, proven per host.** Scope is an allowlist of hosts with ownership proven
   by DNS or a well-known file. There is no free-text target for a full scan.
5. **One record per finding.** Tools overlap and repeat. A finding is fingerprinted once
   and every later sighting attaches to it, so the list shrinks as fixes land instead of
   growing every run.
6. **Prove the scanner, not just the app.** A canary app with planted bugs runs in every
   scan. A clean result only means something when the canary was caught.
7. **A fix is not done until a re-scan says so.** The ticket closes when the code merges;
   the finding resolves only when the next run no longer sees it.
8. **Automated scanning is not a penetration test.** It finds known, scannable classes
   continuously. Logic flaws, chained exploits and design weaknesses still need human
   testers, and ThreatWorker feeds them rather than replaces them.

## What Sunrise supplies

ThreatWorker is a leaf fork of Sunrise. Sunrise supplies the control plane: tenancy,
sign-up, secrets, storage, jobs and privacy. It does not supply the scan pipeline, which
is the app's own models, routes and runner.

| Need              | What Sunrise holds                                                                                                                                                 | What ThreatWorker builds                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Org isolation     | `TENANCY_MODE=multi`, the `org_isolation` policy, and a test that fails until each new model has its policy                                                        | The policy SQL, added by hand in each model's migration; a cross-org test helper, since none exists to reuse (`f-targets`)                     |
| Roles             | A closed set of `OWNER`, `ADMIN` and `MEMBER`; the policy has read and administer checks and no write check                                                        | No fourth role. Members read; admins and owners act                                                                                            |
| Sign-up           | An uninvited sign-up gets its own org, and a welcome step (`lib/app/welcome.ts`) holds a new owner until onboarding is done                                        | The onboarding wizard only                                                                                                                     |
| Secrets at rest   | `sealSecret` and `openSecret`, with `registerSealedStore` so key rotation covers app tables                                                                        | Sealed columns for evidence and for test-identity, repo and integration credentials                                                            |
| File storage      | Org-scoped keys, private objects and signed links; org erasure deletes them; org export leaves files out                                                           | Tool output, report snapshots and PDFs stored per org                                                                                          |
| Jobs              | `registerAppJob` (`lib/app/jobs.ts`) on the maintenance tick: minute granularity, an external cron to drive it, last-run times held in process memory              | Schedules as an app job that reads its own `nextRunAt` column. Sunrise's own schedules start workflows only                                    |
| Outbound safety   | `checkSafeProviderUrl` and `createSafeDispatcher`: an address check, and a DNS check at connect time that closes rebinding                                         | The quick check calls `createSafeDispatcher` itself. `outboundDispatcher()` gives no protection in the system scope an anonymous check runs in |
| Plan limits       | Entitlements: boolean switches, and meters (`registerMeter`, `checkMeterQuota`)                                                                                    | Switches for profiles and integrations; meters for targets and scans per month; how often a schedule may run is the app's own setting          |
| Billing           | Nothing                                                                                                                                                            | All of `f-billing`                                                                                                                             |
| Bot challenge     | Nothing integrated; a CSP seam that would admit one                                                                                                                | The challenge on the quick check                                                                                                               |
| PDF               | No library                                                                                                                                                         | PDFs rendered in the runner container                                                                                                          |
| Audit record      | An audit log written fire-and-forget, pruned by retention and not append-only; database grants cover every table and are re-granted each time the role script runs | Its own `AuditEvent` table, held append-only by a trigger                                                                                      |
| Privacy           | Manifests for subject export, org export and erasure; tests fail until each model is listed                                                                        | Every app model registered in each                                                                                                             |
| Inherited surface | About 225 admin routes, plus chat, embed and inbound                                                                                                               | `f-app-frame` closes the sections customers will not use, so ThreatWorker's own production can pass its own scan                               |

**Orchestration.** A scan run is not a Sunrise workflow. A run dispatches a job, waits up
to 45 minutes and takes a callback, and the engine cannot do that: it has no wait step
and no step that resumes on a callback, it fails a run left idle for 30 minutes, inbound
triggers can only start a run, and a fork cannot add step types. The `ScanRun` state
machine, callback route and per-run token under Runner contract are the design.

The orchestration layer is used in two later features:

- **AI triage (`f-ai-triage`).** One agent per customer org, registered as a platform
  agent for every org. Bulk triage is an app job that makes one structured call per
  finding, because no step maps over a list; the agent serves "ask about this finding".
  The agent's privacy mode is `redact`, so key-shaped secrets are stripped from evidence
  before any external model call. It holds no write tools, because scan evidence is text
  the target controls.
- **MCP tools (`f-mcp-server`).** Built on Sunrise's MCP server, where a tool is an agent
  capability. The table that exposes a tool has no org column, so that one org's key
  cannot reach another org's findings is tested before it ships.

## Toolbox for our own apps

The first phase uses three off-the-shelf scanners, three GitHub alert feeds the forks
already produce, and our own route map with the two checks built from it. All the
third-party tools are open source; none is an npm package, so each runs as its own
container on the runner.

| Tool                    | Class                 | What it checks for us                                                                                                                      | Mode in the first phase                                                                                               | Image                     | Output ThreatWorker parses      | Licence                             | Feature             |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------- | ----------------------------------- | ------------------- |
| OWASP ZAP baseline      | DAST, passive         | Spiders the app and applies passive rules only: missing or weak security headers, CSP gaps, cookie flags, information leaks, mixed content | Passive scan only, no active rules; time-boxed spider                                                                 | `zaproxy/zap-stable`      | JSON report                     | Apache-2.0                          | `f-baseline-scans`  |
| Nuclei                  | DAST, templated       | Known CVEs in the detected stack, misconfigurations, exposed panels and files                                                              | Community templates filtered to non-intrusive tags; intrusive, fuzzing and DoS-tagged templates excluded; rate-capped | `projectdiscovery/nuclei` | JSONL                           | MIT                                 | `f-baseline-scans`  |
| testssl.sh              | TLS posture           | Certificate validity and expiry, protocol versions, cipher suites, HSTS                                                                    | Read-only handshake checks per allowlisted host                                                                       | `drwetter/testssl.sh`     | JSON file                       | GPL-2.0 (run as a separate process) | `f-baseline-scans`  |
| CodeQL alerts           | SAST                  | Insecure code patterns in the fork's source                                                                                                | Read from GitHub; the fork's CI already runs CodeQL                                                                   | — (GitHub API)            | Code-scanning alerts REST API   | GitHub terms                        | `f-code-alerts`     |
| Secret-scanning alerts  | Secrets               | Committed keys and tokens                                                                                                                  | Read from GitHub                                                                                                      | — (GitHub API)            | Secret-scanning alerts REST API | GitHub terms                        | `f-code-alerts`     |
| Dependabot alerts       | SCA                   | Vulnerable npm dependencies                                                                                                                | Read from GitHub                                                                                                      | — (GitHub API)            | Dependabot alerts REST API      | GitHub terms                        | `f-code-alerts`     |
| Route map               | Access control (ours) | A route with no guard that is on neither of the target's lists (public, self-authenticating)                                               | Reads the repo at the deployed commit; sends no request                                                               | ThreatWorker job          | Native JSON                     | Ours                                | `f-route-inventory` |
| Signed-out access check | Access control (ours) | Confirms on the deployed build that each guarded route refuses a caller with no session                                                    | `GET` only, path ids from seeded data                                                                                 | ThreatWorker job          | Native JSON                     | Ours                                | `f-access-checks`   |
| Cross-user access check | Access control (ours) | One user, tier or org reading another's data, judged against what each route declares                                                      | `GET` only, test identities                                                                                           | ThreatWorker job          | Native JSON                     | Ours                                | `f-access-checks`   |

**Why these three scanners first.** They cover most of OWASP A05 (misconfiguration) and
part of A02, A06 and A07 without sending anything that changes data, so they are safe
from the first run. Each is the open-source leader in its class, with an official image
and machine-readable output.

**Why not Semgrep, Gitleaks and Trivy yet.** The proposal listed them, but every Sunrise
fork's CI already runs CodeQL, secret scanning, `npm audit` and dependency review.
Reading those alerts gives the same coverage with no second source of noise. Trivy
returns in the breadth phase for container images and IaC, which CI does not cover; our
own Sunrise rules arrive in `f-sunrise-rules`.

**Known limit of the baseline.** Sunrise apps are Next.js single-page apps, so a
signed-out spider sees mostly public pages. The signed-in surface is covered first by
the route-based access checks, which do not need to crawl, and later by
`f-authenticated-crawl`.

## Toolbox later

The proposal's depth tier, placed by phase. Every one runs behind the same driver
contract, so adding a tool never changes the harness. Anything active waits for
`f-approval-gate`.

| Capability                 | Built from                                                                                                              | What it adds                                                                                                                                       | Phase · feature                             | Needs first                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| Routes for any app         | An OpenAPI file with the expected access per route, or a small package that publishes a Next.js app's routes and guards | The access checks for apps that are not Sunrise forks. Without it an outside customer gets the commodity scans only, so it ships before onboarding | open-door, milestone 7 · `f-any-app-routes` | Access checks                         |
| Write-method access checks | ThreatWorker (extends `f-access-checks`)                                                                                | `POST`/`PATCH`/`DELETE` across users, tiers and orgs (IDOR, BOLA, BFLA on writes)                                                                  | depth · `f-approval-gate`                   | Approval gate, staging target         |
| Authenticated crawl        | ZAP AJAX spider driven with a test identity's session                                                                   | Passive rules over the signed-in surface                                                                                                           | depth · `f-authenticated-crawl`             | Test identities                       |
| API fuzzing                | Schemathesis (MIT), seeded from the route inventory's Zod schemas                                                       | Mass assignment, excessive data exposure, per-parameter input handling                                                                             | depth · `f-api-fuzzing`                     | Approval gate; route schemas exported |
| Auth-flow checks           | ZAP auth scripts plus our checks for better-auth                                                                        | Session fixation, logout and expiry, MFA bypass, OAuth state and redirects, password reset                                                         | depth · `f-auth-flow-checks`                | Test identities, approval gate        |
| Sunrise rule pack          | Opengrep or Semgrep CLI with our own rules (not the Semgrep registry)                                                   | Missing guard, `as` on external data, `User` FK without `onDelete`, direct `prisma.user.delete()`, route missing from the rate-limit policy        | edge · `f-sunrise-rules`                    | Code alerts ingest                    |
| Client-side checks         | Retire.js, a CSP evaluator                                                                                              | Vulnerable JS libraries in the bundle, CSP weaknesses, leaked `NEXT_PUBLIC_` secrets                                                               | depth · (new feature at planning)           | —                                     |
| Own worker tier            | Containers on a host we run, egress locked to the allowlist                                                             | Network-level scope enforcement, longer runs; required for every customer target, so it ships before onboarding                                    | open-door, milestone 7 · `f-worker-tier`    | Runner contract                       |
| Attack-surface discovery   | subfinder, httpx, ffuf, limited to verified domains                                                                     | Forgotten subdomains, stray files and endpoints                                                                                                    | breadth (parked)                            | Worker tier                           |
| Cloud and IaC posture      | Prowler, Checkov (Apache-2.0); ScoutSuite (GPL-2.0)                                                                     | IAM, public buckets, security groups, IaC misconfig                                                                                                | breadth (parked)                            | Cloud read-only credentials           |
| Infra and network          | nmap (NPSL; OEM licence if sold)                                                                                        | Open ports, service versions                                                                                                                       | breadth (parked)                            | Worker tier                           |
| Supply chain and CI/CD     | Syft (SBOM), OSV-Scanner, zizmor, Trivy image scan                                                                      | SBOM, reachability, Actions hardening, container CVEs                                                                                              | breadth (parked)                            | —                                     |
| Secret validation          | TruffleHog (AGPL-3.0, separate process)                                                                                 | Confirms whether a leaked key is live                                                                                                              | breadth (parked)                            | Secret alerts                         |
| Commercial engines         | Burp Suite Enterprise, Nessus (customer's own licence)                                                                  | Deeper DAST, host CVEs                                                                                                                             | not planned                                 | Driver contract                       |

## OWASP Top 10 coverage

By the end of milestone 4, ThreatWorker covers misconfiguration well and broken access
control on read paths well. Insecure design and logging failures stay human work at every
stage. The mapping uses the 2021 list, as the proposal did; OWASP has since published a
2025 edition, so remap the categories when `f-findings` adds the `owaspCategory` field.
The columns are the milestones that add coverage: 2 (passive baseline, and the route
map's flags as findings), 4 (access checks) and 5 (code alerts).

| OWASP 2021                           | Milestone 2                                   | Milestone 4                          | Milestone 5                            | After depth                          | Still needs a person                        |
| ------------------------------------ | --------------------------------------------- | ------------------------------------ | -------------------------------------- | ------------------------------------ | ------------------------------------------- |
| A01 Broken Access Control            | Partial: unguarded routes, from the route map | Good on reads: cross-user, tier, org | Good on reads                          | Good: writes too                     | Business-rule access logic                  |
| A02 Cryptographic Failures           | Partial: TLS, HSTS, cookie flags              | Partial                              | Partial: CodeQL weak-crypto rules      | Partial                              | At-rest encryption, password hashing review |
| A03 Injection                        | Weak: Nuclei known-CVE templates              | Weak                                 | Partial: CodeQL static injection rules | Good for APIs (fuzzing)              | Blind, second-order, SSTI                   |
| A04 Insecure Design                  | Missed                                        | Missed                               | Missed                                 | Missed                               | Threat modelling, design review             |
| A05 Security Misconfiguration        | Good: headers, CSP, exposed panels, defaults  | Good                                 | Good                                   | Good, plus cloud (breadth)           | Little                                      |
| A06 Vulnerable Components            | Partial: stack CVEs via Nuclei                | Partial                              | Good: Dependabot                       | Good, plus SBOM (breadth)            | Malicious-package detection                 |
| A07 Identification and Auth Failures | Partial: cookie and session headers           | Partial                              | Partial                                | Good: auth-flow checks               | Novel auth logic                            |
| A08 Software and Data Integrity      | Missed                                        | Missed                               | Partial: CodeQL                        | Partial; Actions hardening (breadth) | Deserialization review                      |
| A09 Logging and Monitoring           | Missed                                        | Missed                               | Missed                                 | Missed                               | Design review; not a scan target            |
| A10 SSRF                             | Missed                                        | Missed                               | Partial: CodeQL SSRF rules             | Partial: targeted checks             | High-value in cloud; human review           |

What this means: a periodic human pentest stays in the budget for A04, A09 and business
logic, and ThreatWorker's findings become that tester's starting map.

## Scan profiles

A profile is a named, versioned record of which tools run and under what limits. A run
is always one target plus one profile, and the scope check reads the profile's class
before dispatch.

| Profile            | Class   | Tools                                                 | Allowed on                                       | Methods            | Rate cap (starting value) | Time limit       | Feature            |
| ------------------ | ------- | ----------------------------------------------------- | ------------------------------------------------ | ------------------ | ------------------------- | ---------------- | ------------------ |
| `passive-baseline` | passive | ZAP baseline, Nuclei (non-intrusive tags), testssl.sh | staging; production if the target allows passive | Read-only requests | 5 requests/s per host     | 30 min           | `f-baseline-scans` |
| `authz-signed-out` | passive | Signed-out check                                      | staging                                          | `GET`              | 5 requests/s              | 15 min           | `f-access-checks`  |
| `authz-cross-user` | passive | Cross-user check                                      | staging only (needs seeded data)                 | `GET`              | 5 requests/s              | 30 min           | `f-access-checks`  |
| `code-alerts`      | import  | GitHub alert APIs                                     | any target with a repo                           | — (GitHub API)     | GitHub API limits         | 5 min            | `f-code-alerts`    |
| `canary`           | passive | Every passive profile                                 | the canary target only                           | as each profile    | as each profile           | 45 min           | `f-canary`         |
| `active-staging`   | active  | Write-method checks, fuzzing, auth-flow checks        | staging, inside an approved window               | All                | Set per approval          | Set per approval | depth              |

Rules the scope check enforces: a `passive` profile may run on a production target only
when the target sets `allowPassiveOnProd`; an `active` profile never runs on production
and needs an approval id whose window covers the start time. Every run of a real target
also runs the canary, so the same tool versions are proven in the same run.

The approval is ThreatWorker's own record of target, profile, window and approver
(`f-approval-gate`). It is not an item in Sunrise's approval queue: that exists only as a
paused workflow run and has no time window, and a scan-safety control should not depend
on a workflow trace.

## Route inventory and access checks

The inventory is every API route in a target's repo at a given commit, with what each
route declares about who may call it. The access checks are built from it, so nothing
here crawls or guesses.

**What is read per route.** Read with the TypeScript parser, as Sunrise's own
`scripts/ci/admin-tier-roster.ts` already does.

| Field            | Read from                                                                             | Used for                          |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| `path`, `method` | The file path and the exported handler                                                | The request to send               |
| `guard`          | The wrapper: `withAuth`, `withAdminAuth` or none                                      | Whether a session is needed       |
| `tier`           | The route's declared tier                                                             | Which identities must be refused  |
| `ownership`      | Who decides access: `self`, `resource`, `policy` or `nothing`, with the stated reason | Whose rows the route may return   |
| `requires`       | The switch the route needs                                                            | Routes that are off for the org   |
| `scope`          | The API-key scope                                                                     | Which keys may call it            |
| `params`         | Each `[id]` segment and the model it names                                            | Filling path ids from seeded rows |

On Sunrise `main`, 349 of 393 handler exports are a direct `withAuth` or `withAdminAuth`
wrap, and 184 of 281 route files declare `ownership`.

**Three classes, and the flag.** Every route is one of:

- **Guarded:** wrapped in `withAuth` or `withAdminAuth`.
- **Self-authenticating:** checks a token, signature or key in its own code. In Sunrise
  these are approvals, embed, inbound, MCP and the auth routes: 25 of 281 route files.
  The target names them in `selfAuthRoutes`.
- **Public:** on the target's `publicRoutes` list.

A route with no guard that is on neither list is **flagged**. That is a finding straight
from the inventory, with no request sent. Milestone 1 shows flags on the route map;
milestone 2 makes them findings. Anything the reader cannot place counts as unclassified
(hypothesis: under 5% of routes, counted on Sunrise `main` in the first PR).

The access checks do not cover self-authenticating routes. A generic scan sees least
there too, so every report's coverage section names them.

**Signed-out check.** A route wrapped in `withAuth` answers 401 before its handler runs,
so a live request can only catch a missing wrapper, which the inventory already shows.
The check stays as confirmation that the deployed build matches the repo at that commit.

**Cross-user check.** Each route is called as each test identity. The expected answer
comes from the route's own declaration, not from comparing against the owner's response:
`tier` says who must be refused, and `ownership` says whose rows may come back. Any
answer the declaration says should have been refused is a finding. How routes decided by
`policy` are judged is settled when `f-access-checks` is planned.

**Test identities.** Seven per staging target: a platform admin, and an owner, an admin
and a member in each of two orgs. Of Sunrise's 349 guarded handlers, 305 are
`withAdminAuth` and 44 are `withAuth`, so the tests that matter are a member against
admin routes, and one org's admin against another org's rows.

**Filling route parameters.** The hard part is knowing which seeded row belongs to which
identity for each `[id]` segment. The seed unit records the rows each identity owns, by
model, in `TestIdentity`'s owned ids; the inventory's `params` names the model each
segment takes. A route whose parameters cannot be filled is not called, and the report
lists it as not checked.

**Apps that are not Sunrise forks.** The same record is filled from an OpenAPI file with
the expected access per route, or from a route-manifest package for Next.js apps
(`f-any-app-routes`). The package needs its own section here when that feature is
planned.

## The finding record

One normalised record, modelled on SARIF 2.1.0 so any SARIF-emitting tool can plug in
later. A finding is the issue; a sighting is one run that saw it.

| Field                                             | Type                                                     | Notes                                                                         |
| ------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `id`                                              | cuid                                                     |                                                                               |
| `orgId`                                           | FK                                                       | The customer's org; isolation policy applies                                  |
| `targetId`                                        | FK                                                       |                                                                               |
| `fingerprint`                                     | string, unique per target                                | See below                                                                     |
| `tool`, `ruleId`                                  | string                                                   | e.g. `zap` / `10038`, `tw-authz` / `signed-out-read`                          |
| `title`, `description`                            | string                                                   | From the tool, never AI-generated before `f-ai-triage`                        |
| `severity`                                        | enum `critical` · `high` · `medium` · `low` · `info`     | Normalised (table below)                                                      |
| `confidence`                                      | enum `high` · `medium` · `low`                           | From the tool where it gives one                                              |
| `cwe`, `owaspCategory`                            | string, nullable                                         | Mapped where the tool provides it                                             |
| `location`                                        | JSON                                                     | Web: `{host, method, routeTemplate, url}`; code: `{repo, path, line, commit}` |
| `evidence`                                        | sealed JSON (`sealSecret`)                               | Request/response excerpt or code snippet; secrets redacted before storing     |
| `state`                                           | enum `open` · `accepted` · `false_positive` · `resolved` |                                                                               |
| `acceptedById`, `acceptedReason`, `acceptedUntil` | nullable                                                 | Risk acceptance; reopens at expiry                                            |
| `slaDueAt`                                        | datetime                                                 | From severity at first sighting                                               |
| `hubTaskId`                                       | string, nullable                                         | Set by `f-tracked-fixes`                                                      |
| `firstSeenAt`, `lastSeenAt`, `resolvedAt`         | datetime                                                 |                                                                               |

**Severity mapping.**

| Source           | Its scale                                   | Maps to                                    |
| ---------------- | ------------------------------------------- | ------------------------------------------ |
| ZAP              | risk High / Medium / Low / Informational    | high / medium / low / info                 |
| Nuclei           | critical / high / medium / low / info       | same                                       |
| testssl.sh       | CRITICAL / HIGH / MEDIUM / LOW / INFO, WARN | same; WARN → low                           |
| CodeQL           | `security_severity_level` critical–low      | same                                       |
| Dependabot       | critical / high / medium / low              | same                                       |
| Secret scanning  | none                                        | high                                       |
| Route map flag   | ours                                        | high (critical under an admin path)        |
| Signed-out check | ours                                        | high (critical if the route is admin-only) |
| Cross-user check | ours                                        | high within one org; critical across orgs  |

**Fingerprinting.** `fingerprint = sha256(toolFamily, ruleId, normalisedLocation, evidenceKey)`.
A web location is normalised to the route template from the inventory, so
`/api/v1/users/abc` and `/api/v1/users/xyz` are one location. The evidence key is the
stable part of the evidence (the header name, the package and version range, the
identity pair), never a timestamp or nonce. Code alerts use GitHub's own alert number as
the key. Cross-tool duplicates are linked, not merged, when CWE and location match.

## Data model and API surface

Ten app models in `prisma/schema/app.prisma`, each carrying `orgId` and taking the model
steps. `User` FKs are audit columns, so `onDelete: SetNull`. The commercial models are
listed under Commercial model, and `AuditEvent` under History and audit.

**The model steps.** Every new model gets: `orgId`; the isolation policy SQL, added by
hand in its migration; `onDelete` on each user link; a row in the subject-export
manifest; a row in the org export and erasure manifest; and a cross-org test using the
helper built in `f-targets`. Sunrise's tests fail until the policy and the manifest rows
exist. Columns that hold secrets are sealed and registered with `registerSealedStore`.

| Model             | Key fields                                                                                                                                                                              | Relations                                      | Feature             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------- |
| `Target`          | name, environment (`staging` · `production`), repo and its sealed read-only credential, `allowPassiveOnProd`, rules of engagement, `publicRoutes[]`, `selfAuthRoutes[]`, hubProjectSlug | has many hosts, runs, findings                 | `f-targets`         |
| `TargetHost`      | hostname, verification method, token, `verifiedAt`, `lastCheckedAt`                                                                                                                     | belongs to target                              | `f-scan-scope`      |
| `ScanProfile`     | key, class (`passive` · `active` · `import`), tools[], limits JSON, version                                                                                                             | used by runs                                   | `f-baseline-scans`  |
| `ScanRun`         | status (`queued` · `running` · `succeeded` · `failed` · `timed_out`), `triggeredById`, `scheduleId`, `commit`, token hash, `canaryPassed`, started/finished                             | target, profile; has many tool runs, sightings | `f-runner`          |
| `ToolRun`         | tool, image digest, template-feed version, exit code, duration, log excerpt                                                                                                             | belongs to run                                 | `f-runner`          |
| `Finding`         | as in The finding record                                                                                                                                                                | target; has many sightings                     | `f-findings`        |
| `FindingSighting` | runId, seenAt, raw-result reference                                                                                                                                                     | finding, run                                   | `f-findings`        |
| `RouteInventory`  | commit, source (`repo` · `openapi` · `manifest`), routes JSON `{path, method, guard, tier, ownership, requires, scope, class, params}[]`, flagged count, unclassified count             | target                                         | `f-route-inventory` |
| `TestIdentity`    | label, platform role, org label, org role, sealed credentials, owned ids JSON keyed by model                                                                                            | target                                         | `f-test-identities` |
| `ScanSchedule`    | cron, profile, enabled, `createdById`, nextRunAt                                                                                                                                        | target, profile                                | `f-schedules`       |

The repo is connected read-only when the target is added, because the route inventory
reads it in milestone 1; code alerts reuse the same connection in milestone 5. Whether
that is a GitHub App or a per-target token is an owner question on `f-targets`.

`ScanSchedule` keeps its own `nextRunAt` because the job that starts due runs is an app
job on Sunrise's maintenance tick, which holds last-run times in process memory only.

Routes under `app/api/v1/`, all `withAuth()` except the run callback and the public quick
check; every route is scoped to the caller's org. Members read; org admins and owners
start scans, triage and change settings. There is no viewer role: Sunrise's org roles are
a closed set of three. The section rate limits apply automatically through `proxy.ts`.

| Method and path                                             | Purpose                                                                          | Feature             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| `GET`/`POST /targets`, `GET`/`PATCH`/`DELETE /targets/[id]` | Manage targets and hosts                                                         | `f-targets`         |
| `PUT`/`DELETE /targets/[id]/repo`                           | Connect or disconnect the target's repo, read-only                               | `f-targets`         |
| `POST /targets/[id]/verify`                                 | Check ownership of each host                                                     | `f-scan-scope`      |
| `GET /targets/[id]/routes`                                  | Latest route inventory                                                           | `f-route-inventory` |
| `GET`/`POST /targets/[id]/identities`                       | Manage test identities                                                           | `f-test-identities` |
| `GET /profiles`                                             | List profiles                                                                    | `f-baseline-scans`  |
| `GET`/`POST /runs`, `GET /runs/[id]`                        | Start and read runs                                                              | `f-runner`          |
| `POST /runs/[id]/results`                                   | Job callback; run token only, no session; one reference per tool's stored output | `f-runner`          |
| `GET /findings`, `GET`/`PATCH /findings/[id]`               | Read and triage findings (accept, false positive)                                | `f-findings`        |
| `POST /findings/[id]/file`                                  | File to the Hub                                                                  | `f-tracked-fixes`   |
| `GET`/`POST /schedules`, `PATCH`/`DELETE /schedules/[id]`   | Manage schedules                                                                 | `f-schedules`       |

Signed-in pages (route group `(protected)`) under `app/(protected)/threatworker/`:
Targets, Runs, Findings, Schedules, and a dashboard of open findings by severity and SLA
breaches.

## Runner contract

The app and the job share one contract, so moving from GitHub runners to our own workers
changes only the dispatcher.

1. **Dispatch.** After `assertInScope`, the app creates a `ScanRun`, mints a random run
   token (stored as a hash, valid for the profile's time limit plus 10 minutes) and calls
   GitHub's `workflow_dispatch` on `scan.yml` with inputs `runId`, `profile`,
   `targetHosts` (the verified allowlist), `callbackUrl` and the token as a masked input.
2. **Job start.** The workflow re-checks that every host it was given resolves and
   matches the allowlist, then pulls each tool image by digest. A mismatch fails the job
   before any tool runs.
3. **Tools.** Each tool runs in its own container with the profile's rate cap and time
   limit, writing to a mounted output folder. A tool failing does not stop the others;
   its exit code is recorded.
4. **Callback.** The job puts each tool's output file in the org's storage and posts a
   reference to it to `POST /runs/[id]/results` with the run token, then a final status.
   Output size is then not bound by the web host's request limit, which a ZAP report may
   exceed. How the job is given write access to storage is settled at `f-runner`'s
   reconcile. The app validates each file with the tool's Zod schema before parsing.
5. **Ingest.** Parse, normalise, fingerprint, attach sightings, compare canary findings
   to the manifest, set run status.
6. **Timeout.** A run with no final status inside its limit is marked `timed_out`; its
   token stops working.

**Pinning and feeds.** Images are pinned by digest in `scan.yml` and bumped by Renovate
PRs like any dependency. Nuclei templates and other rule feeds update separately from
binaries: the job pulls the latest template release at start and records its version on
`ToolRun`, so a new finding can be traced to a feed update. The canary in the same run
proves the new feed still works.

**Secrets in the runner.** Only the run token and, for authz profiles, short-lived
test-identity sessions. No long-lived credential to any target ever reaches the job.

## Canary

The canary is a minimal Sunrise fork deployed only to staging, with one deliberate
weakness per check. Its manifest lists each plant with the profile and rule expected to
find it. A run that misses a plant fails, whatever it found on the real target.

| Plant                                                                                 | Expected to be found by                               | Proves                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| A response with no `Content-Security-Policy` and a weak `X-Frame-Options`             | `passive-baseline` (ZAP)                              | Passive header rules run             |
| A session cookie without `Secure` or `HttpOnly`                                       | `passive-baseline` (ZAP)                              | Cookie rules run                     |
| An exposed default page or panel matched by a stable Nuclei template                  | `passive-baseline` (Nuclei)                           | Templates loaded and filtering works |
| An expiring or weak-cipher TLS endpoint on a canary subdomain                         | `passive-baseline` (testssl.sh)                       | TLS checks run                       |
| A `GET` route under `/api/v1/` with no guard that returns seeded rows                 | The route map's flag, confirmed by `authz-signed-out` | Inventory read the route; check ran  |
| A route guarded by `withAuth()` that returns any row by id without an ownership check | `authz-cross-user`                                    | Cross-user comparison works          |
| A route that ignores org on a lookup by id                                            | `authz-cross-user`                                    | Cross-org comparison works           |
| A dependency pinned to a version with a published advisory                            | `code-alerts` (Dependabot)                            | Alert import works                   |
| A committed, revoked, fake-format token                                               | `code-alerts` (secret scanning)                       | Secret alert import works            |

Plants use seeded data only and the canary has no production deploy. Generic tools can
additionally be sanity-checked against OWASP Juice Shop on the same staging host, but
Juice Shop cannot exercise the Sunrise-specific checks.

## Quick check

The quick check is the entry point and the only check that runs without ownership proof,
so it is limited to what any browser visit sees. The same limits are why tools such as
Mozilla Observatory and SSL Labs can be offered openly. Whether it needs an account or
payment is part of D7.

| It does                                                                                                                                     | It never does                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Fetch the one URL given, following up to 5 redirects                                                                                        | Spider, crawl or request any other path                               |
| Read response headers: CSP, HSTS, `X-Frame-Options` or `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | Run Nuclei templates, ZAP rules or any payload                        |
| Read cookie flags: `Secure`, `HttpOnly`, `SameSite`                                                                                         | Call API routes or test access control                                |
| Check HTTP to HTTPS redirect and mixed content on that page                                                                                 | Submit forms or send anything but `GET`                               |
| One TLS handshake: certificate validity, expiry, chain, protocol version                                                                    | Scan ports or other hosts                                             |
| Look for `/.well-known/security.txt`                                                                                                        | Store results beyond a short expiry unless the visitor has an account |

**Abuse controls.** Private, loopback, link-local and cloud-metadata addresses are
refused, checked after DNS resolution and again on every redirect. The check uses
Sunrise's `createSafeDispatcher`, which also checks the address at connect time, and
never `outboundDispatcher()`, which gives no protection to an anonymous request. A bot
challenge guards the form; Sunrise has none, so it is built here. Limits apply per
visitor and per domain, held in a shared store because Sunrise's default limit store is
per-instance memory; the numbers are set when `f-quick-check` is planned. Every check is
logged with the visitor's IP hash and the target domain. The
check runs in an isolated function with its own outbound network, never in the main app
process.

**Output.** A letter grade (A–F) from weighted header, cookie and TLS rules; up to 10
findings with plain-English fixes; the line "This checked one page as a visitor would. A
full scan needs you to verify you own the site."; and a next step that carries the
domain into ownership verification.

## Reports

A report is a frozen snapshot of one run, or of a target's open findings on a date, so
it never changes after it is sent.

| Section          | Contents                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary          | Grade, open findings by severity, change since the last report, the three findings to fix first                                                                                                                                                               |
| Scope            | Target, hosts, environment, profiles run, dates, who requested it                                                                                                                                                                                             |
| Coverage         | OWASP Top 10 table marked tested, partly tested or not tested for this run; routes checked out of routes known; the self-authenticating routes, named, as not covered by the access checks; routes whose parameters could not be filled; anything unreachable |
| Scanner verified | Canary result in the same run, with tool versions and template-feed version                                                                                                                                                                                   |
| Findings         | By severity: title, location, evidence (redacted), OWASP and CWE, why it matters, how to fix, state and SLA due date                                                                                                                                          |
| Accepted risks   | Findings accepted, with owner, reason and expiry                                                                                                                                                                                                              |
| Appendix         | Tool list with versions, rules run, what each profile does not cover                                                                                                                                                                                          |

Formats: a page at an expiring signed link (default 14 days, revocable), a PDF rendered
from that page, and JSON and SARIF exports. The PDF is rendered in the runner container
and stored with the report: Sunrise has no PDF library, and a headless browser in a web
function is a known source of trouble. Fix guidance is our own library, one entry
per rule, in plain English with a link to the tool's reference; AI-written explanations
come later (`f-ai-triage`) and are labelled as such.

## Shipshape badge

The badge is the public face of a target's results: something an owner puts on their own
site to show the product has been tested and is in good order. ThreatWorker is the name
the person running scans sees; Shipshape is the name their customers see. It is aimed
first at people who built their own product and are taking it to market, and it is the
link back to us from every site that carries it. The name is a working name: no
trademark check has been done.

**What it claims, and what it does not.** "Shipshape" means in good order on the checks
listed, on the date shown. It never says "secure" or "safe". Principle 8 holds: automated
scanning is not a penetration test, and the page behind the badge says what was not
covered, as every report does.

**Who can hold one.** A target whose hosts are all verified and whose authority statement
is accepted. The quick check never awards a badge: it runs without ownership proof, so a
badge from it would mean nothing.

**Criteria (starting values; settled in D11).** All must hold, and the badge lapses by
itself the moment one stops holding:

| Criterion                     | Starting value                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Fresh                         | A full run of the target's profiles finished within the last 30 days                      |
| Scanner proven                | The canary was caught in that run                                                         |
| Nothing serious open          | No open `critical` or `high` finding; an accepted risk at those severities also blocks it |
| Baseline ran on the live site | `passive-baseline` ran against the production host the badge is shown on                  |

Access checks and code alerts count toward "nothing serious open" when the target has
them, and the page says whether they ran. Whether a badge can be held without them is
part of D11.

**States.** `earned` (all criteria hold) · `lapsed` (a criterion stopped holding; set on
ingest and by a daily job for freshness) · `off` (the owner turned it off, or the target
lost verification). A lapsed badge re-earns on the next run that meets the criteria.

**The badge itself.** A small image served by us, never a file the owner downloads, so it
always shows the current state: the word Shipshape and the date of the last passing run
when earned, a neutral "not current" when lapsed, nothing when off. The owner copies a
snippet of plain HTML: the image, wrapped in a link to the verification page. No script
runs on their site.

**The verification page.** Public, one per target, at a stable address on the badge's own
domain (`shipshapebadge.com` is the candidate), kept apart from the app. A copied badge
on someone else's site is defeated here: the page names the site it belongs to.

| It shows                                                    | It never shows                          |
| ----------------------------------------------------------- | --------------------------------------- |
| The site the badge belongs to, and its state                | Any finding, evidence, route or rule id |
| The date of the last passing run and when it lapses         | Counts of open findings by severity     |
| Which checks ran: baseline, access checks, code alerts      | The org, its members or its repo        |
| Which checks did not run, and what the badge does not cover | Anything from a run that did not pass   |
| That the scanner was proven by the canary in that run       |                                         |
| A short explanation of what ThreatWorker is, with a link    |                                         |

**Rules.**

- State is worked out from findings and runs, never set by hand, and each change is an
  event in the history (earned, lapsed, turned off).
- The criteria are versioned. A badge records the version it was earned under, and a
  change to the criteria takes effect at each badge's next run.
- The image and page are cacheable for a short time only, so a lapse shows within the
  hour.
- The public routes are rate-limited per IP and carry no session.

**Model and routes.** `Badge` (orgId, targetId, public slug, state, criteria version,
`earnedAt`, `lapsesAt`, last passing run). Routes: `POST`/`DELETE /targets/[id]/badge`
(turn on and off, owners and admins), `GET /targets/[id]/badge` (state, reasons and the
snippet); public `GET /badge/[slug]` (page) and `GET /badge/[slug]/image`.

## History and audit

Everything ThreatWorker does to a target, and everything people do with its findings, is
kept as an append-only, searchable record that an org can export for an audit. It is the
evidence that testing happened, what it found, what was recommended and what was done.

**What is recorded.** One event per change, each with `orgId`, actor (a user, a schedule
or the system), time, subject, before and after, and reason where one was given.

| Event                                                        | Subject | Recorded with                                                |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------ |
| Run queued, started, finished, failed, timed out             | Run     | Profile, tool versions, template-feed version, canary result |
| Finding first seen, seen again                               | Finding | Run, fingerprint                                             |
| State changed (accepted, false positive, reopened, resolved) | Finding | Who, reason, acceptance expiry                               |
| Recommendation shown                                         | Finding | Guidance entry id and version                                |
| Filed, ticket updated, ticket closed                         | Finding | Integration, external id                                     |
| Report generated, shared, link revoked                       | Report  | Who, link expiry                                             |
| Badge earned, lapsed, turned on or off                       | Badge   | Run, criteria version, the criterion that failed             |
| Target verified, verification failed, authority accepted     | Target  | Method, wording version                                      |
| Export made                                                  | History | Who, date range, format                                      |

**Rules.**

- Append-only: no route updates or deletes an event, and a database trigger on the event
  table refuses `UPDATE` and `DELETE`. Grants cannot do this: Sunrise's role script
  grants on every table and re-grants them each time it runs. The trigger allows two
  things only: setting the actor to null when a user is erased, and the delete that
  follows an org's erasure.
- Written in the same transaction as the change it records, so a change without its
  event cannot happen.
- Recommendations are versioned: a guidance entry change creates a new version, and a
  finding keeps the version it was shown, so a past report reads as it did when sent.
- Erasing a user sets the actor to null and keeps the event ("deleted user"), per the
  model steps.
- Retention is open (D10). Evidence may be kept for less time than events; that is part
  of D10.

**Search.** Postgres full-text search over finding title, description, rule, location and
recommendation text, with filters for target, date range, severity, state, tool, OWASP
category and CWE. Results link to the run, the finding and its timeline.

**Timeline.** Each finding has a page listing every event in order: first seen, each
sighting, each state change with who and why, filings and the resolving run.

**Export.** CSV and JSON of events and findings for a chosen date range, scoped to the
org; the export is itself an event.

**Model and routes.** `AuditEvent` (orgId, actorId `SetNull`, kind, subject type and id,
before, after, reason, at). It is the app's own table. Sunrise's audit log cannot be this
record: it is written fire-and-forget, pruned by retention and open to updates. Routes: `GET /history` (search and filters),
`GET /findings/[id]/timeline`, `POST /history/export`.

## Commercial model

**Tenancy.** `TENANCY_MODE=multi` from the first model. Each customer is an org; our
team works in the install org. Every app model has `orgId` and an isolation policy, and
the cross-org test helper runs for each. Customer org admins can open only the Sunrise
sections ThreatWorker uses; which those are is decided in `f-app-frame`, and the rest are
closed before ThreatWorker's own production is scanned in milestone 8.

**Onboarding.** Quick-check report → sign up (own org as `OWNER`) → add URL and hosts →
connect the repo, or upload an OpenAPI file or route manifest → accept the authority
statement for this target → verify each host (DNS TXT record or a file at
`/.well-known/threatworker-<token>.txt`), with a re-check button → the first passive
baseline, route map and signed-out check start automatically → email when the report is
ready. The cross-user check joins once the customer has seeded test identities.

The repo or route-file step is what gives an outside customer the access checks. Without
it there is no route inventory and the first report holds the commodity scans only, so
the wizard says so before the step can be skipped. Sunrise already gives an uninvited
sign-up its own org and holds a new owner at a welcome step, so this feature is the
wizard alone.

**Terms and authority.** Sign-up accepts the terms of service. Each target needs an
authority statement: the customer owns the target or is authorised in writing to test
it, accepts the scan profiles listed, and names a contact. Stored as `TargetAuthority`
with user, time, wording version and IP hash. Wording and liability cover are reviewed
by a lawyer before milestone 7 opens sign-up (D9).

**Plans and limits.** Not decided (D7): the pricing model, the plans, their prices,
whether any part is free, and whether to offer a self-hosted edition. Whatever plans are
chosen, each sets how many targets an org may have, which profiles it may run, how
often, and which integrations it may use.

Limits are entitlements checked at dispatch, beside the scope check, so one place
decides whether a run may start. Sunrise's entitlements carry them: switches for
profiles and integrations, and meters for counts such as targets and scans per month.
How often a schedule may run is the app's own setting.

Sunrise has no billing or payment code, so checkout, payment webhooks and the billing
page are built in the fork. Sunrise has its own billing proposal with no rulings yet;
whether to build ours or wait for it is an owner question on `f-billing`.

**Integrations.** One adapter interface (create, update, close, reopen) with Hub, GitHub
Issues, Jira and Slack behind it. Redaction runs before any adapter sees a finding.

**New models for the commercial features:**

| Model             | Key fields                                                                       | Feature                                                          |
| ----------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Report`          | kind (`run` · `target`), frozen JSON, share token hash, `expiresAt`, `revokedAt` | `f-reports`                                                      |
| `QuickCheck`      | domain, IP hash, grade, results JSON, `expiresAt`, claimed org (nullable)        | `f-quick-check`                                                  |
| `TargetAuthority` | targetId, userId (`SetNull`), wording version, accepted at, IP hash, contact     | `f-scan-terms`                                                   |
| `Integration`     | kind, sealed credentials, settings                                               | `f-integrations`                                                 |
| `FindingLink`     | findingId, integration, external id and URL                                      | `f-integrations`                                                 |
| `Badge`           | targetId, public slug, state, criteria version, `earnedAt`, `lapsesAt`           | `f-badge`                                                        |
| Plan entitlements | plan, limits                                                                     | `f-billing` (Sunrise switches and meters; no new model expected) |

**New routes:** `POST /quick-check` (public, challenged and rate-limited),
`GET /quick-check/[id]`; `GET /reports`, `POST /runs/[id]/report`, `GET /reports/[id]`,
`POST /reports/[id]/share`, `DELETE /reports/[id]/share`;
`POST /targets/[id]/authority`; `GET`/`POST /integrations`; the badge routes under
Shipshape badge; billing routes per D7.

## Safety controls

Every control in the proposal's "Safe by default" section, with the feature that ships
it. None is deferred past the first check that needs it.

| Control                              | How it works                                                                                                                       | Ships in                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Scope allowlist                      | Runs reach only a target's verified hosts; checked at dispatch and again in the job                                                | `f-scan-scope`, `f-runner`                                         |
| Ownership proof                      | DNS TXT or well-known file per host, re-checked before each run                                                                    | `f-scan-scope`                                                     |
| Authority recorded                   | The customer's statement that they own or may test the target, versioned                                                           | `f-scan-terms`                                                     |
| Rules of engagement                  | Stored on the target with the owner who signed them off                                                                            | `f-targets`                                                        |
| Passive and active separated         | Profile class enforced by the scope check; active never on production                                                              | `f-scan-scope`; the app's own approval record in `f-approval-gate` |
| Throttling                           | Per-profile request rate cap and time limit                                                                                        | `f-baseline-scans`, `f-runner`                                     |
| Ephemeral, isolated runs             | GitHub-hosted VMs destroyed after each job for our own apps; network egress lock for customer targets                              | `f-runner`; `f-worker-tier`                                        |
| Quick-check limits                   | One page load, private addresses refused at resolve and at connect, bot challenge, per-visitor and per-domain limits               | `f-quick-check`                                                    |
| Short-lived credentials              | Run token per run; test-identity sessions per run                                                                                  | `f-runner`, `f-test-identities`                                    |
| Test accounts only                   | Seed unit refuses production; identities flagged as test                                                                           | `f-test-identities`                                                |
| Audit trail                          | Every run, verification, acceptance and filing written to the app's own append-only history, in the same transaction as the change | `f-history`                                                        |
| Findings protected                   | Org-scoped reads; only admins and owners triage; evidence sealed; secrets redacted on store and on filing; expiring report links   | `f-app-frame`, `f-findings`, `f-reports`, `f-tracked-fixes`        |
| AI kept away from secrets and writes | The triage agent redacts evidence before any model call and holds no write tools                                                   | `f-ai-triage`                                                      |
| No public disclosure                 | Sunrise's findings go to the Hub or private GitHub advisories, never public issues                                                 | `f-tracked-fixes`                                                  |

## Running it as a programme

Scanning hardens apps only if findings are fixed on a clock. These are the proposal's
defaults; change them before `f-tracked-fixes` is planned.

| Rule              | Default                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity SLAs     | Critical 7 days, high 30, medium 90, low at the next review cycle                                                                                     |
| Risk acceptance   | A named owner, a reason and an expiry date; at expiry the finding reopens                                                                             |
| PR-time checks    | CodeQL, secret scanning and dependency review stay in each fork's CI; ThreatWorker covers what PRs cannot see (live config, new CVEs, access control) |
| Scan cadence      | `passive-baseline` and both authz profiles nightly on each staging target; `code-alerts` hourly                                                       |
| Scanner self-test | Canary in every run; a missed plant fails the run                                                                                                     |

Metrics on the dashboard: open findings by severity, median time to fix, SLA breaches,
regressions (findings that came back), and the canary catch rate. The canary rate
matters most: without it, a broken scanner looks exactly like a clean app.

## Build or buy, licences, and what to confirm

**Build or buy.** For breadth and time to value, existing products win today: GitHub
Advanced Security, Snyk, Semgrep, Aikido, StackHawk, Escape, Burp Suite Enterprise,
Detectify and Intruder each beat a self-built baseline. Building wins only where
ThreatWorker uses Sunrise's knowledge: access checks generated from declared guards,
Sunrise-specific rules, the closed loop into the tracker, and findings that never leave
our infrastructure. So this plan reuses the commodity layers (official OSS tools,
GitHub's alerts) and builds only those parts.

**Licences.** Fine for internal use as planned. Before any commercial use:

| Tool                                                                  | Licence               | Catch                                                                  |
| --------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| ZAP, Nuclei, Trivy, Prowler, Checkov, Schemathesis, Syft, OSV-Scanner | Apache-2.0 or MIT     | None                                                                   |
| testssl.sh, ScoutSuite                                                | GPL-2.0               | Fine as a separate process; modifying it obliges publishing changes    |
| TruffleHog                                                            | AGPL-3.0              | Same, stricter                                                         |
| Semgrep registry rules                                                | Semgrep Rules License | Not usable in a competing product; write our own rules or use Opengrep |
| Nmap                                                                  | NPSL                  | A commercial service likely needs an OEM licence                       |
| Burp Suite Enterprise, Nessus                                         | Commercial            | Customer brings their own licence                                      |

**Confirm at reconcile.** Each item is a hypothesis with the check that settles it.

- Image names and current digests for ZAP, Nuclei and testssl.sh: pull each and record
  the digest in `f-runner`'s scan workflow.
- Nuclei's tag names for intrusive, fuzzing and DoS templates: list them from the
  current template release in `f-baseline-scans`.
- The Hub's MCP server accepts a direct HTTP call with a project key: one scripted
  `list_phases` call when `f-tracked-fixes` is planned. If not, file to a private GitHub
  issue first.
- Under 5% of routes fall outside the three classes: the unclassified count over Sunrise
  `main`, in `f-route-inventory`'s first PR.
- Route parsing can run in a web function from a repo archive: tried in
  `f-route-inventory`. If not, it moves to the runner and waits on `f-runner`.
- GitHub's terms allow scanning our own staging from hosted runners: read them before
  `f-runner` ships. Not checked.
- A dispatched job can be tied to its run: `workflow_dispatch` returned no run id when
  the proposal was written and may now. The per-run token makes the design work either
  way.
- The web host's request body limit: not checked, which is why tool output goes to
  storage (Runner contract).
- One org's MCP key cannot reach another org's data through an exposed tool: tested in
  `f-mcp-server`.
- Event hooks are scoped per org: not checked. If they are, `app.*` events may give
  `f-integrations` a generic webhook cheaply.
- The OWASP mapping against the 2025 edition: when `f-findings` adds `owaspCategory`.
- Product details and prices in the build-or-buy list are from memory as of mid-2026; get current
  quotes before any buying decision.
