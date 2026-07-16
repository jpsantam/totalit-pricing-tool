/* ===== totalIT master costs — commits costs.json via the GitHub API =====
   No custom backend: this page talks straight to GitHub's REST API (which
   supports CORS from any origin, including PUT with an Authorization
   header — verified against api.github.com directly). The "master
   password" the editor types in IS a GitHub fine-grained personal access
   token (Contents: read/write, scoped to this one repo) — one token,
   generated once, handed out to everyone who needs edit access, same as a
   shared password. A wrong value gets genuinely rejected by GitHub (401),
   not just hidden by this page's UI. To set/rotate the password, generate
   or regenerate that token in GitHub → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens — see README.md → "Master
   costs page". Saving is a real git commit to costs.json. */

const GITHUB_OWNER = 'jpsantam';
const GITHUB_REPO = 'totalit-pricing-tool';
const GITHUB_BRANCH = 'main';
const COSTS_PATH = 'costs.json';
const API_ROOT = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${COSTS_PATH}`;
const PASSWORD_KEY = 'totalit_master_password'; // sessionStorage only — cleared when the tab closes

/* Units p/m and Cost p/m columns are only meaningful once a bundle is
   picked (they depend on that bundle's tcHours ratio and item list) —
   there's no real "quote" being priced on this page, so these use a fixed
   illustrative reference to show relative cost impact, not a real figure. */
const REFERENCE = { users: 100, servers: 0, charity: false };

const $ = s => document.querySelector(s);
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const num = n => Number.isInteger(n) ? n : +n.toFixed(2);

let password = '';
let currentSha = null; // null means costs.json doesn't exist yet (first save creates it)
let liveUnits = {};
let customServices = {}; // key -> { name, basis, unit, hrs?, bundles: { ESSENTIALS: {standard, comanaged}, ... } }
let removedEntirely = new Set(); // service keys hidden from this table + stripped from every bundle
let bundleExclusions = {}; // service key -> Set of bundle keys it's stripped from (but not eliminated entirely)
let activeBundle = 'ALL';
let searchQuery = '';

/* Current removedEntirely/bundleExclusions state in the shape applyRemovals()
   (model.js) and costs.json both expect. */
function removalsPayload() {
  return {
    removedEntirely: [...removedEntirely],
    bundleExclusions: Object.fromEntries(
      Object.entries(bundleExclusions).filter(([, s]) => s.size).map(([key, s]) => [key, [...s]])
    ),
  };
}

const BUNDLE_KEYS = ['ESSENTIALS', 'SECURE', 'PREMIUM'];

/* Turns a service name into a stable SERVICES key, de-duped against
   whatever's already registered (built-in or custom). */
function slugKey(name) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'SERVICE';
  let key = base, n = 2;
  while (SERVICES[key]) key = `${base}_${n++}`;
  return key;
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $('#' + id).classList.add('on');
}

function b64EncodeUtf8(str) {
  return btoa(Array.from(new TextEncoder().encode(str), b => String.fromCharCode(b)).join(''));
}
function b64DecodeUtf8(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${password}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function bundleKeySet(bundleKey) {
  if (bundleKey === 'ALL' || !BUNDLES[bundleKey]) return null; // null = no filter
  return new Set(BUNDLES[bundleKey].items.map(it => it.key));
}

/* Bundle keys `s.key` belongs to by default (absent any removal) — only
   these get a checkbox in the bundle-removal popover, since toggling a
   bundle the service was never part of wouldn't do anything. */
function memberBundleKeys(key) {
  return BUNDLE_KEYS.filter(bk => BUNDLE_MEMBERSHIP[bk] && BUNDLE_MEMBERSHIP[bk].has(key));
}

function renderBundleChip(s) {
  const memberOf = memberBundleKeys(s.key);
  const excludedHere = bundleExclusions[s.key];
  const checkboxes = memberOf.map(bk => `<label>
      <input type="checkbox" class="rm-bundle" data-bundle="${bk}" ${excludedHere && excludedHere.has(bk) ? '' : 'checked'}>
      ${BUNDLES[bk] ? BUNDLES[bk].name : bk}
    </label>`).join('');
  return `<details class="bundle-remove">
    <summary class="btn ghost btn-remove-service" data-key="${s.key}">Remove</summary>
    <div class="bundle-popover">
      <button type="button" class="popover-close" aria-label="Close">&times;</button>
      ${memberOf.length ? checkboxes : '<p class="tnote">Not part of any bundle.</p>'}
      <div class="popover-actions">
        ${memberOf.length ? `<button type="button" class="btn ghost rm-apply" data-key="${s.key}">Apply</button>` : ''}
        <button type="button" class="btn ghost rm-eliminate" data-key="${s.key}" data-name="${s.name}">Eliminate entirely</button>
      </div>
    </div>
  </details>`;
}

function renderTable() {
  const allowed = bundleKeySet(activeBundle);
  const q = searchQuery.trim().toLowerCase();
  const rows = Object.values(SERVICES)
    .filter(s => !REMOVED_ENTIRELY.has(s.key))
    .filter(s => !allowed || allowed.has(s.key))
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ref = allowed
    ? priceBundle({ bundle: activeBundle, users: REFERENCE.users, servers: REFERENCE.servers, charity: REFERENCE.charity })
    : null;

  $('#master-table tbody').innerHTML = rows.length ? rows.map(s => {
    const live = liveUnits[s.key];
    const value = Number.isFinite(live) ? live : s.unit;
    const line = ref ? ref.lines.find(l => l.key === s.key) : null;
    const units = line ? line.units : null;
    const cost = line ? value * units : null;
    const excludedHere = bundleExclusions[s.key];
    const removedNote = excludedHere && excludedHere.size
      ? `<div class="tnote">Removed from: ${[...excludedHere].map(bk => BUNDLES[bk] ? BUNDLES[bk].name : bk).join(', ')}</div>`
      : '';
    return `<tr data-key="${s.key}" data-units="${units == null ? '' : units}">
      <td>${s.name}${s.note ? `<div class="tnote">${s.note}</div>` : ''}${removedNote}</td>
      <td class="r"><input type="number" class="line-cost" value="${value}" min="0" step="0.01" data-key="${s.key}" aria-label="Unit cost for ${s.name}"></td>
      <td>${s.basis}</td>
      <td class="r cost-units">${units == null ? '—' : num(units)}</td>
      <td class="r cost-total">${cost == null ? '—' : gbp.format(cost)}</td>
      <td class="r">${renderBundleChip(s)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" class="tnote">No matching services.</td></tr>`;

  $('#bundle-note').textContent = allowed
    ? `Units/Cost p/m shown are an illustrative ${REFERENCE.users}-user, ${REFERENCE.servers}-server example quote — for comparing relative impact, not a real customer figure.`
    : '';
}

/* live-recompute Cost p/m as a unit cost is edited — delegated onto the
   tbody itself (survives renderTable() replacing its innerHTML) */
$('#master-table tbody').addEventListener('input', e => {
  if (!e.target.matches('.line-cost')) return;
  const tr = e.target.closest('tr');
  const unitsAttr = tr.dataset.units;
  const costCell = tr.querySelector('.cost-total');
  if (unitsAttr === '') { costCell.textContent = '—'; return; }
  const units = parseFloat(unitsAttr);
  const v = parseFloat(e.target.value);
  costCell.textContent = (!isNaN(v) && !isNaN(units)) ? gbp.format(v * units) : '—';
});

/* the bundle-removal popover — "Apply" strips the unchecked bundles for that
   one service (reversible: re-check a box and Apply again to restore it);
   "Eliminate entirely" is a full removal — for a custom service that means
   deleting its definition outright (reverses applyCustomServices() live,
   same as before); for a built-in it means REMOVED_ENTIRELY, since deleting
   a built-in's SERVICES entry would break every bundle file that references
   it by name. Neither is committed until Save is clicked. */
$('#master-table tbody').addEventListener('click', e => {
  const closeBtn = e.target.closest('.popover-close');
  if (closeBtn) { closeBtn.closest('.bundle-remove').open = false; return; }

  const applyBtn = e.target.closest('.rm-apply');
  if (applyBtn) {
    const key = applyBtn.dataset.key;
    const details = applyBtn.closest('.bundle-remove');
    const excluded = new Set();
    details.querySelectorAll('.rm-bundle').forEach(cb => { if (!cb.checked) excluded.add(cb.dataset.bundle); });
    if (excluded.size) bundleExclusions[key] = excluded; else delete bundleExclusions[key];
    applyRemovals(removalsPayload());
    renderTable();
    $('#save-status').textContent = `Updated bundle assignment — click Save to commit.`;
    return;
  }

  const elimBtn = e.target.closest('.rm-eliminate');
  if (elimBtn) {
    const key = elimBtn.dataset.key, name = elimBtn.dataset.name;
    if (CUSTOM_KEYS.has(key)) {
      if (!confirm(`Remove "${name}" entirely? This drops it from every bundle and quote it's part of. Not committed until you click Save.`)) return;
      delete customServices[key];
      delete bundleExclusions[key];
      removeCustomService(key);
    } else {
      if (!confirm(`Eliminate "${name}" entirely from the master costs page? It disappears from every bundle and this table. Not committed until you click Save.`)) return;
      delete bundleExclusions[key];
      removedEntirely.add(key);
      applyRemovals(removalsPayload());
    }
    renderTable();
    $('#save-status').textContent = `Eliminated "${name}" — click Save to commit.`;
  }
});

document.querySelectorAll('.pillbar .pill').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.pillbar .pill').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  activeBundle = btn.dataset.bundle;
  renderTable();
}));

$('#cost-search').addEventListener('input', () => {
  searchQuery = $('#cost-search').value;
  renderTable();
});

async function loadCurrent() {
  const res = await fetch(`${API_ROOT}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders() });
  if (res.status === 401 || res.status === 403) throw new Error('unauthorized');
  if (res.status === 404) {
    currentSha = null;
    liveUnits = {};
    customServices = {};
    removedEntirely = new Set();
    bundleExclusions = {};
    $('#updated-at').textContent = '';
    return;
  }
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const data = await res.json();
  currentSha = data.sha;
  const parsed = JSON.parse(b64DecodeUtf8(data.content));
  liveUnits = parsed.units || {};
  customServices = parsed.customServices || {};
  removedEntirely = new Set(parsed.removedEntirely || []);
  bundleExclusions = {};
  Object.entries(parsed.bundleExclusions || {}).forEach(([key, bundleKeys]) => { bundleExclusions[key] = new Set(bundleKeys); });
  applyCustomServices(customServices); // must run before the unit-override loop below, so custom keys already exist in SERVICES
  applyRemovals(removalsPayload());
  Object.entries(liveUnits).forEach(([key, unit]) => {
    if (SERVICES[key] && Number.isFinite(unit) && unit >= 0) SERVICES[key].unit = unit;
  });
  $('#updated-at').textContent = parsed.updatedAt
    ? `Live as of ${new Date(parsed.updatedAt).toLocaleString('en-GB')}.`
    : '';
}

async function unlockWith(candidatePassword) {
  password = candidatePassword;
  await loadCurrent(); // throws on a wrong password before we show the editor
  sessionStorage.setItem(PASSWORD_KEY, password);
  $('#unlock-error').hidden = true;
  show('editor-panel');
  renderTable();
}

$('#unlock-form').addEventListener('submit', async e => {
  e.preventDefault();
  const candidate = $('#in-password').value.trim();
  if (!candidate) return;
  try {
    await unlockWith(candidate);
  } catch {
    $('#unlock-error').hidden = false;
  }
});

$('#save-btn').addEventListener('click', async () => {
  const units = {};
  document.querySelectorAll('#master-table .line-cost').forEach(input => {
    const v = parseFloat(input.value);
    if (!isNaN(v) && v >= 0) units[input.dataset.key] = v;
  });

  $('#save-status').textContent = 'Saving…';
  const body = {
    message: 'Update master costs via master.html',
    content: b64EncodeUtf8(JSON.stringify({ units, customServices, ...removalsPayload(), updatedAt: new Date().toISOString() }, null, 2)),
    branch: GITHUB_BRANCH,
  };
  if (currentSha) body.sha = currentSha;

  try {
    const res = await fetch(API_ROOT, { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) throw new Error('unauthorized');
    if (res.status === 409 || res.status === 422) {
      $('#save-status').textContent = 'Someone else saved in the meantime — reloading the latest version, try again.';
      await loadCurrent();
      renderTable();
      return;
    }
    if (!res.ok) throw new Error('save failed: ' + res.status);
    const data = await res.json();
    currentSha = data.content.sha;
    liveUnits = units;
    $('#save-status').textContent = 'Saved.';
  } catch (err) {
    if (err.message === 'unauthorized') {
      sessionStorage.removeItem(PASSWORD_KEY);
      $('#save-status').textContent = '';
      show('unlock-panel');
      $('#unlock-error').hidden = false;
      $('#in-password').value = '';
      $('#in-password').focus();
    } else {
      $('#save-status').textContent = 'Save failed — check your connection and try again.';
    }
  }
});

/* ===== add a new service — writes into customServices, merged live via
   applyCustomServices() so it shows in the table immediately; only actually
   persisted once "Save" is clicked, same as any unit-cost edit. ===== */
function resetAddNewServiceForm() {
  $('#ns-name').value = '';
  $('#ns-basis').value = 'user';
  $('#ns-hrs').value = '';
  $('#ns-hrs-wrap').hidden = true;
  $('#ns-unit').value = '';
  $('#ns-error').hidden = true;
  document.querySelectorAll('#addnewservice-panel .ns-bundle-table tbody tr').forEach(tr => {
    tr.querySelector('.ns-standard').checked = false;
    tr.querySelector('.ns-comanaged').checked = false;
    tr.querySelector('.ns-addon').checked = false;
  });
}
function openAddNewService() {
  resetAddNewServiceForm();
  $('#addnewservice-panel').hidden = false;
  $('#btn-addnewservice-toggle').setAttribute('aria-expanded', 'true');
  setTimeout(() => $('#ns-name').focus(), 60);
}
function closeAddNewService() {
  $('#addnewservice-panel').hidden = true;
  $('#btn-addnewservice-toggle').setAttribute('aria-expanded', 'false');
}
$('#btn-addnewservice-toggle').addEventListener('click', () => {
  $('#addnewservice-panel').hidden ? openAddNewService() : closeAddNewService();
});
$('#btn-addnewservice-cancel').addEventListener('click', closeAddNewService);

$('#ns-basis').addEventListener('change', () => {
  $('#ns-hrs-wrap').hidden = $('#ns-basis').value !== 'hours';
});

$('#btn-addnewservice-save').addEventListener('click', () => {
  const err = $('#ns-error');
  const name = $('#ns-name').value.trim();
  const basis = $('#ns-basis').value;
  const unit = parseFloat($('#ns-unit').value);
  const hrs = parseFloat($('#ns-hrs').value);

  if (!name) return showNsError('Name is required.');
  if (isNaN(unit) || unit < 0) return showNsError('Unit cost must be 0 or more.');
  if (basis === 'hours' && (isNaN(hrs) || hrs < 0)) return showNsError('Hours is required for the hours basis.');

  const bundles = {};
  document.querySelectorAll('#addnewservice-panel .ns-bundle-table tbody tr').forEach(tr => {
    const standard = tr.querySelector('.ns-standard').checked;
    const comanaged = tr.querySelector('.ns-comanaged').checked;
    const addon = tr.querySelector('.ns-addon').checked;
    if (standard || comanaged || addon) bundles[tr.dataset.bundle] = { standard, comanaged, addon };
  });
  if (!Object.keys(bundles).length) return showNsError('Tick at least one checkbox on at least one bundle.');

  const key = slugKey(name);
  const def = { name, basis, unit, bundles };
  if (basis === 'hours') def.hrs = hrs;
  customServices[key] = def;
  applyCustomServices(customServices);

  closeAddNewService();
  renderTable();
  $('#save-status').textContent = `Added "${name}" — click Save to commit.`;
});
function showNsError(msg) { const err = $('#ns-error'); err.textContent = msg; err.hidden = false; }

/* re-use a password already unlocked earlier this browser tab session */
(function () {
  const saved = sessionStorage.getItem(PASSWORD_KEY);
  if (!saved) return;
  unlockWith(saved).catch(() => sessionStorage.removeItem(PASSWORD_KEY));
})();
