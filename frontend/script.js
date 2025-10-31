// frontend/script.js (V2 - Kalıcı PostgreSQL Veritabanı Uyumlu)

// --- 1. SABİT TANIMLAMALAR ---
const API_BASE_URL = 'https://akilli-icerik-platformu.onrender.com';
const TOKEN_STORAGE_KEY = 'akilliAsistanToken';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (Tespit 2.1)
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

/**
 * Başarılı bir giriş/kayıt sonrası UI'ı güceller.
 * @param {string} token - Alınan yeni token
 * @param {string} userIdStr - Kullanıcının ID'si (örn: ali_yilmaz)
 */
function saveTokenAndLogin(token, userIdStr) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    currentToken = token;

    // Arayüzü güncelle
    authSection.classList.add('hidden');
    analysisSection.classList.remove('hidden');
    historySection.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userDisplayId.textContent = userIdStr;
}

/**
 * Çıkış yapma işlemi.
 */
function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    currentToken = '';

    // Arayüzü sıfırla
    authSection.classList.remove('hidden');
    analysisSection.classList.add('hidden');
    historySection.classList.add('hidden');
    reportSection.classList.add('hidden');
    userInfo.classList.add('hidden');
    userDisplayId.textContent = '...';

    // Formları temizle (opsiyonel)
    loginForm.reset();
    registerForm.reset();
}

/**
 * Sayfa yüklendiğinde token'ı doğrular (Tespit 2.2 & 3.2 Çözü̇mü)
 * Artık /users/me endpoint'ini kullanarak GERÇEK doğrulama yapar.
 */
async function loadTokenAndValidate() {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
        // Token yoksa, giriş ekranını göster
        authSection.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'GET',
            headers: {
                'X-API-TOKEN': token
            }
        });

        if (response.ok) {
            const user = await response.json();
            // Token geçerli, kullanıcıyı giriş yapmış olarak ayarla
            saveTokenAndLogin(token, user.user_id_str);
        } else {
            // Token geçersiz (süre dolmuş veya sahte)
            logout();
        }
    } catch (error) {
        console.error("Token doğrulama hatası:", error);
        logout(); // Sunucuya ulaşılamazsa da çıkış yap
    }
}

// --- 4. KULLANICI KAYDI VE GİRİŞ (YENİ V2) ---

// A. YENİ KAYIT FORMU (/register)
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
            // Başarılı kayıt sonrası (dönen token: data.access_token)
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

// B. GİRİŞ YAP FORMU (/token)
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetUI();

    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;

    // FastAPI'nin OAuth2 formu 'username' ve 'password' bekler
    const formData = new URLSearchParams();
    formData.append('username', loginId); // Biz 'username' olarak 'user_id_str' kullanıyoruz
    formData.append('password', password);

    try {
        const response = await fetch(`${API_BASE_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Başarılı giriş (dönen token: data.access_token)
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

// --- 5. ANALİZ AKIŞI (V2) ---

async function startAnalysis() {
    // Note: resetUI() çağrısı başta değil; inputları okumadan once silinmemeli.

    const file = fileInput.files[0];
    const youtubeUrl = youtubeUrlInput.value.trim();

    if (!currentToken) {
        showMessage(loginStatus, 'Lütfen önce giriş yapın.', true);
        logout(); // Token yoksa güvenlik için çıkış yap
        return;
    }

    if (!file && !youtubeUrl) {
        showMessage(loginStatus, 'Lütfen bir dosya seçin veya YouTube URL’si girin.', true);
        return;
    }

    if (file && youtubeUrl) {
        showMessage(loginStatus, 'Lütfen sadece BİR içerik kaynağı seçin (Dosya VEYA URL).', true);
        return;
    }

    // Dosya Boyutu Kontrolü (Tespit 2.1)
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
        const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
        showMessage(loginStatus, `HATA: Dosya boyutu 50MB'\u0131 geçemez. Yüklenen dosya: ${sizeInMB} MB`, true);
        return;
    }

    // Şimdi tüm kontrollerden sonra arayüzü sıfırla
    resetUI();

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

    try {
        updateProgress(25, 'İçerik okunuyor (Whisper/OCR/PyPDF2)...');

        const response = await fetch(`${API_BASE_URL}/analiz-et`, {
            method: 'POST',
            headers: {
                'X-API-TOKEN': currentToken, // YENİ V2 GÜVENLİK
            },
            body: formData 
        });

        updateProgress(70, 'Yapay Zeka (GPT-4o) Analizi yapılıyor...');
        
        const data = await response.json();

        if (response.ok) {
            updateProgress(90, 'Rapor buluta ve veritabanına kaydediliyor...');
            displayReport(data);
            updateProgress(100, 'Analiz Başarılı!');
        } else {
            // API'den dönen HTTP hatasını göster
            if (response.status === 401) {
                // Token geçersizse (sunucu restart vb.)
                showMessage(loginStatus, `Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.`, true);
                logout();
            } else {
                showMessage(loginStatus, `API Hatası (${response.status}): ${data.detail || 'Bilinmeyen Hata'}`, true);
                resetUI();
            }
        }

    } catch (error) {
        showMessage(loginStatus, `Ağ Hatası: Sunucuya ulaşılamadı.`, true);
        console.error('Analiz Ağı Hatası:', error);
        resetUI();
    }
}

// --- 6. RAPOR GÖSTERİMİ (V2) ---

function displayReport(data) {
    const reportContent = document.getElementById('report-content');
    const reportLink = document.getElementById('report-link');
    
    // XSS Güvenlik Düzeltmesi (Tespit 2.6)
    const htmlContent = DOMPurify.sanitize(marked.parse(data.rapor_markdown));
    reportContent.innerHTML = htmlContent;
    
    if (data.dosya_url) {
        reportLink.href = data.dosya_url;
        reportLink.textContent = `Raporu İndir: ${data.dosya_url.split('/').pop()}`;
    } else {
        reportLink.textContent = `Rapor kaydedilemedi (Sunucu Hatası), sadece aşağıda görüntüleniyor.`;
        reportLink.href = '#';
    }

    reportSection.classList.remove('hidden');
    
    // Rapor bittikten sonra geçmişi otomatik tazele
    fetchHistory(); 
}

// --- 7. YENİ (V2): GEÇMİŞ RAPORLAR (Tespit 3.3 Çözü̇mü) ---

async function fetchHistory() {
    if (!currentToken) return; // Giriş yapılmadıysa çalışma

    historyList.innerHTML = '<li>Yükleniyor...</li>'; // Yükleniyor göstergesi

    try {
        const response = await fetch(`${API_BASE_URL}/reports/my-reports`, {
            method: 'GET',
            headers: {
                'X-API-TOKEN': currentToken
            }
        });

        if (response.ok) {
            const reports = await response.json();
            historyList.innerHTML = ''; // Listeyi temizle

            if (reports.length === 0) {
                historyList.innerHTML = '<li>Henüz kayıtlı raporunuz bulunmuyor.</li>';
            } else {
                // Raporları en yeniden en eskiye sırala
                reports.reverse().forEach(report => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = report.gcs_url;
                    a.target = '_blank';
                    
                    // Tarihi formatla (örn: 31.10.2025 18:30)
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
// Sayfa yüklendiğinde token'ı doğrulamaya dene
document.addEventListener('DOMContentLoaded', loadTokenAndValidate);
// Çıkış yap butonuna tıklamayı dinle
logoutButton.addEventListener('click', logout);
// Geçmişi getir butonuna tıklamayı dinle
fetchHistoryButton.addEventListener('click', fetchHistory);
