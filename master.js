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
let activeBundle = 'ALL';
let searchQuery = '';

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

function renderTable() {
  const allowed = bundleKeySet(activeBundle);
  const q = searchQuery.trim().toLowerCase();
  const rows = Object.values(SERVICES)
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
    return `<tr data-key="${s.key}" data-units="${units == null ? '' : units}">
      <td>${s.name}${s.note ? `<div class="tnote">${s.note}</div>` : ''}</td>
      <td class="r"><input type="number" class="line-cost" value="${value}" min="0" step="0.01" data-key="${s.key}" aria-label="Unit cost for ${s.name}"></td>
      <td>${s.basis}</td>
      <td class="r cost-units">${units == null ? '—' : num(units)}</td>
      <td class="r cost-total">${cost == null ? '—' : gbp.format(cost)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" class="tnote">No matching services.</td></tr>`;

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
    $('#updated-at').textContent = '';
    return;
  }
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const data = await res.json();
  currentSha = data.sha;
  const parsed = JSON.parse(b64DecodeUtf8(data.content));
  liveUnits = parsed.units || {};
  $('#updated-at').textContent = parsed.updatedAt
    ? `Live as of ${new Date(parsed.updatedAt).toLocaleString('en-GB')}. Anything not listed is still the services.js default.`
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
    content: b64EncodeUtf8(JSON.stringify({ units, updatedAt: new Date().toISOString() }, null, 2)),
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
    $('#save-status').textContent = 'Committed — live once GitHub Pages rebuilds (usually under a minute).';
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

/* re-use a password already unlocked earlier this browser tab session */
(function () {
  const saved = sessionStorage.getItem(PASSWORD_KEY);
  if (!saved) return;
  unlockWith(saved).catch(() => sessionStorage.removeItem(PASSWORD_KEY));
})();
