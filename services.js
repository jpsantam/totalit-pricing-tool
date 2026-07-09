/* ===== totalIT core services — master cost sheet =====
   Source of truth: "Copy of totalIT Bundles Calculator" workbook (Essentials /
   Secure / Premium tabs). Every unit cost here is lifted straight from the sheet.

   This is the ONE place unit costs live. Every bundle file (secure.js,
   essentials.js, premium.js) references entries here by key rather than
   repeating numbers — change a cost once and it updates every bundle that
   uses it. To add a new core service (e.g. a new Inforcer line), add an
   entry here, then reference its key from whichever bundle file(s) it
   belongs to. See README.md → "Editing costs" for the full walkthrough.

   `basis` controls what a unit cost multiplies against — see README.md for
   the full table. `fixed` means a flat monthly amount that does not scale
   with users/servers (used for a handful of annual compliance costs that
   the sheet amortises over 12 months — see the notes on each). */

const SERVICES = {
  HELPDESK:                { name: 'Helpdesk',                                                    unit: 30.00, basis: 'ticket',     note: 'Weighted on avg ticket usage per user band (Note 1)' },
  STARTER_LEAVER:          { name: 'Starter & Leaver Account Management',                          unit: 40.97, basis: 'slHours',    note: 'Hours by user band (Note 2)' },
  COMPLIANCE_PORTALS:      { name: 'Compliance / Asset / 365 / Support portals',                    unit: 0.15,  basis: 'user' },
  OS_PATCHING:              { name: 'Workstation & Server OS + Firmware Patching',                  unit: 1.10,  basis: 'user' },
  SERVER_HEALTH:           { name: '24/7 Server Health Monitoring',                                 unit: 13.99, basis: 'server' },
  BACKUP_MONITORING:       { name: 'Back Up Monitoring (Server)',                                   unit: 0.40,  basis: 'server' },
  VEEAM_NOC:                { name: 'Veeam Backup NOC (Servers)',                                    unit: 9.00,  basis: 'server' },
  CLOUD_BACKUP_365:        { name: '365 Cloud Back Up',                                             unit: 1.95,  basis: 'user' },
  AV_MANAGEMENT:           { name: 'Anti Virus Management & Monitoring',                            unit: 51.66, basis: 'hours', hrs: 1.0 },
  CYBER_RESILIENCE_REPORT: { name: 'Annual Cyber Resilience Benchmarking Report',                   unit: 63.16, basis: 'hours', hrs: 0.5 },
  TC_TIME:                  { name: 'Technical Change / Development time',                          unit: 63.16, basis: 'tcHours',   note: 'Hours vary per bundle — suggested ratio 2/4/4 (Note 3)' },
  QBR:                      { name: 'Quarterly Business Review',                                     unit: 44.80, basis: 'hours', hrs: 2 },
  THIRD_PARTY_PATCHING:    { name: 'Third Party Software Patching',                                 unit: 0.95,  basis: 'user' },
  THIRD_PARTY_VULN_MGMT:   { name: 'Third Party Software Vulnerability Management',                 unit: 60.80, basis: 'hours', hrs: 2 },
  MDR:                       { name: 'MDR — 24/7 monitoring & response, end-user devices',            unit: 1.75,  basis: 'user' },
  ITDR:                      { name: 'ITDR — 24/7 identity threat response, 365 accounts',            unit: 0.95,  basis: 'user' },
  SIEM:                      { name: 'SIEM — 24/7 monitoring & response, IT estate',                  unit: 1.51,  basis: 'server' },
  CYBER_MGMT_TECHDEV:      { name: 'Cyber Management — TechDev team (Cyber T1)',                    unit: 51.66, basis: 'cyberHours', note: 'Hours by user band (Note 4)' },
  SECURITY_TRAINING:       { name: 'End User Security Awareness Training (monthly)',                unit: 1.21,  basis: 'user' },
  QUARTERLY_ROADMAP:       { name: 'Quarterly Roadmap & Strategy Meeting',                           unit: 65.21, basis: 'hours', hrs: 2 },

  // Premium-only compliance add-ons. These four are annual/one-off costs that
  // the sheet spreads over 12 months — do NOT model them as unit × units/month,
  // the "unit cost" shown against some of these in the sheet is not a real
  // per-month rate. Use the pre-amortised monthly figure directly (`fixed`).
  BOARD_BRIEFING:          { name: 'Annual Cyber Awareness Board Briefing',                         unit: 250.00,          basis: 'fixed', note: 'Annual: 6 hrs at £500/hr, amortised over 12 months (£3,000/yr ÷ 12)' },
  IT_POLICY_REVIEW:        { name: 'Production & Annual Review of Internal IT Policies',            unit: 60.93,           basis: 'hours', hrs: 1 },
  IT_RISK_REGISTER:        { name: 'Production & Maintenance of IT Risk Register',                  unit: 142.6933333333,  basis: 'fixed', note: 'Flat £20.83/mo org charge + 2 hrs/mo at £60.93/hr (Note 5)' },
  CYBER_ESSENTIALS_CERT:   { name: 'Cyber Essentials Certification',                                 unit: 197.665,         basis: 'fixed', note: 'Annual: 18 hrs prep at £65.11/hr + £1,200 submission, amortised over 12 months (£2,371.98/yr ÷ 12) (Note 6)' },
  ISO27001_GAP_ANALYSIS:   { name: 'ISO 27001 Gap Analysis',                                         unit: 121.86,          basis: 'fixed', note: "Annual: 24 hrs (3 days) of Voke's time at £60.93/hr, amortised over 12 months (Note 7)" },
};

/* Every entry knows its own catalog key — lets the UI/engine reference a
   service by key (for toggling, overriding, or adding it to a quote)
   without repeating the name as a string anywhere else. */
Object.keys(SERVICES).forEach(k => { SERVICES[k].key = k; });

if (typeof module !== 'undefined') module.exports = { SERVICES };
