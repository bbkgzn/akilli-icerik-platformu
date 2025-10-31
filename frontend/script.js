// frontend/script.js (V4 Final - Kesin Hata Gösterimi Düzeltmeli)

// --- 1. SABİT TANIMLAMALAR ---
const API_BASE_URL = 'https://akilli-icerik-platformu.onrender.com';
const TOKEN_STORAGE_KEY = 'akilliAsistanToken';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
let currentToken = '';

// DOM Elementleri
const authSection = document.getElementById('auth-section');
const analysisSection = document.getElementById('analysis-section');
const reportSection = document.getElementById('report-section');
const historySection = document.getElementById('history-section');
const userInfo = document.getElementById('user-info');
const userDisplayId = document.getElementById('user-display-id');
const logoutButton = document.getElementById('logout-button');

// Formlar
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginStatus = document.getElementById('login-status');
const registerStatus = document.getElementById('register-status');
// V4 YENİ: Analiz Hata Mesajı Elementi
const analysisStatus = document.getElementById('analysis-status');

// Analiz Elementleri
const fileInput = document.getElementById('file-input');
const youtubeUrlInput = document.getElementById('youtube-url-input');
const analyzeButton = document.getElementById('analyze-button');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressContainer = document.getElementById('progress-container');

// Geçmiş Raporlar Elementleri
const fetchHistoryButton = document.getElementById('fetch-history-button');
const historyList = document.getElementById('history-list');

// --- 2. YARDIMCI FONKSİYONLAR ---

function showMessage(element, message, isError = false) {
    if (!element) {
        console.error("Hata: Mesaj elementi bulunamadı.", message);
        return;
    }
    element.textContent = message;
    element.className = isError ? 'status-message status-error' : 'status-message status-success';
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function updateProgress(percentage, text) {
    progressBar.style.width = percentage + '%';
    progressText.textContent = `Durum: ${text} (${percentage}%)`;
}

// V4 DÜZELTME: resetUI artık giriş alanlarını temizlemiyor, sadece süreci sıfırlıyor.
function resetUI() {
    reportSection.classList.add('hidden');
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Durum: Bekleniyor...';
    analyzeButton.disabled = false;
    // Giriş alanları (fileInput, youtubeUrlInput) burada SIFIRLANMAZ.
}

// --- 3. YETKİLENDİRME (TOKEN) YÖNETİMİ ---
function saveTokenAndLogin(token, userIdStr) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    currentToken = token;
    
    authSection.classList.add('hidden');
    analysisSection.classList.remove('hidden');
    historySection.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userDisplayId.textContent = userIdStr;
    fetchHistory(); // Girişte geçmişi otomatik getir
}

function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    currentToken = '';
    
    authSection.classList.remove('hidden');
    analysisSection.classList.add('hidden');
    historySection.classList.add('hidden');
    reportSection.classList.add('hidden');
    userInfo.classList.add('hidden');
    userDisplayId.textContent = '...';
    
    loginForm.reset();
    registerForm.reset();
}

async function loadTokenAndValidate() {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
        authSection.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'GET',
            headers: { 'X-API-TOKEN': token }
        });

        if (response.ok) {
            const user = await response.json();
            saveTokenAndLogin(token, user.user_id_str);
        } else {
            logout();
        }
    } catch (error) {
        console.error("Token doğrulama hatası:", error);
        logout();
    }
}

// --- 4. KULLANICI KAYDI VE GİRİŞ ---

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetUI();
    
    const user_id = document.getElementById('reg-id').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id_str: user_id, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            saveTokenAndLogin(data.access_token, user_id);
            showMessage(registerStatus, `Kayıt başarılı! Giriş yapıldı.`, false);
            registerForm.reset(); 
        } else {
            showMessage(registerStatus, `Kayıt Hatası: ${data.detail || 'Bilinmeyen Hata'}`, true);
        }
    } catch (error) {
        showMessage(registerStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetUI();
    
    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;

    const formData = new URLSearchParams();
    formData.append('username', loginId); 
    formData.append('password', password);

    try {
        const response = await fetch(`${API_BASE_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            saveTokenAndLogin(data.access_token, loginId);
            showMessage(loginStatus, `Giriş başarılı! Hoş geldiniz.`, false);
            loginForm.reset();
        } else {
            showMessage(loginStatus, `Giriş Hatası: ${data.detail || 'Geçersiz Kullanıcı ID veya Şifre'}`, true);
        }
    } catch (error) {
        showMessage(loginStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
    }
});


// --- 5. ANALİZ AKIŞI (V4 HATA GÖSTERİMİ DÜZELTMELİ) ---

async function startAnalysis() {
    
    // 1. Girdileri Güvenle Oku
    const file = fileInput.files[0];
    const youtubeUrl = youtubeUrlInput.value.trim();
    
    // 2. Erken Çıkış Kontrolleri
    if (!currentToken) {
        showMessage(loginStatus, 'Lütfen önce giriş yapın.', true); // Bu doğru, girişle ilgili
        logout(); 
        return;
    }
    if (!file && !youtubeUrl) {
        // V4 DÜZELTME: Hata mesajını AN ALİZ alanına gönder
        showMessage(analysisStatus, 'Lütfen bir dosya seçin veya YouTube URL’si girin.', true);
        return;
    }
    if (file && youtubeUrl) {
        showMessage(analysisStatus, 'Lütfen sadece BİR içerik kaynağı seçin (Dosya VEYA URL).', true);
        return;
    }
    // Dosya Boyutu Kontrolü
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
        showMessage(analysisStatus, `HATA: Dosya boyutu 50MB'ı geçemez. Yüklenen dosya: ${sizeInMB} MB`, true);
        return;
    }
    
    // 3. Veriyi FormData'ya Sakla
    const formData = new FormData();
    if (file) {
        formData.append('dosya', file);
    } else if (youtubeUrl) {
        formData.append('youtube_url', youtubeUrl);
    }

    // 4. İlerlemeyi Başlat (Artık resetUI burada değil)
    analyzeButton.disabled = true;
    progressContainer.classList.remove('hidden');
    updateProgress(5, 'Yükleniyor...');
    analysisStatus.style.display = 'none'; // Eski hataları temizle

    
    try {
        updateProgress(25, 'İçerik okunuyor...');

        const response = await fetch(`${API_BASE_URL}/analiz-et`, {
            method: 'POST',
            headers: { 'X-API-TOKEN': currentToken },
            body: formData 
        });

        updateProgress(70, 'Yapay Zeka (GPT-4o) Analizi yapılıyor...');
        
        const data = await response.json();

        if (response.ok) {
            updateProgress(90, 'Rapor buluta ve veritabanına kaydediliyor...');
            displayReport(data); // Başarılı, raporu göster
            updateProgress(100, 'Analiz Başarılı!');
            resetUI(); // Sadece BAŞARI durumunda süreci sıfırla
        } else {
            // API'den dönen HTTP hatasını göster
            if (response.status === 401) {
                showMessage(loginStatus, `Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.`, true);
                logout();
            } else {
                // V4 DÜZELTME: HATAYI DOĞRU YERDE GÖSTER
                showMessage(analysisStatus, `API Hatası (${response.status}): ${data.detail || 'Bilinmeyen Hata'}`, true);
                resetUI(); // Sadece hata durumunda UI'yı sıfırla
            }
        }

    } catch (error) {
        // V4 DÜZELTME: AĞ HATASINI DOĞRU YERDE GÖSTER
        showMessage(analysisStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
        console.error('Analiz Ağı Hatası:', error);
        resetUI(); // Hata durumunda UI'yı sıfırla
    }
}


// --- 6. RAPOR GÖSTERİMİ VE GEÇMİŞ ---

function displayReport(data) {
    const reportContent = document.getElementById('report-content');
    const reportLink = document.getElementById('report-link');
    
    const htmlContent = DOMPurify.sanitize(marked.parse(data.rapor_markdown));
    reportContent.innerHTML = htmlContent;
    
    if (data.dosya_url) {
        reportLink.href = data.dosya_url;
        reportLink.textContent = `Raporu İndir: ${data.dosya_url.split('/').pop()}`;
    } else {
         reportLink.textContent = `Rapor kaydedilemedi...`;
         reportLink.href = '#';
    }

    reportSection.classList.remove('hidden');
    
    // V4 DÜZELTME: Sadece BAŞARILI analizden sonra formları temizle
    fileInput.value = '';
    youtubeUrlInput.value = '';
    
    fetchHistory(); 
}

async function fetchHistory() {
    if (!currentToken) return;

    historyList.innerHTML = '<li>Yükleniyor...</li>'; 

    try {
        const response = await fetch(`${API_BASE_URL}/reports/my-reports`, {
            method: 'GET',
            headers: { 'X-API-TOKEN': currentToken }
        });

        if (response.ok) {
            const reports = await response.json();
            historyList.innerHTML = '';

            if (reports.length === 0) {
                historyList.innerHTML = '<li>Henüz kayıtlı raporunuz bulunmuyor.</li>';
            } else {
                reports.reverse().forEach(report => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = report.gcs_url;
                    a.target = '_blank';
                    
                    const date = new Date(report.created_at);
                    const formattedDate = `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
                    
                    a.textContent = `${report.file_name} (${formattedDate})`;
                    li.appendChild(a);
                    historyList.appendChild(li);
                });
            }
        } else {
             historyList.innerHTML = '<li>Raporlar yüklenemedi.</li>';
        }
    } catch (error) {
        console.error("Geçmiş raporları yükleme hatası:", error);
        historyList.innerHTML = '<li>Raporlar yüklenemedi.</li>';
    }
}


// --- UYGULAMA BAŞLANGICI ---
document.addEventListener('DOMContentLoaded', () => {
    loadTokenAndValidate();
    
    logoutButton.addEventListener('click', logout);
    fetchHistoryButton.addEventListener('click', fetchHistory);
    analyzeButton.addEventListener('click', startAnalysis);
});