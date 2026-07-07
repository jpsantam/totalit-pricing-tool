/* ===== totalIT pricing tool — flow + render ===== */

const state = { users: null, servers: null, charity: null, markup: MODEL.defaultMarkup };

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
  if (id === 's-result') render();
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

/* charity choice → straight to the answer */
$$('.choice').forEach(c => c.addEventListener('click', () => {
  $$('.choice').forEach(x => x.classList.remove('sel'));
  c.classList.add('sel');
  state.charity = c.dataset.charity === 'yes';
  setTimeout(() => show('s-result'), 220);
}));

/* markup override */
$('#in-markup').addEventListener('input', () => {
  const v = parseFloat($('#in-markup').value);
  if (!isNaN(v) && v >= 0) { state.markup = v / 100; render(); }
});

/* restart */
$('#restart').addEventListener('click', () => {
  state.users = state.servers = state.charity = null;
  state.markup = MODEL.defaultMarkup;
  $('#in-markup').value = 80;
  $('#in-users').value = ''; $('#in-servers').value = '';
  $$('.choice').forEach(x => x.classList.remove('sel'));
  show('s-users');
});

/* deep link: ?u=300&s=4&c=yes → straight to the answer (shareable) */
(function () {
  const p = new URLSearchParams(location.search);
  if (!p.has('u')) return;
  state.users = Math.max(1, parseInt(p.get('u'), 10) || 1);
  state.servers = Math.max(0, parseInt(p.get('s') || '0', 10) || 0);
  state.charity = p.get('c') === 'yes';
  if (p.has('m')) { state.markup = (parseFloat(p.get('m')) || 80) / 100; $('#in-markup').value = parseFloat(p.get('m')) || 80; }
  $('#in-users').value = state.users; $('#in-servers').value = state.servers;
  show('s-result');
})();

function render() {
  const r = priceBundle({ users: state.users, servers: state.servers, charity: state.charity, markup: state.markup });

  /* headline — keep the standard price visible whenever anything discounts it (the anchor) */
  $('#r-eyebrow').textContent = `totalIT · Secure Bundle · ${state.users} users` + (state.servers ? ` · ${state.servers} servers` : '');
  $('#r-peruser').textContent = gbp.format(r.perUser);
  const anchor = priceBundle({ users: state.users, servers: state.servers, charity: false, markup: MODEL.defaultMarkup });
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
  $('#r-chips').innerHTML = [
    `<span class="chip blue">${num(r.tickets)} helpdesk tickets p/m expected</span>`,
    `<span class="chip blue">${num(r.slHrs)} hrs starters &amp; leavers p/m</span>`,
    `<span class="chip blue">${num(r.cyberHrs)} hrs cyber management p/m</span>`,
    `<span class="chip">4 hrs technical change (SECURE ratio)</span>`,
  ].join('');

  /* the conversation — talking points built from this configuration */
  const perDay = r.perUser / 21.7; // average working days per month
  const annual = r.sell * 12;
  const activeLines = r.lines.filter(l => l.cost > 0).length;
  const hires = Math.max(1, Math.round(annual / 52000)); // ~fully loaded cost of one IT hire
  const story = [
    `<b>Walk the list before the number.</b> ${activeLines} services, 24/7 cover, a named team.
     A price that lands after the list reads as the summary of a lot; the same price up front
     reads as an opening bid.`,
    `<b>${gbp.format(r.perUser)} a user is ${gbp.format(perDay)} a working day.</b> Same price,
     different size. The monthly total belongs in the paperwork; the per-day figure belongs in
     the conversation.`,
    annual < 52000
      ? `<b>It costs less than one hire.</b> The whole contract is under a single fully-loaded
         in-house IT salary, and it comes with a service desk, patching, backup and a 24/7 cyber
         team. That comparison does most of the work for you.`
      : `<b>It replaces a department, not a line item.</b> ${gbp0.format(annual)} a year is
         roughly ${hires} fully-loaded in-house hires (~£52k each), and what it buys is a
         service desk, patching, backup and a 24/7 cyber team no ${hires}-person team covers.`,
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
    const base = priceBundle({ users: state.users, servers: state.servers, charity: state.charity, markup: MODEL.defaultMarkup });
    const concession = (base.sell - r.sell) * 12;
    flags.push(`<b>Markup is off the 80% default.</b> Any variance must be agreed with Matt or Dan before this price goes anywhere.`
      + (concession > 0 ? ` That change is worth ${gbp0.format(concession)} a year. If the price moves, something moves back: a longer term, annual billing up front, or a referenceable case study.` : ''));
  }
  if (r.flags.cyberBandUndefined)
    flags.push(`<b>Under 50 users:</b> the calculator doesn't define cyber management hours below 50 users — the 50–100 band (3 hrs) has been assumed. Sense-check before quoting.`);
  if (r.flags.serverSplitAssumed)
    flags.push(`<b>Per-server rate is an allocation assumption.</b> Server-driven services (health monitoring, backup monitoring, Veeam NOC, SIEM) are priced per server; everything else per user. The shared calculator tab only ever had zero servers — confirm the split matches how ramsac quotes.`);
  $('#r-flags').innerHTML = flags.map(f => `<div class="flag">${f}</div>`).join('');

  /* client-safe print page: price + what's included, nothing internal */
  $('#print-includes').innerHTML =
    `<h3>What's included</h3><ul>` +
    r.lines.filter(l => l.cost > 0).map(l => `<li>${l.name}</li>`).join('') +
    `</ul><p class="printfoot">Prepared by ramsac · ${state.users} users${state.servers ? `, ${state.servers} servers` : ''} · figures ex VAT.</p>`;

  /* workings table */
  const tb = $('#r-table tbody');
  tb.innerHTML = r.lines.map(l => `
    <tr>
      <td>${l.name}${l.note ? `<div class="tnote">${l.note}</div>` : ''}</td>
      <td class="r">${gbp.format(l.unit)}</td>
      <td>${l.unitLabel}</td>
      <td class="r">${num(l.units)}</td>
      <td class="r">${gbp.format(l.cost)}</td>
    </tr>`).join('') + `
    <tr class="total"><td>Cost to provide SECURE bundle</td><td></td><td></td><td></td><td class="r">${gbp.format(r.cost)}</td></tr>
    <tr class="total"><td>Price to sell${state.charity ? ' (charity −10%)' : ''} · markup ${Math.round(state.markup * 100)}%</td><td></td><td></td><td></td><td class="r">${gbp.format(r.sell)}</td></tr>`;
}
