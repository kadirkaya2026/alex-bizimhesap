/**
 * WHATSAPP_ACCESS_TOKEN Graph API doğrulaması.
 * Kullanım: railway run -- node scripts/verify-whatsapp-token.mjs
 * veya: WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... node scripts/verify-whatsapp-token.mjs
 */
const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

if (!token || !phoneId) {
  console.error("WHATSAPP_ACCESS_TOKEN ve WHATSAPP_PHONE_NUMBER_ID gerekli.");
  process.exit(1);
}

const url = `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name`;

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

const body = await response.text();

if (!response.ok) {
  console.error(
    JSON.stringify({
      ok: false,
      status: response.status,
      message:
        response.status === 401
          ? "WHATSAPP_ACCESS_TOKEN geçersiz — Meta panelden yeni kalıcı token alın"
          : "WhatsApp Graph API hatası",
      bodyPreview: body.slice(0, 200),
    }),
  );
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  parsed = { raw: body.slice(0, 200) };
}

console.log(
  JSON.stringify({
    ok: true,
    status: response.status,
    phoneNumberId: phoneId,
    tokenLength: token.length,
    displayPhoneNumber: parsed.display_phone_number ?? null,
    verifiedName: parsed.verified_name ?? null,
  }),
);
