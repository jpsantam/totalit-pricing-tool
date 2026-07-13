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

/* Merges services added via the master costs page (master.html) into
   SERVICES/BUNDLES at runtime. `customServices` is the `customServices` key
   from costs.json: { KEY: { name, basis, unit, hrs?, bundles: { ESSENTIALS:
   {standard, comanaged}, ... } } }. Idempotent — safe to call more than once
   with the same data (e.g. costs.json reloaded after a save conflict). */
function applyCustomServices(customServices) {
  Object.entries(customServices || {}).forEach(([key, def]) => {
    if (!SERVICES[key]) {
      const entry = { key, name: def.name, unit: def.unit, basis: def.basis, note: 'Added via master costs page' };
      if (def.basis === 'hours' && Number.isFinite(def.hrs)) entry.hrs = def.hrs;
      SERVICES[key] = entry;
    }
    Object.entries(def.bundles || {}).forEach(([bundleKey, cfg]) => {
      const b = BUNDLES[bundleKey];
      if (!b || !cfg.standard) return;
      if (!b.items.includes(SERVICES[key])) b.items.push(SERVICES[key]);
      if (!cfg.comanaged) (CUSTOM_COMANAGED_OFF[bundleKey] ||= new Set()).add(key);
    });
  });
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
      case 'fixed':      units = 1;              unitLabel = 'fixed p/m'; break;
      default:           units = it.hrs;         unitLabel = 'per hour';
    }
    return { ...it, units, unitLabel,
             included: !excludedSet.has(it.key),
             addedExtra: !b.items.includes(it),
             cost: it.unit * units,
             serverDriven: it.basis === 'server' };
  });

  const includedLines = lines.filter(l => l.included);
  const cost = includedLines.reduce((s, l) => s + l.cost, 0);
  const price = cost * (1 + markup);
  const discount = charity ? MODEL.charityDiscount : 0;
  const sell = price * (1 - discount);

  // The sheet quotes a per-user and a per-server rate. Server-driven line items
  // are allocated to the server rate; everything else (including the fixed
  // compliance costs, which the sheet has no per-server equivalent for) to the
  // user rate. With 0 servers this reproduces the sheet exactly; with servers
  // it is an assumption to confirm — the shared tabs never had servers > 0.
  const serverCost = includedLines.filter(l => l.serverDriven).reduce((s, l) => s + l.cost, 0);
  const userCost = cost - serverCost;
  const perUser   = users   ? (userCost   * (1 + markup) * (1 - discount)) / users   : 0;
  const perServer = servers ? (serverCost * (1 + markup) * (1 - discount)) / servers : 0;

  return {
    lines, cost, price, sell, perUser, perServer,
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
    },
  };
}

if (typeof module !== 'undefined') module.exports = { MODEL, BUNDLES, bandLookup, priceBundle, applyCustomServices, CUSTOM_COMANAGED_OFF };
