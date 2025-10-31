// frontend/script.js (V2 Güvenlik Güncellemesi)

// --- 1. SABİT TANIMLAMALAR ---
const API_BASE_URL = 'https://akilli-icerik-platformu.onrender.com';
const TOKEN_STORAGE_KEY = 'akilliAsistanToken';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (Tespit 2.1)
let currentToken = '';

// DOM Elementleri
const authSection = document.getElementById('auth-section');
const analysisSection = document.getElementById('analysis-section');
const reportSection = document.getElementById('report-section');
const authStatus = document.getElementById('auth-status');
const registerStatus = document.getElementById('register-status');
const apiTokenInput = document.getElementById('api-token');
const fileInput = document.getElementById('file-input');
const youtubeUrlInput = document.getElementById('youtube-url-input');
const analyzeButton = document.getElementById('analyze-button');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressContainer = document.getElementById('progress-container');
const registerForm = document.getElementById('register-form');


// --- 2. YARDIMCI FONKSİYONLAR ---

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'status-message status-error' : 'status-message status-success';
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function updateProgress(percentage, text) {
    progressBar.style.width = percentage + '%';
    progressText.textContent = `Durum: ${text} (${percentage}%)`;
}

function resetUI() {
    reportSection.classList.add('hidden');
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Durum: Bekleniyor...';
    analyzeButton.disabled = false;
    fileInput.value = '';
    youtubeUrlInput.value = '';
}


// --- 3. YETKİLENDİRME (TOKEN) YÖNETİMİ ---

function saveToken(token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    currentToken = token;
    apiTokenInput.value = token;
    authSection.classList.add('hidden');
    analysisSection.classList.remove('hidden');
    showMessage(authStatus, `Token doğrulandı. Hoş geldiniz!`, false);
}

function loadToken() {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
        // V2 Notu (Tespit 2.2): Bu hala "gerçek" bir doğrulama değil.
        // Sadece token'ın varlığını kontrol eder.
        // Adım 3'te buraya bir /me endpoint'i ekleyeceğiz.
        saveToken(token); 
    } else {
        authSection.classList.remove('hidden');
        analysisSection.classList.add('hidden');
    }
}

function checkToken() {
    const token = apiTokenInput.value.trim();
    if (token) {
        saveToken(token);
    } else {
        showMessage(authStatus, 'Lütfen bir Token girin.', true);
    }
}

// --- 4. KULLANICI KAYDI ---

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetUI();
    
    const user_id = document.getElementById('reg-id').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            saveToken(data.token);
            showMessage(registerStatus, `Kayıt başarılı! Yeni Token'ınız kaydedildi.`, false);
            registerForm.reset(); 
        } else {
            showMessage(registerStatus, `Kayıt Hatası: ${data.detail || data.message || 'Bilinmeyen Hata'}`, true);
        }

    } catch (error) {
        showMessage(registerStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
        console.error('Kayıt Ağı Hatası:', error);
    }
});


// --- 5. ANALİZ AKIŞI ---

async function startAnalysis() {
    resetUI();
    const file = fileInput.files[0];
    const youtubeUrl = youtubeUrlInput.value.trim();
    
    if (!currentToken) {
        showMessage(authStatus, 'Lütfen önce Token girişi yapın.', true);
        return;
    }

    if (!file && !youtubeUrl) {
        showMessage(authStatus, 'Lütfen bir dosya seçin veya YouTube URL’si girin.', true);
        return;
    }

    if (file && youtubeUrl) {
        showMessage(authStatus, 'Lütfen sadece BİR içerik kaynağı seçin (Dosya VEYA URL).', true);
        return;
    }

    // --- YENİ (V2) DOSYA BOYUTU KONTROLÜ (Tespit 2.1) ---
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
        showMessage(authStatus, `HATA: Dosya boyutu 50MB'ı geçemez. Yüklenen dosya: ${sizeInMB} MB`, true);
        resetUI(); // UI'ı temizle ama token'ı tut
        return; // Fonksiyonu durdur
    }
    // --- KONTROL SONU ---


    // Durumu Güncelle
    analyzeButton.disabled = true;
    progressContainer.classList.remove('hidden');
    updateProgress(5, 'Yükleniyor...');
    
    const formData = new FormData();
    if (file) {
        formData.append('dosya', file);
        updateProgress(10, `Dosya yükleniyor: ${file.name}`);
    } else if (youtubeUrl) {
        formData.append('youtube_url', youtubeUrl);
        updateProgress(10, 'YouTube URL doğrulanıyor...');
    }
    
    // İşlemi Başlat
    try {
        updateProgress(25, 'İçerik okunuyor (Whisper/OCR/PyPDF2)...');

        const response = await fetch(`${API_BASE_URL}/analiz-et`, {
            method: 'POST',
            headers: {
                'X-API-TOKEN': currentToken, 
            },
            body: formData 
        });

        updateProgress(70, 'Yapay Zeka (GPT-4o) Analizi yapılıyor...');
        
        const data = await response.json();

        if (response.ok) {
            updateProgress(90, 'Rapor buluta kaydediliyor...');
            displayReport(data);
            updateProgress(100, 'Analiz Başarılı!');
        } else {
            showMessage(authStatus, `API Hatası (${response.status}): ${data.detail || 'Bilinmeyen Hata'}`, true);
            resetUI();
        }

    } catch (error) {
        showMessage(authStatus, `Ağ Hatası: Sunucuya ulaşılamadı. Lütfen sunucunun çalıştığından emin olun.`, true);
        console.error('Analiz Ağı Hatası:', error);
        resetUI();
    }
}


// --- 6. RAPOR GÖSTERİMİ ---

function displayReport(data) {
    const reportContent = document.getElementById('report-content');
    const reportLink = document.getElementById('report-link');
    
    // --- YENİ (V2) XSS GÜVENLİK DÜZELTMESİ (Tespit 2.6) ---
    // Markdown'ı HTML'e çevir ve DOMPurify ile temizle
    const htmlContent = DOMPurify.sanitize(marked.parse(data.rapor_markdown));
    reportContent.innerHTML = htmlContent;
    // --- DÜZELTME SONU ---
    
    if (data.dosya_url) {
        reportLink.href = data.dosya_url;
        reportLink.textContent = `Raporu İndir: ${data.dosya_url.split('/').pop()}`;
    } else {
         reportLink.textContent = `Rapor kaydedilemedi (Sunucu Hatası), sadece aşağıda görüntüleniyor.`;
         reportLink.href = '#';
    }

    reportSection.classList.remove('hidden');
}


// --- UYGULAMA BAŞLANGICI ---
document.addEventListener('DOMContentLoaded', loadToken);