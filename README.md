# totalIT — bundle pricing tool

An interactive pricing tool for the ramsac team, built from the **totalIT
Bundles Calculator** Excel (Essentials / Secure / Premium tabs). Four
answers — bundle, users, servers, charity — and it returns the per-user
price with full workings.

## Run

Static site, no build step. Either open `index.html` directly, or:

```bash
python3 -m http.server 8902
# open http://localhost:8902
```

## Use

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

**Shareable links:** `?b=PREMIUM&u=300&s=4&c=yes` (optionally `&m=70` for
markup %, `&t=150` for a ticket override) jumps straight to a priced answer.
`b` accepts `ESSENTIALS`, `SECURE` or `PREMIUM`; omit it and it defaults to
Secure.

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

- **`services.js` — the master cost sheet.** Every core service ramsac
  provides, its unit cost, and what the unit cost multiplies against
  (`basis`). This is the one place unit costs live — Essentials, Secure and
  Premium all reference the *same* entry for services they share (e.g.
  Helpdesk is £30/ticket in every bundle that has it), so a cost change here
  applies everywhere that service is used. **This is what Finance should be
  reviewing when costs change** — nothing else needs touching for a pure
  cost update.
- **`model.js` — the pricing engine.** Ticket/starter-leaver/cyber-hours
  bands, markup, charity discount, and the `priceBundle()` function that
  turns a bundle's `items` list into line-item costs and a sell price. Not
  bundle-specific — don't edit this to add/remove a service.
- **`secure.js` / `essentials.js` / `premium.js`** — one file per bundle.
  Each just lists which `services.js` entries that bundle includes, plus its
  own `tcHours` value. This is where you add or remove a service *from a
  specific bundle* (the cost itself still lives in `services.js`).
- `app.js` — question flow + rendering. `index.html` / `style.css` — UI, on
  the Ironbridge/ramsac brand primitives (Charger + Geist, cream/ink/blue).

All three bundles are verified to reproduce the source Excel exactly:

| Bundle | Users | Cost | Sell | Per user |
|---|---|---|---|---|
| Secure (charity) | 300 | £7,796.54 | £14,033.77 | £42.10 |
| Essentials | 19 | £742.93 | £1,337.27 | £70.38 |
| Premium | 85 | £3,651.77 | £6,573.18 | £77.33 |

## Editing costs

**To reprice an existing service** (e.g. Helpdesk cost per ticket changes):
edit its `unit` in `services.js`. Every bundle that includes it updates
automatically — nothing else to touch.

```js
// services.js
HELPDESK: { name: 'Helpdesk', unit: 32.00, basis: 'ticket', note: '...' },
```

**To add a brand-new service** (e.g. Inforcer costs):

1. Add an entry to `services.js`:
   ```js
   INFORCER: { name: 'Inforcer — MDM & compliance', unit: 1.85, basis: 'user' },
   ```
2. Reference it from whichever bundle file(s) it belongs to, e.g. in
   `premium.js`:
   ```js
   items: [
     ...
     SERVICES.INFORCER,
   ],
   ```

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

**Adding a fourth bundle:** create `newbundle.js` following the pattern of
the existing three, add a `BUNDLES.NEWBUNDLE = { name, available, tcHours,
items }`, load the script in `index.html` (after `model.js`, before
`app.js`), and add a button for it in the `#s-bundle` screen in
`index.html` (`<button class="choice display" data-bundle="NEWBUNDLE">...`).

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
