/** Prints SET / MISSING / PLACEHOLDER for production env keys (no secret values). */
const keys = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_APP_SECRET",
  "OPENAI_API_KEY",
  "BIZIMHESAP_FIRM_ID",
  "BIZIMHESAP_API_KEY",
  "BIZIMHESAP_FALLBACK_CUSTOMER_ID",
  "BIZIMHESAP_FALLBACK_PRODUCT_ID",
  "FUZZY_MATCH_THRESHOLD",
  "WEBHOOK_VERIFY_TOKEN",
  "ALEX_ALLOWED_PHONES",
];

for (const k of keys) {
  const v = process.env[k];
  let status = "MISSING";
  if (v) {
    status =
      v.includes("REPLACE") || v.startsWith("change-me") ? "PLACEHOLDER" : "SET";
  }
  console.log(`${k}: ${status}`);
}
