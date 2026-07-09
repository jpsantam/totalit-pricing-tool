/* ===== totalIT SECURE bundle =====
   Source of truth: "Copy of totalIT Bundles Calculator" workbook, SECURE tab.
   Line items reference services.js — see README.md before editing. */

BUNDLES.SECURE = {
  name: 'Secure',
  available: true,
  tcHours: 4, // Note 3 — Technical Change time, suggested ratio 2/4/4 across bundles
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
    SERVICES.THIRD_PARTY_PATCHING,
    SERVICES.THIRD_PARTY_VULN_MGMT,
    SERVICES.MDR,
    SERVICES.ITDR,
    SERVICES.SIEM,
    SERVICES.CYBER_MGMT_TECHDEV,
    SERVICES.SECURITY_TRAINING,
    SERVICES.QUARTERLY_ROADMAP,
  ],
};
