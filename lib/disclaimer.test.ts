import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DISCLAIMER_VERSION,
  hasAcceptedCurrentDisclaimer,
} from "./disclaimer";

const homeSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
const componentSource = readFileSync(
  resolve(process.cwd(), "components/ParticipantDisclaimer.tsx"),
  "utf8"
);
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migration-participant-disclaimer.sql"),
  "utf8"
);

test("only a complete acknowledgement of the current version is accepted", () => {
  assert.equal(hasAcceptedCurrentDisclaimer(null), false);
  assert.equal(
    hasAcceptedCurrentDisclaimer({
      disclaimer_version: "outdated-version",
      health_risk_accepted_at: "2026-10-04T12:00:00Z",
      privacy_accepted_at: "2026-10-04T12:00:00Z",
    }),
    false
  );
  assert.equal(
    hasAcceptedCurrentDisclaimer({
      disclaimer_version: DISCLAIMER_VERSION,
      health_risk_accepted_at: "2026-10-04T12:00:00Z",
      privacy_accepted_at: null,
    }),
    false
  );
  assert.equal(
    hasAcceptedCurrentDisclaimer({
      disclaimer_version: DISCLAIMER_VERSION,
      health_risk_accepted_at: "2026-10-04T12:00:00Z",
      privacy_accepted_at: "2026-10-04T12:00:00Z",
    }),
    true
  );
});

test("the app blocks participants at the disclaimer before team setup and dashboard", () => {
  const disclaimerGate = homeSource.indexOf("<ParticipantDisclaimer");
  const teamGate = homeSource.indexOf("if (!teamChecked)");
  const dashboard = homeSource.indexOf("<Dashboard");

  assert.ok(disclaimerGate > -1);
  assert.ok(teamGate > disclaimerGate);
  assert.ok(dashboard > teamGate);
});

test("the acknowledgement requires separate health-risk and privacy checkboxes", () => {
  assert.match(componentSource, /id="health-risk-acknowledgement"/);
  assert.match(componentSource, /id="privacy-acknowledgement"/);
  assert.match(componentSource, /disabled=\{[^}]*!healthAccepted[^}]*!privacyAccepted[^}]*\}/s);
  assert.match(componentSource, /Accept and continue/);
});

test("acknowledgements are private, server-timestamped, and required for logging", () => {
  assert.match(migration, /create table[^;]*participant_acknowledgements/is);
  assert.match(migration, /health_risk_accepted_at timestamptz not null/i);
  assert.match(migration, /privacy_accepted_at timestamptz not null/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /values \(auth\.uid\(\), p_version, now\(\), now\(\)/i);
  assert.match(migration, /public\.has_current_disclaimer_acknowledgement\(\)/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*participant_acknowledgements/i);
});
