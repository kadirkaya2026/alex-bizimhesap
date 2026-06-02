# Faz 0 — Ön koşullar

Kod deploy edilmeden önce aşağıdaki hesapları hazırlayın.

## 1. Bizimhesap API

1. Pilot firma için Bizimhesap destekten API erişimi isteyin.
2. `FirmID` ve API token alın.
3. Dokümantasyon: https://apidocs.bizimhesap.com/addinvoice
4. Yerel test:

```bash
cp .env.example .env
# BIZIMHESAP_FIRM_ID ve BIZIMHESAP_API_KEY doldurun
npm run test:addinvoice
```

## 2. Meta WhatsApp Cloud API

1. https://developers.facebook.com — Business uygulaması
2. **Yeni telefon numarası** (Zyreos Alex numarasına dokunmayın)
3. Kalıcı access token + Phone Number ID
4. Webhook (deploy sonrası): `https://<railway-domain>/webhooks/whatsapp`
5. Verify token = `.env` içindeki `WEBHOOK_VERIFY_TOKEN`
6. Subscribe: `messages`

## 3. OpenAI

- API key: https://platform.openai.com
- Model: `gpt-4o-mini` (varsayılan)

## 4. Railway

1. Yeni proje (Zyreos projesi değil)
2. PostgreSQL eklentisi
3. GitHub repo bağlantısı veya `railway up`
4. Tüm `.env.example` değişkenlerini Variables olarak ekleyin

## 5. GitHub

```bash
git init
git remote add origin <REPO_URL>
git push -u origin main
```
