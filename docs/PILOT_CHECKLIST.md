# Pilot go-live checklist

Pilot müşteri için Alex 2 canlı öncesi/sonrası kontrol listesi.

## Altyapı

- [ ] Railway yeşil deploy
- [ ] `GET /health` → 200, `db: up`
- [ ] Postgres migrate tamamlandı
- [ ] `npm run db:seed` çalıştırıldı
- [ ] Meta webhook doğrulandı (yeşil tik)
- [ ] Alex 2 WhatsApp numarası pilot müşteriye verildi (Zyreos numarası değil)

## Güvenlik

- [ ] `ALEX_ALLOWED_PHONES` sadece yetkili numaralar
- [ ] `SKIP_WHATSAPP_SIGNATURE=false` production'da
- [ ] API anahtarları repoda yok

## Test senaryoları

| # | Senaryo | Beklenen | OK |
|---|---------|----------|-----|
| 1 | Yetkisiz numara mesaj atar | "yetkili değil" | [ ] |
| 2 | eKatalox PDF linki gönderilir | Önizleme (cari, kalem, toplam) | [ ] |
| 3 | WhatsApp PDF dosyası gönderilir | Aynı önizleme | [ ] |
| 4 | ONAYLA | BH guid + URL, DB `posted` | [ ] |
| 5 | Aynı sipariş tekrar | "zaten fişlendi" | [ ] |
| 6 | İPTAL | İşlem iptal, BH çağrısı yok | [ ] |
| 7 | BH bilinmeyen ürün/hata | Türkçe hata mesajı | [ ] |

## Operasyon

- [ ] eKatalox müşteri akışı değişmedi (PDF + wa.me)
- [ ] Sahip ödeme/stok kontrolünden sonra Alex'e iletiyor
- [ ] PDF 24 saat sınırı bilgisi paylaşıldı

## Rollback

- [ ] Meta webhook callback geçici kapatılabilir
- [ ] Railway önceki deployment'a dönülebilir
- [ ] Zyreos Alex etkilenmedi
