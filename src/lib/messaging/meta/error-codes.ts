/**
 * Meta WhatsApp Cloud API error codes → plain English + retry policy.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 *
 * retryable = true  → temporary (rate limit, Meta outage): queue retries with backoff.
 * retryable = false → permanent (bad number, template problem, auth): never retried.
 */
export type MetaErrorInfo = { friendly: string; retryable: boolean };

export const META_ERROR_CODES: Record<string, MetaErrorInfo> = {
  // ── Auth / permissions ──
  "0": { friendly: "Meta could not authenticate the app. Check the access token.", retryable: false },
  "3": { friendly: "This app doesn't have the capability for this API call. Check the app's WhatsApp product setup.", retryable: false },
  "10": { friendly: "Permission denied. The token is missing whatsapp_business_messaging / whatsapp_business_management permission.", retryable: false },
  "190": { friendly: "The access token has expired or is invalid. Generate a permanent System User token and update WA_ACCESS_TOKEN.", retryable: false },
  "200": { friendly: "Permission denied for this WhatsApp Business Account. Check the token's assets in Business Settings.", retryable: false },

  // ── Throttling (temporary) ──
  "4": { friendly: "Too many API calls to Meta right now. We'll retry shortly.", retryable: true },
  "80007": { friendly: "WhatsApp Business Account rate limit reached. We'll retry shortly.", retryable: true },
  "130429": { friendly: "Sending too fast for this phone number (throughput limit). We'll slow down and retry.", retryable: true },
  "131056": { friendly: "Too many messages to the same person in a short time. We'll retry in a bit.", retryable: true },
  "131048": { friendly: "Meta limited sending because of spam signals (quality rating). Pause and review your audience and template.", retryable: false },

  // ── Meta-side temporary problems ──
  "1": { friendly: "Meta returned an unknown error. We'll retry.", retryable: true },
  "2": { friendly: "Meta's service is temporarily unavailable. We'll retry.", retryable: true },
  "131000": { friendly: "Meta had an internal problem sending this message. We'll retry.", retryable: true },
  "131016": { friendly: "WhatsApp service is temporarily overloaded. We'll retry.", retryable: true },
  "133004": { friendly: "Meta's server is temporarily unavailable. We'll retry.", retryable: true },

  // ── Recipient problems (permanent) ──
  "131030": { friendly: "This number isn't added as a test recipient in Meta yet. Add it under WhatsApp → API Setup → 'To' in the Meta dashboard.", retryable: false },
  "131026": { friendly: "Message undeliverable. The number may not be on WhatsApp, may be using an old app version, or hasn't accepted the latest terms.", retryable: false },
  "131021": { friendly: "Can't send a message to your own business number.", retryable: false },
  "131047": { friendly: "More than 24 hours have passed since this contact last messaged you. Send an approved template instead of free text.", retryable: false },
  "131049": { friendly: "Meta chose not to deliver this marketing message to keep engagement healthy (per-user marketing limit). Try again another day.", retryable: false },
  "131050": { friendly: "This person has stopped marketing messages from your business on WhatsApp.", retryable: false },
  "131051": { friendly: "Unsupported message type.", retryable: false },
  "131052": { friendly: "Couldn't download media from the contact's message.", retryable: false },
  "131053": { friendly: "Couldn't upload the media file.", retryable: false },

  // ── Request / parameter problems (permanent) ──
  "100": { friendly: "Invalid parameter in the request to Meta. Check the phone number ID, template name and language.", retryable: false },
  "131008": { friendly: "A required parameter is missing.", retryable: false },
  "131009": { friendly: "A parameter value is invalid (for example, a malformed phone number).", retryable: false },

  // ── Template problems (permanent) ──
  "132000": { friendly: "The number of variables sent doesn't match the template. Check the variable mapping.", retryable: false },
  "132001": { friendly: "Template not found for this language on this WhatsApp account. Sync templates and check the language code.", retryable: false },
  "132005": { friendly: "Message too long after filling in the variables.", retryable: false },
  "132007": { friendly: "Template content violates WhatsApp's formatting policy.", retryable: false },
  "132012": { friendly: "A variable value has the wrong format for this template.", retryable: false },
  "132015": { friendly: "This template is PAUSED by Meta due to low quality. Edit it or use another template.", retryable: false },
  "132016": { friendly: "This template is DISABLED by Meta. Create a new template.", retryable: false },
  "132068": { friendly: "Template flow is blocked.", retryable: false },

  // ── Account / number problems (permanent) ──
  "368": { friendly: "This WhatsApp account is temporarily blocked for policy violations. Check Business Support Home.", retryable: false },
  "131031": { friendly: "This WhatsApp Business Account is locked. Check Business Support Home in Meta.", retryable: false },
  "131042": { friendly: "Billing problem on the WhatsApp Business Account. Add or fix the payment method in Meta Business Settings.", retryable: false },
  "131045": { friendly: "The phone number isn't registered with the Cloud API yet.", retryable: false },
  "133010": { friendly: "The business phone number isn't registered with WhatsApp Cloud API.", retryable: false },
  "135000": { friendly: "Generic user error from Meta.", retryable: false },
};

export function describeMetaError(code: string | number | undefined, httpStatus?: number): MetaErrorInfo {
  const key = code === undefined ? "" : String(code);
  if (META_ERROR_CODES[key]) return META_ERROR_CODES[key];
  // Unknown code: let HTTP status decide. 5xx / 429 are temporary, anything else is not.
  if (httpStatus && (httpStatus >= 500 || httpStatus === 429)) {
    return { friendly: "Meta is temporarily unavailable. We'll retry.", retryable: true };
  }
  return { friendly: "Meta rejected the request.", retryable: false };
}
