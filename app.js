/* ===== totalIT pricing tool — flow + render ===== */

const state = { mode: null, bundle: null, users: null, servers: null, charity: null, markup: MODEL.defaultMarkup, ticketsOverride: null,
  excluded: new Set(), added: [] };

function resetCustomization() { state.excluded = new Set(); state.added = []; comanagedDefaultsPending = true; }

/* A custom service can be on a bundle's standard line-up but opted out of the
   co-managed default (set via the master costs page's "co-managed default"
   checkbox) — those pre-exclude when a co-managed quote first reaches the
   results screen, same as if the RM had unticked them, but still retickable.
   Runs once per fresh quote (guarded by the pending flag reset in
   resetCustomization()) so it never re-applies over a manual re-tick. Waits
   on costsReady since CUSTOM_COMANAGED_OFF is only populated once
   costs.json's customServices has loaded. */
let comanagedDefaultsPending = false;
function applyComanagedDefaultsIfPending() {
  if (!comanagedDefaultsPending) return;
  comanagedDefaultsPending = false;
  if (state.mode === 'COMANAGED' && CUSTOM_COMANAGED_OFF[state.bundle]) {
    CUSTOM_COMANAGED_OFF[state.bundle].forEach(k => state.excluded.add(k));
  }
}

/* Live unit costs — committed straight to costs.json by the master costs
   page (master.html), which writes to this repo via the GitHub API. The
   `?t=` query string is a cache-bust: GitHub Pages caches file responses
   for ~10 minutes by URL, but a query string that changes every load
   sidesteps that, so this always fetches whatever's currently on the
   branch rather than a stale cached copy. Falls back to the services.js
   defaults if costs.json is missing/unreachable. See README → "Master
   costs page". */
const costsReady = fetch('costs.json?t=' + Date.now())
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if (!data) return;
    applyCustomServices(data.customServices); // must run first — creates SERVICES entries the units override below can then match
    applyBundleOverrides({ removedEntirely: data.removedEntirely, bundleExclusions: data.bundleExclusions, bundleAdditions: data.bundleAdditions });
    if (!data.units) return;
    Object.entries(data.units).forEach(([key, unit]) => {
      if (SERVICES[key] && Number.isFinite(unit) && unit >= 0) SERVICES[key].unit = unit;
    });
  })
  .catch(() => {});

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const num = n => Number.isInteger(n) ? n : +n.toFixed(2);

function show(id) {
  $$('.screen').forEach(s => s.classList.remove('on'));
  $('#' + id).classList.add('on');
  const input = $('#' + id + ' input.num');
  if (input) setTimeout(() => input.focus(), 60);
  if (id === 's-result') costsReady.then(() => { applyComanagedDefaultsIfPending(); render(); });
}

/* nav buttons */
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (b.id === 'next-users' && !readUsers()) return;
  if (b.id === 'next-servers' && !readServers()) return;
  show(b.dataset.go);
}));

function readUsers() {
  const v = parseInt($('#in-users').value, 10);
  if (!v || v < 1) { $('#in-users').focus(); return false; }
  state.users = v; return true;
}
function readServers() {
  const v = parseInt($('#in-servers').value || '0', 10);
  if (v < 0) { $('#in-servers').focus(); return false; }
  state.servers = v; return true;
}

/* enter advances */
$('#in-users').addEventListener('keydown', e => { if (e.key === 'Enter' && readUsers()) show('s-servers'); });
$('#in-servers').addEventListener('keydown', e => { if (e.key === 'Enter' && readServers()) show('s-charity'); });

/* standard vs co-managed → straight to bundle choice */
$$('#s-mode .choice').forEach(c => c.addEventListener('click', () => {
  $$('#s-mode .choice').forEach(x => x.classList.remove('sel'));
  c.classList.add('sel');
  state.mode = c.dataset.mode;
  $('#bundle-mode-tag').textContent = state.mode === 'COMANAGED' ? 'Co-managed · Question 1 of 4' : 'Question 1 of 4';
  setTimeout(() => show('s-bundle'), 220);
}));

/* bundle choice → straight to users */
$$('#s-bundle .choice').forEach(c => c.addEventListener('click', () => {
  $$('#s-bundle .choice').forEach(x => x.classList.remove('sel'));
  c.classList.add('sel');
  state.bundle = c.dataset.bundle;
  resetCustomization();
  setTimeout(() => show('s-users'), 220);
}));

/* charity choice → straight to the answer */
$$('#s-charity .choice').forEach(c => c.addEventListener('click', () => {
  $$('#s-charity .choice').forEach(x => x.classList.remove('sel'));
  c.classList.add('sel');
  state.charity = c.dataset.charity === 'yes';
  setTimeout(() => show('s-result'), 220);
}));

/* markup override */
$('#in-markup').addEventListener('input', () => {
  const v = parseFloat($('#in-markup').value);
  if (!isNaN(v) && v >= 0) { state.markup = v / 100; render(); }
});

/* ticket volume override — client-provided figure in place of the model's assumption */
$('#in-tickets').addEventListener('input', () => {
  const raw = $('#in-tickets').value;
  const v = parseFloat(raw);
  state.ticketsOverride = (raw === '' || isNaN(v) || v < 0) ? null : v;
  render();
});

/* workings table — co-managed only: per-quote include/exclude (delegated: rows are rebuilt every render).
   Standard quotes render no checkbox at all, so this only ever fires when mode is co-managed. */
$('#r-table tbody').addEventListener('change', e => {
  const key = e.target.closest('tr')?.dataset.key;
  if (!key) return;
  if (e.target.matches('.line-include')) {
    if (e.target.checked) state.excluded.delete(key); else state.excluded.add(key);
    render();
  }
});

/* add services from the master catalog that aren't already on this quote —
   multiselect panel: check any number of services, commit them all at once */
let pendingAdd = new Set();

function addServiceAvailable() {
  const onQuote = new Set([...BUNDLES[state.bundle].items.map(it => it.key), ...state.added]);
  const allowedCustom = CUSTOM_ADDON_ALLOWED[state.bundle];
  return Object.values(SERVICES)
    .filter(s => !onQuote.has(s.key))
    /* built-ins have always been globally addable to any bundle; a custom
       service only shows up here if it was explicitly given the "add-on"
       checkbox for this bundle on the master costs page */
    .filter(s => !CUSTOM_KEYS.has(s.key) || (allowedCustom && allowedCustom.has(s.key)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function renderAddServicePanel() {
  const q = $('#addservice-search').value.trim().toLowerCase();
  const matches = addServiceAvailable().filter(s => !q || s.name.toLowerCase().includes(q));
  $('#addservice-list').innerHTML = matches.length
    ? matches.map(s => `
        <label class="addservice-item">
          <input type="checkbox" value="${s.key}" ${pendingAdd.has(s.key) ? 'checked' : ''}>
          <span>${s.name}</span>
        </label>`).join('')
    : `<div class="addservice-empty">No matching services</div>`;
  updateAddServiceCommitButton();
}
function updateAddServiceCommitButton() {
  const btn = $('#btn-addservice-commit');
  btn.textContent = pendingAdd.size ? `Add ${pendingAdd.size} to quote` : 'Add to quote';
  btn.disabled = pendingAdd.size === 0;
}
function openAddServicePanel() {
  pendingAdd = new Set();
  $('#addservice-search').value = '';
  renderAddServicePanel();
  $('#addservice-panel').hidden = false;
  $('#btn-addservice-toggle').setAttribute('aria-expanded', 'true');
  setTimeout(() => $('#addservice-search').focus(), 60);
}
function closeAddServicePanel() {
  $('#addservice-panel').hidden = true;
  $('#btn-addservice-toggle').setAttribute('aria-expanded', 'false');
}
$('#btn-addservice-toggle').addEventListener('click', () => {
  if ($('#addservice-panel').hidden) openAddServicePanel(); else closeAddServicePanel();
});
$('#btn-addservice-cancel').addEventListener('click', closeAddServicePanel);
$('#addservice-search').addEventListener('input', renderAddServicePanel);
$('#addservice-list').addEventListener('change', e => {
  if (!e.target.matches('input[type=checkbox]')) return;
  if (e.target.checked) pendingAdd.add(e.target.value); else pendingAdd.delete(e.target.value);
  updateAddServiceCommitButton();
});
$('#btn-addservice-commit').addEventListener('click', () => {
  if (!pendingAdd.size) return;
  pendingAdd.forEach(key => { state.added.push(key); state.excluded.delete(key); });
  closeAddServicePanel();
  render();
});

function currentOpts() {
  return { bundle: state.bundle, users: state.users, servers: state.servers, charity: state.charity,
           markup: state.markup, ticketsOverride: state.ticketsOverride,
           excluded: state.excluded, added: state.added };
}

/* restart — full reset, back to the standard/co-managed choice */
$('#restart').addEventListener('click', () => {
  state.mode = state.bundle = state.users = state.servers = state.charity = state.ticketsOverride = null;
  state.markup = MODEL.defaultMarkup;
  resetCustomization();
  $('#in-markup').value = 80;
  $('#in-users').value = ''; $('#in-servers').value = ''; $('#in-tickets').value = '';
  $$('.choice').forEach(x => x.classList.remove('sel'));
  show('s-mode');
});

/* deep link: ?b=SECURE&u=300&s=4&c=yes&mode=comanaged → straight to the answer (shareable) */
(function () {
  const p = new URLSearchParams(location.search);
  if (!p.has('u')) return;
  state.mode = p.get('mode') === 'comanaged' ? 'COMANAGED' : 'STANDARD';
  state.bundle = BUNDLES[p.get('b')] ? p.get('b') : 'SECURE';
  state.users = Math.max(1, parseInt(p.get('u'), 10) || 1);
  state.servers = Math.max(0, parseInt(p.get('s') || '0', 10) || 0);
  state.charity = p.get('c') === 'yes';
  if (p.has('m')) { state.markup = (parseFloat(p.get('m')) || 80) / 100; $('#in-markup').value = parseFloat(p.get('m')) || 80; }
  if (p.has('t')) { const t = parseFloat(p.get('t')); if (!isNaN(t) && t >= 0) { state.ticketsOverride = t; $('#in-tickets').value = t; } }
  /* excluding a line only makes sense for co-managed quotes — standard bundles can't drop lines.
     An explicit x= is authoritative (the link already baked in whatever was excluded when it was
     generated); only fall back to the co-managed defaults when the link doesn't specify one. */
  if (p.has('x') && state.mode === 'COMANAGED') state.excluded = new Set(p.get('x').split(',').filter(Boolean));
  else comanagedDefaultsPending = state.mode === 'COMANAGED';
  if (p.has('a')) state.added = p.get('a').split(',').filter(k => SERVICES[k]);
  $('#in-users').value = state.users; $('#in-servers').value = state.servers;
  show('s-result');
})();

function render() {
  const opts = currentOpts();
  const r = priceBundle(opts);
  $('#in-tickets').placeholder = num(r.ticketsAssumed);
  $('#tickets-note').hidden = !r.flags.ticketsOverridden;

  /* headline — keep the standard price visible whenever anything discounts it (the anchor) */
  $('#r-eyebrow').textContent = `totalIT · ${r.bundleName} Bundle` + (state.mode === 'COMANAGED' ? ' · Co-managed' : '') + ` · ${state.users} users` + (state.servers ? ` · ${state.servers} servers` : '');
  $('#r-peruser').textContent = gbp.format(r.perUser);
  const anchor = priceBundle({ ...opts, charity: false, markup: MODEL.defaultMarkup });
  const discounted = r.perUser < anchor.perUser - 0.005;
  $('#r-was').hidden = !discounted;
  if (discounted) $('#r-was').textContent = gbp.format(anchor.perUser) + ' standard';
  $('#r-charity').hidden = !state.charity;
  $('#r-margin').innerHTML = `<span class="d"></span>${Math.round(r.margin * 100)}% margin`;
  $('#r-perserver-inline').textContent = state.servers > 0 ? `· ${gbp.format(r.perServer)} per server` : '';

  /* cards */
  $('#r-monthly').textContent = gbp.format(r.sell);
  $('#r-monthly-s').textContent = `sell price · markup ${Math.round(state.markup * 100)}%` + (state.charity ? ' · charity −10%' : '');
  $('#r-annual').textContent = gbp0.format(r.sell * 12);
  $('#r-cost').textContent = gbp.format(r.cost);
  $('#r-cost-s').textContent = `${gbp.format(r.costPerUser)} per user`;
  $('#r-perserver').textContent = state.servers > 0 ? gbp.format(r.perServer) : '—';
  $('#r-perserver-s').textContent = state.servers > 0 ? 'server-driven services' : 'no servers in scope';

  /* chips — what the model derived for you */
  const cyberCover = r.lines.some(l => l.included && (l.name.startsWith('MDR') || l.name.startsWith('ITDR') || l.name.startsWith('SIEM')));
  $('#r-chips').innerHTML = [
    `<span class="chip blue">${num(r.tickets)} helpdesk tickets p/m` + (r.flags.ticketsOverridden ? ' (client-provided)' : ' expected') + `</span>`,
    `<span class="chip blue">${num(r.slHrs)} hrs starters &amp; leavers p/m</span>`,
    cyberCover ? `<span class="chip blue">${num(r.cyberHrs)} hrs cyber management p/m</span>` : '',
    `<span class="chip">${r.tcHours} hrs technical change (${r.bundleName.toUpperCase()} ratio)</span>`,
  ].join('');

  /* the conversation — talking points built from this configuration */
  const perDay = r.perUser / 21.7; // average working days per month
  const annual = r.sell * 12;
  const activeLines = r.lines.filter(l => l.included && l.cost > 0).length;
  const hires = Math.max(1, Math.round(annual / 52000)); // ~fully loaded cost of one IT hire
  const cover = cyberCover ? '24/7 cover, ' : '';
  const story = [
    `<b>Walk the list before the number.</b> ${activeLines} services, ${cover}a named team.
     A price that lands after the list reads as the summary of a lot; the same price up front
     reads as an opening bid.`,
    `<b>${gbp.format(r.perUser)} a user is ${gbp.format(perDay)} a working day.</b> Same price,
     different size. The monthly total belongs in the paperwork; the per-day figure belongs in
     the conversation.`,
    annual < 52000
      ? `<b>It costs less than one hire.</b> The whole contract is under a single fully-loaded
         in-house IT salary, and it comes with a service desk, patching, backup` + (cyberCover ? ' and a 24/7 cyber team' : '') + `. That comparison does most of the work for you.`
      : `<b>It replaces a department, not a line item.</b> ${gbp0.format(annual)} a year is
         roughly ${hires} fully-loaded in-house hires (~£52k each), and what it buys is a
         service desk, patching, backup` + (cyberCover ? ` and a 24/7 cyber team no ${hires}-person team covers` : '') + `.`,
    `<b>Quote it exactly.</b> ${gbp.format(r.perUser)} reads as arithmetic. A round number
     reads as an opening position.`,
  ];
  if (state.charity) story.push(
    `<b>Name the discount once.</b> The 10% charity rate is already in these figures. Offered
     up front it's goodwill; conceded later it's a negotiation.`);
  $('#r-story').innerHTML = story.map(s => `<p>${s}</p>`).join('');

  /* flags */
  const flags = [];
  if (r.flags.markupOverridden) {
    const base = priceBundle({ ...opts, markup: MODEL.defaultMarkup });
    const concession = (base.sell - r.sell) * 12;
    flags.push(`<b>Markup is off the 80% default.</b> Any variance must be agreed with Matt or Dan before this price goes anywhere.`
      + (concession > 0 ? ` That change is worth ${gbp0.format(concession)} a year. If the price moves, something moves back: a longer term, annual billing up front, or a referenceable case study.` : ''));
  }
  if (r.flags.ticketsOverridden)
    flags.push(`<b>Ticket volume is client-provided.</b> ${num(r.tickets)}/month replaces the model's own assumption of ${num(r.ticketsAssumed)}/month for this user count — only the Helpdesk line is affected.`);
  if (r.flags.cyberBandUndefined && cyberCover)
    flags.push(`<b>Under 50 users:</b> the calculator doesn't define cyber management hours below 50 users — the 50–100 band (3 hrs) has been assumed. Sense-check before quoting.`);
  if (r.flags.serverSplitAssumed)
    flags.push(`<b>Per-server rate is an allocation assumption.</b> Server-driven services (health monitoring, backup monitoring, Veeam NOC, SIEM) are priced per server; everything else per user. The shared calculator tabs only ever had zero servers — confirm the split matches how ramsac quotes.`);
  if (r.flags.customized) {
    const removed = r.lines.filter(l => !l.included).length;
    const addedN = r.lines.filter(l => l.addedExtra).length;
    const bits = [];
    if (removed) bits.push(`${removed} service${removed > 1 ? 's' : ''} removed`);
    if (addedN) bits.push(`${addedN} service${addedN > 1 ? 's' : ''} added`);
    flags.push(`<b>This quote is customized</b> — ${bits.join(', ')} from the standard ${r.bundleName} bundle. See "Workings" for exactly what changed.`);
  }
  if (r.flags.hasFlatAdd)
    flags.push(`<b>Includes ${gbp.format(r.flatAdd)}/mo in flat add-on(s) held outside margin.</b> Unlike every other line, these don't scale with the markup % above — they're added to the price at their exact value, same as the source spreadsheet's approach until a real cost is known.`);
  $('#r-flags').innerHTML = flags.map(f => `<div class="flag">${f}</div>`).join('');

  /* client-safe print page: price + what's included, nothing internal */
  $('#print-includes').innerHTML =
    `<h3>What's included</h3><ul>` +
    r.lines.filter(l => l.included && l.cost > 0).map(l => `<li>${l.name}</li>`).join('') +
    `</ul><p class="printfoot">Prepared by ramsac · ${r.bundleName} bundle · ${state.users} users${state.servers ? `, ${state.servers} servers` : ''} · figures ex VAT.</p>`;

  /* workings summary/hint — Standard is locked (view-only, no checkbox column at all);
     Co-managed keeps the include/exclude checkbox. Unit cost is read-only everywhere —
     that only ever changes on the master costs page now. */
  const comanaged = state.mode === 'COMANAGED';
  $('#workings-summary').textContent = comanaged ? 'Workings — select services' : 'Workings';
  $('#workings-hint').textContent = comanaged
    ? 'Untick a line that’s handled by the client or a third party to drop it from this quote. Add a service below for anything extra. Costs are fixed — see the master costs page to change a unit cost.'
    : 'Every line here is part of the standard bundle and can’t be removed. Add a service below if this deal needs something extra. Costs are fixed — see the master costs page to change a unit cost.';

  /* workings table — co-managed gets a checkbox to include/exclude; standard has none */
  const tb = $('#r-table tbody');
  tb.innerHTML = r.lines.map(l => `
    <tr class="${l.included ? '' : 'excluded'}" data-key="${l.key}">
      <td>${comanaged ? `<input type="checkbox" class="line-include" ${l.included ? 'checked' : ''} aria-label="Include ${l.name}">` : ''}</td>
      <td>${l.name}${l.addedExtra ? ' <span class="addedtag">added</span>' : ''}${l.note ? `<div class="tnote">${l.note}</div>` : ''}</td>
      <td class="r">${gbp.format(l.unit)}</td>
      <td>${l.unitLabel}</td>
      <td class="r">${num(l.units)}</td>
      <td class="r">${gbp.format(l.cost)}</td>
    </tr>`).join('') + `
    <tr class="total row-cost"><td></td><td><span class="total-sign">&minus;</span>Cost to provide ${r.bundleName.toUpperCase()} bundle${r.flags.customized ? ' (as customized)' : ''}</td><td></td><td></td><td></td><td class="r">${gbp.format(r.cost)}</td></tr>` +
    (r.flags.hasFlatAdd ? `
    <tr class="total row-flatadd"><td></td><td><span class="total-sign">+</span>Flat add-on(s), no margin applied</td><td></td><td></td><td></td><td class="r">${gbp.format(r.flatAdd)}</td></tr>` : '') + `
    <tr class="total row-sell"><td></td><td><span class="total-sign">=</span>Price to sell${state.charity ? ' (charity −10%)' : ''} · markup ${Math.round(state.markup * 100)}%</td><td></td><td></td><td></td><td class="r">${gbp.format(r.sell)}</td></tr>`;

  /* keep the add-service panel's list in sync if it's open while something else re-renders */
  if (!$('#addservice-panel').hidden) renderAddServicePanel();
}
