/* ===== totalIT bundle pricing model =====
   Source of truth: "totalIT Bundles Calculator(Secure).csv" (SECURE tab).
   Every number here is lifted from the sheet — do not tune by hand without
   updating against the Excel. */

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

const BUNDLES = {
  SECURE: {
    name: 'SECURE',
    available: true,
    tcHours: 4, // Note 3 — Technical Change time, suggested ratio 2/4/4 per bundle
    items: [
      { name: 'Helpdesk', unit: 30.00, basis: 'ticket', note: 'Weighted on avg ticket usage per user band (Note 1)' },
      { name: 'Starter & Leaver Account Management', unit: 40.97, basis: 'slHours', note: 'Hours by user band (Note 2)' },
      { name: 'Compliance / Asset / 365 / Support portals', unit: 0.15, basis: 'user' },
      { name: 'Workstation & Server OS + Firmware Patching', unit: 1.10, basis: 'user' },
      { name: '24/7 Server Health Monitoring', unit: 13.99, basis: 'server' },
      { name: 'Back Up Monitoring (Server)', unit: 0.40, basis: 'server' },
      { name: 'Veeam Backup NOC (Servers)', unit: 9.00, basis: 'server' },
      { name: '365 Cloud Back Up', unit: 1.95, basis: 'user' },
      { name: 'Anti Virus Management & Monitoring', unit: 51.66, basis: 'hours', hrs: 1.0 },
      { name: 'Annual Cyber Resilience Benchmarking Report', unit: 63.16, basis: 'hours', hrs: 0.5 },
      { name: 'Technical Change / Development time', unit: 63.16, basis: 'tcHours', note: 'Suggested ratio 2/4/4 across bundles (Note 3)' },
      { name: 'Quarterly Business Review', unit: 44.80, basis: 'hours', hrs: 2 },
      { name: 'Third Party Software Patching', unit: 0.95, basis: 'user' },
      { name: 'Third Party Software Vulnerability Management', unit: 60.80, basis: 'hours', hrs: 2 },
      { name: 'MDR — 24/7 monitoring & response, end-user devices', unit: 1.75, basis: 'user' },
      { name: 'ITDR — 24/7 identity threat response, 365 accounts', unit: 0.95, basis: 'user' },
      { name: 'SIEM — 24/7 monitoring & response, IT estate', unit: 1.51, basis: 'server' },
      { name: 'Cyber Management — TechDev team (Cyber T1)', unit: 51.66, basis: 'cyberHours', note: 'Hours by user band (Note 4)' },
      { name: 'End User Security Awareness Training (monthly)', unit: 1.21, basis: 'user' },
      { name: 'Quarterly Roadmap & Strategy Meeting', unit: 65.21, basis: 'hours', hrs: 2 },
    ],
  },
  // The Excel has further bundle tabs (the 2/4/4 TC ratio implies three);
  // drop their line items in here when the tabs are shared.
  CORE:    { name: 'CORE',    available: false },
  PREMIUM: { name: 'PREMIUM', available: false },
};

function bandLookup(bands, users) {
  return bands.find(b => users >= b.min);
}

/* Returns { lines, cost, price, perUser, perServer, ... } for a configuration. */
function priceBundle({ bundle = 'SECURE', users, servers, charity, markup = MODEL.defaultMarkup }) {
  const b = BUNDLES[bundle];
  const tickets = users * bandLookup(MODEL.ticketBands, users).rate;
  const slHrs   = bandLookup(MODEL.slBands, users).hrs;
  const cyberBand = bandLookup(MODEL.cyberBands, users);

  const lines = b.items.map(it => {
    let units, unitLabel;
    switch (it.basis) {
      case 'ticket':     units = tickets;        unitLabel = 'per ticket'; break;
      case 'user':       units = users;          unitLabel = 'per user';   break;
      case 'server':     units = servers;        unitLabel = 'per server'; break;
      case 'slHours':    units = slHrs;          unitLabel = 'per hour';   break;
      case 'cyberHours': units = cyberBand.hrs;  unitLabel = 'per hour';   break;
      case 'tcHours':    units = b.tcHours;      unitLabel = 'per hour';   break;
      default:           units = it.hrs;         unitLabel = 'per hour';
    }
    return { ...it, units, unitLabel, cost: it.unit * units,
             serverDriven: it.basis === 'server' };
  });

  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const price = cost * (1 + markup);
  const discount = charity ? MODEL.charityDiscount : 0;
  const sell = price * (1 - discount);

  // The sheet quotes a per-user and a per-server rate. Server-driven line items
  // are allocated to the server rate; everything else to the user rate.
  // (With 0 servers this reproduces the sheet exactly; with servers it is an
  // assumption to confirm — the shared tab never had servers > 0.)
  const serverCost = lines.filter(l => l.serverDriven).reduce((s, l) => s + l.cost, 0);
  const userCost = cost - serverCost;
  const perUser   = users   ? (userCost   * (1 + markup) * (1 - discount)) / users   : 0;
  const perServer = servers ? (serverCost * (1 + markup) * (1 - discount)) / servers : 0;

  return {
    lines, cost, price, sell, perUser, perServer,
    costPerUser: users ? userCost / users : 0,
    margin: sell ? (sell - cost) / sell : 0,
    tickets, slHrs, cyberHrs: cyberBand.hrs,
    flags: {
      markupOverridden: Math.abs(markup - MODEL.defaultMarkup) > 1e-9,
      cyberBandUndefined: !!cyberBand.undefinedInSheet,
      serverSplitAssumed: servers > 0,
    },
  };
}

if (typeof module !== 'undefined') module.exports = { MODEL, BUNDLES, priceBundle };
