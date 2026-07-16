/* ===== totalIT bundle pricing engine =====
   Bundle-agnostic. Bundle definitions (which services + tcHours ratio) live
   in secure.js / essentials.js / premium.js and register themselves onto
   BUNDLES below. Unit costs live in services.js. */

const MODEL = {
  defaultMarkup: 0.80,          // any variance must be agreed with Matt or Dan
  charityDiscount: 0.10,        // 10% off the sell price (46.78 -> 42.10 in the sheet)

  // Note 1 — average tickets per employee per month, by user count
  ticketBands: [
    { min: 300, rate: 0.44 },
    { min: 200, rate: 0.45 },
    { min: 100, rate: 0.45 },
    { min: 50,  rate: 0.50 },
    { min: 0,   rate: 0.60 },
  ],
  // Note 2 — starter & leaver hours per month, by user count
  slBands: [
    { min: 300, hrs: 8 },
    { min: 200, hrs: 6.3 },
    { min: 100, hrs: 4.2 },
    { min: 50,  hrs: 2.1 },
    { min: 0,   hrs: 1 },
  ],
  // Note 4 — cyber management (Cyber T1) hours, by user count.
  // The sheet defines nothing below 50 users; we floor at the 50-100 rate and flag it.
  cyberBands: [
    { min: 251, hrs: 8 },
    { min: 101, hrs: 6 },
    { min: 50,  hrs: 3 },
    { min: 0,   hrs: 3, undefinedInSheet: true },
  ],
};

/* Populated by secure.js / essentials.js / premium.js. */
const BUNDLES = {};

/* Populated by applyCustomServices() below — bundle key -> Set of custom
   service keys that are on that bundle's standard line-up but NOT included
   by default when a co-managed quote starts (still addable manually via
   "add a service", and the RM can tick it back on in Workings). */
const CUSTOM_COMANAGED_OFF = {};

/* Populated by applyCustomServices() below — bundle key -> Set of custom
   service keys that should appear in that bundle's "add a service" picker
   even though they're not part of its standard line-up. Custom services are
   NOT offered anywhere by default — whoever adds one via master.html decides
   per bundle whether it's a standard line, a co-managed default, an add-on-
   only option, any combination, or none at all. Built-in services are
   unaffected — they've always been globally addable (see addServiceAvailable
   in app.js) and this doesn't change that. */
const CUSTOM_ADDON_ALLOWED = {};

/* Every key ever registered via applyCustomServices() — lets app.js tell a
   custom service apart from a built-in one (built-ins keep the old
   always-addable-anywhere behaviour; custom services are gated by
   CUSTOM_ADDON_ALLOWED), and lets master.js only offer a full delete on
   services that actually came from this page. */
const CUSTOM_KEYS = new Set();

/* bundleKey -> Set of every service key (built-in or custom) that belongs on
   that bundle's standard line-up absent any removal — i.e. what secure.js /
   essentials.js / premium.js hardcode, plus whatever applyCustomServices()
   has ticked "standard" for. This is the base membership that
   applyRemovals()/rebuildBundles() below subtract from; it's seeded lazily
   from BUNDLES[key].items the first time either function runs, which is
   safe because the bundle files always populate BUNDLES before master.js or
   app.js ever call into this module. */
let BUNDLE_MEMBERSHIP = null;
function ensureBundleMembership() {
  if (BUNDLE_MEMBERSHIP) return;
  BUNDLE_MEMBERSHIP = {};
  Object.entries(BUNDLES).forEach(([bundleKey, b]) => { BUNDLE_MEMBERSHIP[bundleKey] = new Set(b.items.map(it => it.key)); });
}

/* Service keys eliminated entirely from the master costs page — hidden from
   master.html's table and stripped out of every bundle. Populated by
   applyRemovals() below. */
const REMOVED_ENTIRELY = new Set();

/* bundleKey -> Set of service keys removed from that one bundle specifically
   (but not eliminated entirely) — the other half of applyRemovals()'s state. */
let BUNDLE_EXCLUSIONS = {};

/* Rebuilds every bundle's `items` from BUNDLE_MEMBERSHIP, filtering out
   anything in REMOVED_ENTIRELY or that bundle's BUNDLE_EXCLUSIONS set. Runs
   from scratch each time (not a running subtraction) so a removal can always
   be reversed by calling applyRemovals() again with updated state. */
function rebuildBundles() {
  ensureBundleMembership();
  Object.entries(BUNDLE_MEMBERSHIP).forEach(([bundleKey, keys]) => {
    const b = BUNDLES[bundleKey];
    if (!b) return;
    const excludedHere = BUNDLE_EXCLUSIONS[bundleKey];
    b.items = [...keys]
      .filter(key => SERVICES[key] && !REMOVED_ENTIRELY.has(key) && !(excludedHere && excludedHere.has(key)))
      .map(key => SERVICES[key]);
  });
}

/* Merges services added via the master costs page (master.html) into
   SERVICES/BUNDLES at runtime. `customServices` is the `customServices` key
   from costs.json: { KEY: { name, basis, unit, hrs?, bundles: { ESSENTIALS:
   {standard, comanaged, addon}, ... } } } — each of the three bundle flags is
   independent; none is implied by another. Idempotent — safe to call more
   than once with the same data (e.g. costs.json reloaded after a save
   conflict). */
function applyCustomServices(customServices) {
  ensureBundleMembership();
  Object.entries(customServices || {}).forEach(([key, def]) => {
    if (!SERVICES[key]) {
      const entry = { key, name: def.name, unit: def.unit, basis: def.basis, note: 'Added via master costs page' };
      if (def.basis === 'hours' && Number.isFinite(def.hrs)) entry.hrs = def.hrs;
      SERVICES[key] = entry;
    }
    CUSTOM_KEYS.add(key);
    Object.entries(def.bundles || {}).forEach(([bundleKey, cfg]) => {
      if (!BUNDLES[bundleKey]) return;
      if (cfg.standard) {
        BUNDLE_MEMBERSHIP[bundleKey].add(key);
        if (!cfg.comanaged) (CUSTOM_COMANAGED_OFF[bundleKey] ||= new Set()).add(key);
      }
      if (cfg.addon) (CUSTOM_ADDON_ALLOWED[bundleKey] ||= new Set()).add(key);
    });
  });
  rebuildBundles();
}

/* Reverses applyCustomServices() for one key — used by master.html's full
   delete on a custom service. Only ever called on a custom service (see
   CUSTOM_KEYS); a built-in instead goes through applyRemovals() below, since
   deleting a built-in's SERVICES entry would break every bundle file that
   references it by name. */
function removeCustomService(key) {
  delete SERVICES[key];
  CUSTOM_KEYS.delete(key);
  REMOVED_ENTIRELY.delete(key);
  Object.values(BUNDLE_EXCLUSIONS).forEach(s => s.delete(key));
  if (BUNDLE_MEMBERSHIP) Object.values(BUNDLE_MEMBERSHIP).forEach(s => s.delete(key));
  Object.values(CUSTOM_COMANAGED_OFF).forEach(s => s.delete(key));
  Object.values(CUSTOM_ADDON_ALLOWED).forEach(s => s.delete(key));
  rebuildBundles();
}

/* Applies master.html's per-service bundle removals (built-in or custom) —
   `removedEntirely` (array of service keys, hidden from the master table and
   stripped from every bundle) and `bundleExclusions` ({ KEY: [bundleKey,
   ...] }, stripped from just those bundles) are the `removedEntirely` /
   `bundleExclusions` keys from costs.json. Idempotent and fully reversible —
   pass the updated state again (e.g. a bundle un-ticked back on) and it
   recomputes from BUNDLE_MEMBERSHIP rather than compounding. */
function applyRemovals({ removedEntirely = [], bundleExclusions = {} } = {}) {
  ensureBundleMembership();
  REMOVED_ENTIRELY.clear();
  removedEntirely.forEach(key => REMOVED_ENTIRELY.add(key));
  BUNDLE_EXCLUSIONS = {};
  Object.entries(bundleExclusions).forEach(([key, bundleKeys]) => {
    bundleKeys.forEach(bundleKey => (BUNDLE_EXCLUSIONS[bundleKey] ||= new Set()).add(key));
  });
  rebuildBundles();
}

function bandLookup(bands, users) {
  return bands.find(b => users >= b.min);
}

/* Returns { lines, cost, price, perUser, perServer, ... } for a configuration.
   `excluded` (array/Set of service keys) and `added` (array of service keys
   from the master catalog not in the bundle by default) let a co-managed
   quote diverge from the bundle's standard line-up. Unit costs themselves
   are never per-quote — they live in SERVICES (services.js defaults,
   overridden live from the master costs page) and apply to every quote. */
function priceBundle({ bundle = 'SECURE', users, servers, charity, markup = MODEL.defaultMarkup,
                        ticketsOverride = null, excluded = [], added = [] }) {
  const b = BUNDLES[bundle];
  const ticketsAssumed = users * bandLookup(MODEL.ticketBands, users).rate;
  const ticketsOverridden = ticketsOverride !== null && ticketsOverride !== undefined && !isNaN(ticketsOverride);
  const tickets = ticketsOverridden ? ticketsOverride : ticketsAssumed;
  const slHrs   = bandLookup(MODEL.slBands, users).hrs;
  const cyberBand = bandLookup(MODEL.cyberBands, users);

  const excludedSet = excluded instanceof Set ? excluded : new Set(excluded);
  const extraItems = added.map(k => SERVICES[k]).filter(Boolean);
  const allItems = [...b.items, ...extraItems];

  const lines = allItems.map(it => {
    let units, unitLabel;
    switch (it.basis) {
      case 'ticket':     units = tickets;        unitLabel = 'per ticket'; break;
      case 'user':       units = users;          unitLabel = 'per user';   break;
      case 'server':     units = servers;        unitLabel = 'per server'; break;
      case 'slHours':    units = slHrs;          unitLabel = 'per hour';   break;
      case 'cyberHours': units = cyberBand.hrs;  unitLabel = 'per hour';   break;
      case 'tcHours':    units = b.tcHours;      unitLabel = 'per hour';   break;
      case 'fixed':         units = 1;           unitLabel = 'fixed p/m'; break;
      case 'fixedPriceAdd': units = 1;           unitLabel = 'fixed p/m, no margin'; break;
      default:           units = it.hrs;         unitLabel = 'per hour';
    }
    return { ...it, units, unitLabel,
             included: !excludedSet.has(it.key),
             addedExtra: !b.items.includes(it),
             cost: it.unit * units,
             serverDriven: it.basis === 'server',
             noMarkup: it.basis === 'fixedPriceAdd' };
  });

  const includedLines = lines.filter(l => l.included);
  // `fixedPriceAdd` lines (e.g. a surcharge with no known cost yet) skip markup
  // entirely — they're a flat addition to price, not a cost that gets grossed
  // up. They're excluded from `cost`/margin (there's no real cost behind them
  // yet) and added straight into `price` post-markup, then spread across the
  // per-user rate (never per-server) same as the sheet's own way of doing this.
  const markupLines = includedLines.filter(l => !l.noMarkup);
  const flatAddLines = includedLines.filter(l => l.noMarkup);
  const cost = markupLines.reduce((s, l) => s + l.cost, 0);
  const flatAdd = flatAddLines.reduce((s, l) => s + l.cost, 0);
  const price = cost * (1 + markup) + flatAdd;
  const discount = charity ? MODEL.charityDiscount : 0;
  const sell = price * (1 - discount);

  // The sheet quotes a per-user and a per-server rate. Server-driven line items
  // are allocated to the server rate; everything else (including the fixed
  // compliance costs, which the sheet has no per-server equivalent for, and
  // any fixedPriceAdd surcharge) to the user rate. With 0 servers this
  // reproduces the sheet exactly; with servers it is an assumption to confirm
  // — the shared tabs never had servers > 0.
  const serverCost = markupLines.filter(l => l.serverDriven).reduce((s, l) => s + l.cost, 0);
  const userCost = cost - serverCost;
  const perUser   = users   ? ((userCost * (1 + markup) + flatAdd) * (1 - discount)) / users   : 0;
  const perServer = servers ? (serverCost * (1 + markup) * (1 - discount)) / servers : 0;

  return {
    lines, cost, price, sell, perUser, perServer, flatAdd,
    costPerUser: users ? userCost / users : 0,
    margin: sell ? (sell - cost) / sell : 0,
    bundleName: b.name, tcHours: b.tcHours,
    tickets, ticketsAssumed, slHrs, cyberHrs: cyberBand.hrs,
    flags: {
      markupOverridden: Math.abs(markup - MODEL.defaultMarkup) > 1e-9,
      ticketsOverridden,
      cyberBandUndefined: !!cyberBand.undefinedInSheet,
      serverSplitAssumed: servers > 0,
      customized: excludedSet.size > 0 || extraItems.length > 0,
      hasFlatAdd: flatAdd > 0,
    },
  };
}

if (typeof module !== 'undefined') module.exports = { MODEL, BUNDLES, bandLookup, priceBundle, applyCustomServices, removeCustomService, applyRemovals, CUSTOM_COMANAGED_OFF, CUSTOM_ADDON_ALLOWED, CUSTOM_KEYS, REMOVED_ENTIRELY, get BUNDLE_MEMBERSHIP() { return BUNDLE_MEMBERSHIP; } };
