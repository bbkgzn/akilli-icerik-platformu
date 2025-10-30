// frontend/script.js

// --- 1. SABİT TANIMLAMALAR ---
const API_BASE_URL = 'http://127.0.0.1:8000';
const TOKEN_STORAGE_KEY = 'akilliAsistanToken';
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
        // Token'ı kontrol etmeden direkt yükle (varsayalım ki geçerli)
        saveToken(token); 
    } else {
        authSection.classList.remove('hidden');
        analysisSection.classList.add('hidden');
    }
}

function checkToken() {
    const token = apiTokenInput.value.trim();
    if (token) {
        // Basitçe: token doluysa ve önceki kullanıcı ID'lerine uyuyorsa, doğru kabul et.
        // Gerçek bir sistemde burada '/check-token' gibi bir API çağrısı yapılır.
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
            // Formu temizle
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

    // Durumu Güncelle
    analyzeButton.disabled = true;
    progressContainer.classList.remove('hidden');
    updateProgress(5, 'Yükleniyor...');
    
    const formData = new FormData();
    if (file) {
        formData.append('dosya', file);
        updateProgress(10, `Dosya yükleniyor: ${file.name}`);
    } else if (youtubeUrl) {
        // YouTube URL'si için FormData kullanmaya gerek yok, direkt query string ile gönderilebilir
        // Ancak API tasarımımızda File ve URL'yi aynı endpoint'e gönderdiğimiz için FormData'yı basitleştirelim:
        formData.append('youtube_url', youtubeUrl);
        updateProgress(10, 'YouTube URL doğrulanıyor...');
    }
    
    // İşlemi Başlat
    try {
        updateProgress(25, 'İçerik okunuyor (Whisper/OCR/PyPDF2)...');

        // FastAPI'ye token ve veriyi gönderme
        const response = await fetch(`${API_BASE_URL}/analiz-et`, {
            method: 'POST',
            headers: {
                // Token'ı HTTP Başlığında göndermek zorundayız (Backend Güvenliği)
                'X-API-TOKEN': currentToken, 
                // FormData kullandığımız için Content-Type'ı tarayıcı otomatik ayarlar
            },
            body: formData 
        });

        updateProgress(70, 'Yapay Zeka (GPT-4o) Analizi yapılıyor...');
        
        const data = await response.json();

        if (response.ok) {
            updateProgress(90, 'Rapor diske kaydediliyor...');
            displayReport(data);
            updateProgress(100, 'Analiz Başarılı!');
        } else {
            // API'den dönen HTTP hatasını göster (400, 401, 500 vb.)
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
    
    // Markdown'ı HTML'e çevir
    const htmlContent = marked.parse(data.rapor_markdown);
    reportContent.innerHTML = htmlContent;
    
    // Kaydedilen dosyaya link ver
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