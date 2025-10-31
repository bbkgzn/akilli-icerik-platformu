# Akıllı İçerik Platformu

Bu depo, çoklu ortam dosyalarını analiz edip sekiz başlıklı bir rapora dönüştüren bir FastAPI ve JS uygulamasıdır.

## Kurulum

1. Depoyu klonlayın.
2. Python bağımlılıklarını yükleyin: `pip install -r requirements.txt`.
3. Ortam değişkenlerini tanımlayın:
   - `OPENAI_API_KEY`: OpenAI API anahtarınız.
   - `GCS_SA_KEY`: Google Cloud Storage servis hesabı anahtarı (JSON).
   - `GCS_BUCKET_NAME`: Raporların depolanacağı GCS bucket adı.

Bu değişkenleri `.env` dosyasına ekleyebilir veya Render gibi bir barındırma ortamında environment secrets olarak ayarlayabilirsiniz.

## Kullanıcı Kaydı ve Erişim Kodu

Uygulama, her kullanıcı için bir API token (X-API-TOKEN) oluşurur. Siteye erişebilmek ve analiz fonksiyonlarını kullanabilmek için bu token gereklidir.

1. Ana sayfada "Yeni Kullanıcı Kaydı" bölümünden bir kullanıcı ID, e‑posta ve şifre girerek kayıt olun.
2. Sistem size bir erişim kodu dönürür; bu kodu **kaydedin**.
3. Daha sonra "Erişim Kodu" alanına bu kodu girerek oturum açabilirsiniz.

## Dosya Yükleme Kısıtlamaları

Maksimum dosya boyutu: 50 MB. Desteklenen uzantılar: mp3, wav, m4a, pdf, docx, pptx, jpg, jpeg, png. Farklı veya daha büyük dosyalar hata verecektir.

## Geliştirme Notları

- Frontend kodu `frontend/` dizininde bulunur.
- Backend kodu `backend/main.py` dosyasındadır.
- Kodda LLM entegrasyonu için OpenAI'nin `openai` kütüphanesi kullanılmıştır.
