// frontend/script.js (V7 - Sadece Ses Analizi)

// --- 1. SABİT TANIMLAMALAR ---
const API_BASE_URL = 'https://akilli-icerik-platformu.onrender.com';
const TOKEN_STORAGE_KEY = 'akilliAsistanToken';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
let currentToken = '';

// DOM Elementleri
const authSection = document.getElementById('auth-section');
const analysisSection = document.getElementById('analysis-section');
const reportSection = document.getElementById('report-section');
// historySection V7'de kaldırıldı
const userInfo = document.getElementById('user-info');
const userDisplayId = document.getElementById('user-display-id');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginStatus = document.getElementById('login-status');
const registerStatus = document.getElementById('register-status');
const analysisStatus = document.getElementById('analysis-status');
const fileInput = document.getElementById('file-input');
// youtubeUrlInput V7'de kaldırıldı
const analyzeButton = document.getElementById('analyze-button');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressContainer = document.getElementById('progress-container');
// fetchHistoryButton ve historyList V7'de kaldırıldı

// --- 2. YARDIMCI FONKSİYONLAR ---

function showMessage(element, message, isError = false) {
    if (!element) {
        console.error("Hata: Mesaj elementi bulunamadı.", message);
        return;
    }
    element.textContent = message;
    element.className = isError ? 'status-message status-error' : 'status-message status-success';
    element.style.display = 'block';
    if (!isError) {
        setTimeout(() => { element.style.display = 'none'; }, 5000);
    }
}

function updateProgress(percentage, text) {
    progressBar.style.width = percentage + '%';
    progressText.textContent = `Durum: ${text} (${percentage}%)`;
}

function resetUI() {
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Durum: Bekleniyor...';
    analyzeButton.disabled = false;
    reportSection.classList.add('hidden');
}

// --- 3. YETKİLENDİRME (TOKEN) YÖNETİMİ ---
function saveTokenAndLogin(token, userIdStr) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    currentToken = token;
    
    authSection.classList.add('hidden');
    analysisSection.classList.remove('hidden');
    // historySection V7'de kaldırıldı
    userInfo.classList.remove('hidden');
    userDisplayId.textContent = userIdStr;
    // fetchHistory() V7'de kaldırıldı
}

function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    currentToken = '';
    
    authSection.classList.remove('hidden');
    analysisSection.classList.add('hidden');
    // historySection V7'de kaldırıldı
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

// --- 4. KULLANICI KAYDI VE GİRİŞ (Değişiklik yok) ---

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


// --- 5. ANALİZ AKIŞI (V7 - Sadece Dosya) ---

async function startAnalysis() {
    
    analysisStatus.style.display = 'none';
    resetUI();

    const file = fileInput.files[0];
    
    if (!currentToken) {
        showMessage(loginStatus, 'Lütfen önce giriş yapın.', true);
        logout(); 
        return;
    }

    if (!file) {
        showMessage(analysisStatus, 'Lütfen bir ses dosyası (.mp3, .wav, .m4a) seçin.', true);
        return;
    }
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
        showMessage(analysisStatus, `HATA: Dosya boyutu 50MB'ı geçemez. Yüklenen dosya: ${sizeInMB} MB`, true);
        return;
    }
    
    const formData = new FormData();
    formData.append('dosya', file);

    analyzeButton.disabled = true;
    progressContainer.classList.remove('hidden');
    updateProgress(5, 'Yükleniyor...');
    
    try {
        updateProgress(25, 'Ses dosyası okunuyor (Whisper)...');

        const response = await fetch(`${API_BASE_URL}/analiz-et`, {
            method: 'POST',
            headers: { 'X-API-TOKEN': currentToken },
            body: formData 
        });

        updateProgress(70, 'Yapay Zeka (GPT-4o) Analizi yapılıyor...');
        
        const data = await response.json();

        if (response.ok) {
            updateProgress(100, 'Analiz Başarılı!');
            displayReport(data); // Başarılı, raporu göster
            analyzeButton.disabled = false;
        } else {
            if (response.status === 401) {
                showMessage(loginStatus, `Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.`, true);
                logout();
            } else {
                showMessage(analysisStatus, `API Hatası (${response.status}): ${data.detail || 'Bilinmeyen Hata'}`, true);
                analyzeButton.disabled = false;
                progressContainer.classList.add('hidden');
            }
        }

    } catch (error) {
        showMessage(analysisStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
        console.error('Analiz Ağı Hatası:', error);
        analyzeButton.disabled = false;
        progressContainer.classList.add('hidden');
    }
}


// --- 6. RAPOR GÖSTERİMİ (V7 - Basitleştirildi) ---

function displayReport(data) {
    const reportContent = document.getElementById('report-content');
    const reportLink = document.getElementById('report-link'); // Bu element artık HTML'de yok, ama kalsa da zararı olmaz.
    
    const htmlContent = DOMPurify.sanitize(marked.parse(data.rapor_markdown));
    reportContent.innerHTML = htmlContent;
    
    // GCS linki V7'de yok
    if (reportLink) {
        reportLink.style.display = 'none'; 
    }

    reportSection.classList.remove('hidden');
    
    // Başarılı analizden sonra formu temizle
    fileInput.value = '';
    
    // fetchHistory() V7'de kaldırıldı
}

// fetchHistory() V7'de kaldırıldı

// --- UYGULAMA BAŞLANGICI ---
document.addEventListener('DOMContentLoaded', () => {
    loadTokenAndValidate();
    
    logoutButton.addEventListener('click', logout);
    // fetchHistoryButton V7'de kaldırıldı
    analyzeButton.addEventListener('click', startAnalysis);
});
