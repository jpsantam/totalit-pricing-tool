/* ===== totalIT ESSENTIALS bundle =====
   Source of truth: "Copy of totalIT Bundles Calculator" workbook, ESSENTIALS tab.
   No cyber/security services (MDR/ITDR/SIEM/vulnerability management/awareness
   training) — that's the difference from Secure. Line items reference
   services.js — see README.md before editing. */

BUNDLES.ESSENTIALS = {
  name: 'Essentials',
  available: true,
  tcHours: 2, // Note 3 — Technical Change time, suggested ratio 2/4/4 across bundles
  items: [
    SERVICES.HELPDESK,
    SERVICES.STARTER_LEAVER,
    SERVICES.COMPLIANCE_PORTALS,
    SERVICES.OS_PATCHING,
    SERVICES.SERVER_HEALTH,
    SERVICES.BACKUP_MONITORING,
    SERVICES.VEEAM_NOC,
    SERVICES.CLOUD_BACKUP_365,
    SERVICES.AV_MANAGEMENT,
    SERVICES.CYBER_RESILIENCE_REPORT,
    SERVICES.TC_TIME,
    SERVICES.QBR,
  ],
};
