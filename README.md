# totalIT — bundle pricing tool

An interactive pricing tool for the ramsac team, built from the **totalIT
Bundles Calculator** Excel (Essentials / Secure / Premium tabs). Standard or
co-managed, then four answers — bundle, users, servers, charity — and it
returns the per-user price with full workings.

## Run

Static site, no build step. Either open `index.html` directly, or:

```bash
python3 -m http.server 8902
# open http://localhost:8902
```

## Deploying a change — bump the cache-busting version

Every script/stylesheet tag in `index.html` has a `?v=YYYYMMDDnn` query
string. **Bump it (e.g. `2026070901` → `2026070902`) any time you edit
`services.js`, `model.js`, `secure.js`, `essentials.js`, `premium.js`,
`app.js`, `feedback.js` or `style.css`, in the same commit.** GitHub Pages
caches assets for 10 minutes (`Cache-Control: max-age=600`); without a
version bump, a browser that loaded the page shortly before your deploy can
end up running an old script against new HTML (or vice versa) for up to that
long. If someone already has the page open in a tab when you deploy, only a
reload fixes it for them — no version bump can retroactively update a page
already running in memory — but bumping the version on every deploy is what
guarantees any *new* page load always gets a matched set of files.

## Use

0. **Standard or co-managed?** Asked once, up front, before the bundle
   choice — see "Standard vs co-managed" below.
1. **Bundle** → Essentials, Secure or Premium. Each has its own service
   list and its own Technical Change hours ratio (2/4/4).
2. **Users** → drives helpdesk ticket volume, starter & leaver hours and
   (Secure/Premium only) cyber management hours automatically, from the
   banded tables in the sheet's notes.
3. **Servers** → switches on server health monitoring, backup monitoring,
   Veeam NOC and SIEM.
4. **Charity?** → applies the 10% charity discount (margin 44% → 38%).

The answer screen shows price per user / per server / monthly / annual,
cost to ramsac, margin, and the full line-item workings mirroring the Excel.
Markup is adjustable under "Adjust markup" — any variance from the 80%
default is flagged for Matt / Dan sign-off.

Ticket volume is adjustable under "Adjust expected tickets" — leave it blank
to use the model's own user-count-based assumption, or enter a
client-provided figure to override it. Only the Helpdesk line uses this
number; starter/leaver and cyber hours stay banded on user count regardless.

**Standard vs co-managed.** Every deal is one or the other, chosen right
after "Start":

- **Standard** — the bundle's line-up is locked. Every line shown on the
  answer screen's "Workings" panel is part of the bundle and can't be
  removed; there's no checkbox, deliberately. You can still **add a
  service** the bundle doesn't normally include (below the table) if a
  deal needs something extra — that's the one lever standard quotes keep.
- **Co-managed** — for deals where some services are handled by the client
  or a third party (e.g. an Essentials client whose cyber team hands off
  to a third-party SOC, pulling in one line normally found in Secure).
  Co-managed starts from the *same* bundle line-up as standard, but every
  line gets a checkbox: **untick** to drop a service this client already
  covers themselves. **Add a service** works here too, for pulling in a
  line from outside the bundle.

Neither mode lets you touch a unit cost — those come from `services.js`
and are the same for every quote, not typed in per deal. The answer
screen's "Workings" table is view-only on cost; only whether a line is
included/added changes, and only in the ways above. See "Master costs
page" below for how a cost actually changes now.

None of this changes the bundle's defaults for the next person pricing the
same bundle — it's scoped to the current quote only (cleared when you pick
a bundle again or restart). A "This quote is customized" flag appears
whenever a co-managed quote drops a line or either mode adds one, and the
client-facing print view always reflects the actual included lines, never
the bundle defaults.

**Shareable links:** `?b=PREMIUM&u=300&s=4&c=yes` (optionally `&mode=comanaged`,
`&m=70` for markup %, `&t=150` for a ticket override) jumps straight to a
priced answer. `b` accepts `ESSENTIALS`, `SECURE` or `PREMIUM`; omit it and
it defaults to Secure. `mode` accepts `comanaged`; omit it and it defaults
to standard. Customizations round-trip too: `&x=SIEM,ITDR` to exclude
services (only takes effect when `mode=comanaged` — standard quotes can't
drop lines), `&a=BOARD_BRIEFING` to add one from outside the bundle
(comma-separate multiple for either).

## Not in scope: frontline / non-core workers

The source workbook has extra tabs pricing a separate "frontline / non-core
worker" tier (a cheaper per-worker rate alongside the core per-user rate —
Essentials £7.83/worker, Secure & Premium share £11.72/worker). By design,
this tool doesn't ask about them: ramsac charges a fixed fee for that user
type rather than recalculating it per deal, so there's nothing here for the
tool to compute. If that ever changes, the per-worker rates already exist in
the source workbook.

## Sales enablement (deliberately soft)

The tool nudges good practice without labelling it as such:

- **"The conversation"** on the answer screen: talking points computed from
  the actual configuration — walk the list before the number (anchoring),
  the per-working-day reframe, the vs-in-house-hires comparison, quote the
  exact figure, and (for charities) name the discount once. No framework
  names anywhere; it reads as a colleague's notes.
- **Anchor stays visible:** any discount (charity or reduced markup) shows
  the standard price struck through above the headline figure.
- **Trade, don't give:** lowering the markup shows the concession in £/year
  and suggests what to ask for in return (term, billing, case study),
  alongside the existing Matt/Dan sign-off flag.
- **Discovery nudge:** the users question suggests asking about 12-month
  headcount growth.
- **"Print for the client"** produces a client-safe page — price, annual
  value, what's included — with cost, margin, markup, workings and all
  internal flags stripped (verified via DOM inspection: zero internal terms
  in the printed output).

## Files

- **`services.js` — the master cost sheet, still the single source of
  truth.** Every core service ramsac provides, its unit cost, and what the
  unit cost multiplies against (`basis`). Essentials, Secure and Premium
  all reference the *same* entry for services they share (e.g. Helpdesk is
  the same entry in every bundle that has it), so a cost change here
  applies everywhere that service is used, once committed.
- **`model.js` — the pricing engine.** Ticket/starter-leaver/cyber-hours
  bands, markup, charity discount, and the `priceBundle()` function that
  turns a bundle's `items` list into line-item costs and a sell price. Not
  bundle-specific — don't edit this to add/remove a service.
- **`secure.js` / `essentials.js` / `premium.js`** — one file per bundle.
  Each just lists which `services.js` entries that bundle includes, plus its
  own `tcHours` value. This is where you add or remove a service *from a
  specific bundle's standard line-up* — co-managed reuses these same lists
  as its starting template, it doesn't get its own file.
- `app.js` — question flow + rendering, including the standard/co-managed
  mode. `index.html` / `style.css` — UI, on the Ironbridge/ramsac brand
  primitives (Charger + Geist, cream/ink/blue).
- `master.html` / `master.js` — the master costs editor: unit costs, and
  "+ Add a new service" for brand-new lines. Commits straight to
  `costs.json` via the GitHub API using a personal access token — see
  "Master costs page" below. `costs.json` — the live unit-cost overrides
  and custom service definitions `app.js` reads on every load (via
  `model.js`'s `applyCustomServices()`); empty until the first save.
  `worker/` — a parked Cloudflare Worker for a real-time alternative to
  this, not currently wired up (see below).

All three bundles are verified to reproduce the source Excel exactly:

| Bundle | Users | Cost | Sell | Per user |
|---|---|---|---|---|
| Secure (charity) | 300 | £7,796.54 | £14,033.77 | £42.10 |
| Essentials | 19 | £742.93 | £1,337.27 | £70.38 |
| Premium | 85 | £3,651.77 | £6,573.18 | £77.33 |

## Master costs page

**Why this exists:** RMs used to be able to override a unit cost per quote
in "Workings." That's gone — costs aren't optional or negotiable per deal,
so editing them belongs to one master control, restricted to the people
who should be setting them (Matt/Dan/Finance), not left as a per-quote,
per-RM lever.

**How it works:** `master.html` commits directly to **`costs.json`** in
this repo via GitHub's own REST API, called straight from the browser —
there's no custom backend. `app.js` fetches `costs.json` (with a
cache-busting query string, so it always gets the current committed file
rather than a stale cached one) on every page load and overwrites the
matching `SERVICES[key].unit` before pricing anything. `services.js`'s
`unit` values are the fallback if `costs.json` is missing or empty for a
key — not the live source of truth once something's been committed there.

- **The master password is a GitHub fine-grained personal access token**,
  not a string in the code. Set it (or rotate it) yourself: GitHub →
  Settings → Developer settings → Personal access tokens → Fine-grained
  tokens → generate one scoped to just this repo, **Contents: Read and
  write**, nothing else. Hand that value to whoever needs edit access
  (Matt, Dan, Finance) as "the master costs password" — everyone uses the
  same one. A wrong value is rejected by GitHub itself (401), not just
  hidden by this page, so it's a real deny, not a UI illusion. To cut
  someone off or change the password, regenerate or delete that token in
  your GitHub settings — takes effect immediately, no code change. It's
  kept in `sessionStorage` per browser tab (cleared on tab close, never
  written to disk), so it needs re-entering once per session, not once
  per visit.
- **Saving** is a real git commit — `master.html` fetches `costs.json`'s
  current SHA, then PUTs the edited figures back with that SHA, exactly
  like the GitHub UI's own file editor does. It fails cleanly (and reloads
  the latest version) if someone else saved in between.
- **Going live** doesn't need a redeploy or a cache-bust commit for the
  numbers themselves — GitHub Pages rebuilds the branch (usually well
  under a minute) and the next page load's cache-busted fetch of
  `costs.json` picks it up. Call it "a few minutes, not seconds" rather
  than instant, which is the trade-off for needing zero new
  infrastructure (no Cloudflare account, no server — just GitHub, which
  this already lives in).
- **`GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH`** at the top of
  `master.js` point at `jpsantam/totalit-pricing-tool` on `main`. If this
  ever gets deployed from the `ironbridge-ai/totalit-pricing-tool` fleet
  repo too, that copy needs its own `costs.json` and its own
  `master.js` constants pointed at itself — the two deployments don't
  share live costs, only code.

**If real-time, no-git-commit-needed updates are ever wanted instead**,
`worker/master-costs.js` + `worker/wrangler.toml` are a parked Cloudflare
Worker + KV version of this same idea — built, not deployed. Worth
switching to if the GitHub-token-per-editor model becomes friction, or if
"a few minutes" stops being fast enough.

**Adding a brand-new service now goes through this page too** — "+ Add a
new service" on `master.html`. Name, unit cost, `basis`, and which bundles
it belongs to (with an independent per-bundle "co-managed default" toggle)
are entered there and committed straight into `costs.json`'s
`customServices` object, keyed by a slug generated from the name (e.g.
"Inforcer surcharge" → `INFORCER_SURCHARGE`). `app.js`/`master.js` both
merge `customServices` into `SERVICES`/`BUNDLES` at load time (see
`model.js`'s `applyCustomServices()`), before the `units` overrides are
applied — so a custom service's cost is then editable the same way as any
built-in one, in the same table. Reserve editing `services.js` directly for
the handful of services that predate this (the sheet's original line
items) or a bulk/scripted change — anything routine goes through the page.

**Co-managed default**, per bundle: ticked means the line starts included
when a co-managed quote for that bundle opens (same as any built-in
service); unticked means it starts excluded but the RM can still tick it
on in Workings, or pull it in via "add a service" on any bundle it wasn't
given standard inclusion on at all.

**`basis`** controls what the unit cost multiplies against:

| basis | units used |
|---|---|
| `user` | user count |
| `server` | server count |
| `ticket` | modelled helpdesk tickets (or the override, if set) |
| `slHours` | starter & leaver hours (banded by user count) |
| `cyberHours` | cyber management hours (banded by user count) |
| `hours` | a fixed `hrs` value on the item itself, e.g. `{ hrs: 2 }` |
| `tcHours` | the bundle's own `tcHours` constant |
| `fixed` | a flat monthly amount, independent of users/servers |
| `fixedPriceAdd` | a flat monthly amount added straight to the sell price, with no markup applied and no cost/margin impact — see below |

**`fixedPriceAdd`** is for a surcharge whose real cost isn't known yet (e.g.
Inforcer, before it gets a proper per-user cost): the unit amount is held
exactly as entered — raising or lowering the markup slider never scales it —
and it's excluded from `cost`/margin entirely, since there's no real cost
behind it yet. Charity's 10% still discounts it, same as everything else in
the sell price. Workings shows it as a separate "Flat add-on(s), no margin
applied" total row. Once a real cost exists, switch its `basis` to whatever
fits (usually `user`) and it becomes an ordinary markupable line.

Use `fixed` for annual/one-off costs the sheet amortises over 12 months
(Premium's board briefing, Cyber Essentials cert, ISO 27001 gap analysis,
and the IT Risk Register all work this way) — put the already-divided
monthly figure in `unit`, not the annual total. See the `note` on each of
those entries in `services.js` for how the monthly figure was derived; if
the Excel changes how it amortises one of these, recompute by hand and
update `unit` the same way, don't try to make the engine do the ÷12.

**To remove a service from one bundle only:** delete its line from that
bundle's `items` array — leave the entry in `services.js` alone if any
other bundle still uses it.

**Adding a genuine fourth tier** (not co-managed — that's a mode over the
existing three, not a bundle of its own): create `newbundle.js` following
the pattern of the existing three, add a `BUNDLES.NEWBUNDLE = { name,
available, tcHours, items }`, load the script in `index.html` (after
`model.js`, before `app.js`), and add a button for it in the `#s-bundle`
screen in `index.html` (`<button class="choice display" data-bundle="NEWBUNDLE">...`).

## Known gaps / assumptions (from the source Excel, not the tool)

- The sheet defines no cyber-management hours below 50 users (tool assumes
  the 50–100 band and flags it, Secure/Premium only — Essentials has no
  cyber management line).
- The sheet never priced a client with servers > 0; the per-server sell rate
  here allocates server-driven services to servers, everything else
  (including the fixed compliance costs) to users — flagged in the tool,
  confirm against how ramsac actually quotes.
- Frontline/non-core worker pricing is intentionally not implemented — see
  "Not in scope" above.
- Per-quote customizations (Workings — untick on co-managed, add on either)
  are not saved anywhere; they live only in memory for that session, or in a
  shared link's `x`/`a` params if one was generated. There's no record of
  who customized what after the fact — if that matters for a given deal, capture
  the link or a screenshot before closing the tab.
