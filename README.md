# Akıllı İçerik Platformu (FrameFlow AI)

Bu proje, FastAPI, OpenAI (GPT-4o/Whisper) ve Google Cloud Storage (GCS) kullanarak çoklu ortam içeriklerini (ses, video, PDF, DOCX, görsel) analiz eden ve 8 başlıklı yapılandırılmış öğrenme raporları oluşturan bir web platformudur.

**Canlı Demo URL:** [https://akilli-icerik-platformu.onrender.com/](https://akilli-icerik-platformu.onrender.com/)

---

## 🚀 Temel Özellikler

* **Çoklu Medya Desteği:** Ses dosyaları (.mp3, .m4a), YouTube linkleri, PDF'ler, DOCX/PPTX dosyaları ve görseller (.png, .jpg).
* **Akıllı Raporlama:** GPT-4o kullanarak her içerik için 8 adımlı (Özet, Sözlük, Quiz vb.) tutarlı raporlar.
* **Kalıcı Depolama:** Oluşturulan tüm raporlar, kullanıcıya özel klasörler altında Google Cloud Storage (GCS) üzerinde kalıcı olarak saklanır.
* **Güvenlik:** Token tabanlı kimlik doğrulama (`X-API-TOKEN`) ve güvenli (`bcrypt`) parola saklama.
* **Modern Arayüz:** `localStorage` destekli Token yönetimi ve `DOMPurify` ile XSS korumalı Markdown rapor görüntüleme.

---

## 🛠️ Teknoloji Yığını

* **Backend:** FastAPI (Python)
* **Sunucu:** Uvicorn
* **Dağıtım (Deploy):** Render
* **Kalıcı Depolama:** Google Cloud Storage (GCS)
* **Yapay Zeka:** OpenAI (GPT-4o, Whisper-1)
* **Veritabanı (V2):** Bellek İçi Sözlük (Gelecek Sürüm: PostgreSQL)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API, DOMPurify)

---

## ⚙️ Lokal Kurulum ve Çalıştırma (Development)

Projeyi kendi bilgisayarınızda çalıştırmak için bu adımları izleyin.

### 1. Projeyi Klonlama

```bash
git clone [https://github.com/bbkgzn/akilli-icerik-platformu.git](https://github.com/bbkgzn/akilli-icerik-platformu.git)
cd akilli-icerik-platformu