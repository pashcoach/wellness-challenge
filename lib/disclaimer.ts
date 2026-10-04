export const DISCLAIMER_VERSION = "2026-10-04-v1";

export interface DisclaimerAcknowledgement {
  disclaimer_version: string;
  health_risk_accepted_at: string | null;
  privacy_accepted_at: string | null;
}

export function hasAcceptedCurrentDisclaimer(
  acknowledgement: DisclaimerAcknowledgement | null
): boolean {
  return Boolean(
    acknowledgement &&
      acknowledgement.disclaimer_version === DISCLAIMER_VERSION &&
      acknowledgement.health_risk_accepted_at &&
      acknowledgement.privacy_accepted_at
  );
}
