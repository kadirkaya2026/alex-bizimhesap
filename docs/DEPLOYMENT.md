# Railway deploy runbook

## 1. Proje oluşturma

1. [railway.app](https://railway.app) → **New Project** (Zyreos Alex projesi değil).
2. **New → GitHub Repo** veya CLI ile deploy.
3. **Add Plugin → PostgreSQL**.
4. Web servisinde **Variables** → Postgres `DATABASE_URL` referansı ekleyin.

## 2. Ortam değişkenleri

`.env.example` dosyasındaki tüm alanları Railway Variables olarak ekleyin:

| Variable | Zorunlu | Not |
|----------|---------|-----|
| `DATABASE_URL` | Evet | Postgres referansı |
| `WEBHOOK_VERIFY_TOKEN` | Evet | `openssl rand -hex 32` |
| `WHATSAPP_ACCESS_TOKEN` | Evet (prod) | Meta kalıcı token |
| `WHATSAPP_PHONE_NUMBER_ID` | Evet | Alex 2 numarası |
| `WHATSAPP_APP_SECRET` | Evet | İmza doğrulama |
| `OPENAI_API_KEY` | Evet | PDF parse |
| `BIZIMHESAP_FIRM_ID` | Evet | Pilot firma |
| `BIZIMHESAP_API_KEY` | Evet | API token |
| `ALEX_ALLOWED_PHONES` | Evet | `+905...,+905...` |
| `TENANT_NAME` | Hayır | Seed için |
| `SKIP_WHATSAPP_SIGNATURE` | Hayır | Sadece local `true` |

`NODE_ENV=production` ve `PORT` Railway tarafından set edilir.

## 3. Build ve start

Repo kökünde `Dockerfile` kullanın:

- Railway → Service → Settings → Builder: **Dockerfile**
- Veya Nixpacks ile `npm run build` + start command:
  - Build: `npm ci && npm run build && npx prisma generate`
  - Start: `npx prisma migrate deploy && npm start`

## 4. Domain

1. Service → **Networking** → **Generate Domain**
2. Test: `curl https://<domain>/health` → `"ok": true`, `"db": "up"`

## 5. Veritabanı seed (ilk deploy)

Railway shell veya tek seferlik job:

```bash
npm run db:seed
```

Veya yerelde production `DATABASE_URL` ile:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

## 6. Meta WhatsApp webhook

1. [developers.facebook.com](https://developers.facebook.com) → App → WhatsApp → Configuration
2. Callback URL: `https://<railway-domain>/webhooks/whatsapp`
3. Verify token: Railway `WEBHOOK_VERIFY_TOKEN` ile **aynı**
4. Webhook fields: `messages`
5. **Zyreos Alex webhook URL'sine dokunmayın** — farklı Phone Number ID

## 7. GitHub push

```bash
git init
git add .
git commit -m "feat: alex-bizimhesap mvp"
git branch -M main
git remote add origin <GITHUB_URL>
git push -u origin main
```

Railway otomatik deploy tetikler.

## 8. Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Webhook verify fail | Token eşleşmesi, HTTPS domain |
| 401 POST webhook | `WHATSAPP_APP_SECRET`, ham body imzası |
| DB down | `DATABASE_URL`, migrate deploy logları |
| GPT hata | `OPENAI_API_KEY`, model adı |
| BH hata | `npm run test:addinvoice` ile payload test |

## 9. Loglar

Railway → Deployments → View Logs — `alex-bizimhesap started`, inbound işleme hataları.
