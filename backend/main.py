#
# Akıllı İçerik Platformu (Versiyon 3.1 - UTF-8 Karakter Düzeltmeli)
# Created by b!g
#

# --- Temel Kütüphane İçe Aktarımları ---
import os
import uvicorn
import io
import base64
import json 
import secrets 
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv 
from typing import Optional
from pydantic import BaseModel, EmailStr 

# --- Proje Fonksiyonelliği İçin Gerekli İçe Aktarımlar ---
from slugify import slugify
from datetime import datetime

# --- İçerik Okuyucular ve LLM ---
import openai
import PyPDF2         
import docx           
import pptx           
import pytube         

# --- YENİ BULUT DEPOLAMA KÜTÜPHANESİ ---
from google.cloud import storage 


# --- KULLANICI YÖNETİMİ (Dinamik) ---
USER_DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'users.json')
USERS_DB = {} 

# Kullanıcı Kayıt Modelini Tanımlama
class UserRegistration(BaseModel):
    user_id: str 
    email: EmailStr 
    password: str 

def load_users():
    """Uygulama başladığında kullanıcı verilerini users.json'dan yükler."""
    global USERS_DB
    try:
        with open(USER_DB_PATH, 'r', encoding='utf-8') as f:
            USERS_DB = json.load(f)
    except FileNotFoundError:
        USERS_DB = {}
    except json.JSONDecodeError:
        print("HATA: users.json dosyası bozuk veya yanlış formatta.")
        USERS_DB = {}

def save_users():
    """Kullanıcı verilerini users.json dosyasına kaydeder."""
    # NOTE: Lokal çalışmada users.json'a kaydetmeyi dener
    with open(USER_DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(USERS_DB, f, indent=4, ensure_ascii=False)


# --- GÜVENLİK VE GCS AYARLARI ---
MAX_FILE_SIZE_MB = 50 
ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".pdf", ".docx", ".doc", ".pptx", ".ppt", 
    ".jpg", ".jpeg", ".png"
}

# --- GCS DEPOLAMA SABİTLERİ (Render Çevresel Değişkenleri ile çalışır) ---
GCS_KEY_ENV_VAR = "GCS_SA_KEY" 
GCS_BUCKET_NAME = "akilli-icerik-raporlari-bbkgzn" # Kendi bucket adınız


# --- API Anahtarını Yükleme ---
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
openai.api_key = os.getenv("OPENAI_API_KEY")

if openai.api_key is None and not os.getenv("RENDER"): 
    # Sadece lokal çalışmada .env yoksa hata ver
    raise EnvironmentError("OPENAI_API_KEY .env dosyasında ayarlanmamış.")

# API Key'i çevresel değişkenlerden alarak OpenAI client'ı başlat
client = openai.OpenAI(api_key=openai.api_key or os.getenv("OPENAI_API_KEY"))

# UYGULAMA BAŞLANGICI: Kullanıcıları Yükle
load_users()
print(f"OpenAI istemcisi başarıyla başlatıldı. Yüklü kullanıcı sayısı: {len(USERS_DB)}")

# --- FastAPI Sunucusunu Başlatma ---
app = FastAPI(
    title="Akıllı İçerik Platformu API (Created by b!g)",
    description="Çoklu ortam dosyalarını analiz edip kişiselleştirilmiş raporlar oluşturan platform.",
    version="0.3.1" 
)

# CORS Ayarı
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- YARDIMCI GÜVENLİK FONKSİYONLARI ---
def get_user_id(api_token: str) -> str:
    """Token'ı kontrol eder ve kullanıcı ID'sini döndürür (USERS_DB'den)."""
    user_data = USERS_DB.get(api_token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Geçersiz veya Eksik X-API-TOKEN. Lütfen geçerli bir erişim kodu sağlayın.")
    return user_data.get("user_id")

def validate_file(dosya: UploadFile):
    """Dosya boyutu ve uzantı kontrolü (Siber güvenlik adımı)."""
    if dosya.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Dosya boyutu {MAX_FILE_SIZE_MB}MB'ı geçemez.")

    uzanti = os.path.splitext(dosya.filename)[1].lower()
    if uzanti not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Desteklenmeyen dosya türü veya uzantı.")

# --- AKILLI DOSYA OKUMA İŞLEVLERİ (TÜMÜ) ---

def read_audio(file_data: UploadFile) -> str:
    """Yüklenen ses dosyasından metni Whisper ile okur."""
    try:
        transcription = client.audio.transcriptions.create(
            model="whisper-1", 
            file=(file_data.filename, file_data.file, file_data.content_type)
        )
        return transcription.text
    except Exception as e:
        print(f"Whisper Okuma Hatası: {e}")
        return ""


def read_pdf(file_data: UploadFile) -> str:
    """Yüklenen PDF dosyasından metni PyPDF2 ile okur."""
    full_text = []
    try:
        reader = PyPDF2.PdfReader(file_data.file)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)
                
        return "\n".join(full_text)
    except Exception as e:
        print(f"PDF Okuma Hatası: {e}")
        return ""

def read_docx(file_data: UploadFile) -> str:
    """Yüklenen DOCX dosyasından metni python-docx ile okur."""
    full_text = []
    try:
        document = docx.Document(file_data.file)
        for para in document.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
                
        return "\n".join(full_text)
    except Exception as e:
        print(f"DOCX Okuma Hatası: {e}")
        return ""

def read_pptx(file_data: UploadFile) -> str:
    """Yüklenen PPTX dosyasından metni python-pptx ile okur."""
    full_text = []
    try:
        presentation = pptx.Presentation(file_data.file)
        for slide in presentation.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    if shape.text.strip():
                        full_text.append(shape.text)
            
            if slide.has_notes_slide:
                notes_slide = slide.notes_slide
                if notes_slide.notes_text_frame.text.strip():
                    full_text.append(notes_slide.notes_text_frame.text)
        
        return "\n".join(full_text)
    except Exception as e:
        print(f"PPTX Okuma Hatası: {e}")
        return ""


def read_image(file_data: UploadFile) -> str:
    """Yüklenen görselden metni GPT-4o Vizyon ile okur (OCR)."""
    try:
        image_bytes = file_data.file.read()
        base64_image = base64.b64encode(image_bytes).decode('utf-8')

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Bu görseldeki tüm metni eksiksiz bir şekilde OCR yaparak metin olarak çıkarın. Çıkan metinle ilgili yorum yapmayın, sadece metni döndürün."},
                        {"type": "image_url", "image_url": {"url": f"data:{file_data.content_type};base64,{base64_image}"}}
                    ],
                }
            ],
            max_tokens=4096, 
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"Görsel (OCR) Okuma Hatası: {e}")
        return ""

def download_youtube_audio(url: str) -> str:
    """YouTube URL'sinden sesi indirir ve Whisper ile metne çevirir."""
    temp_dir = "./temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = None

    try:
        yt = pytube.YouTube(url)
        audio_stream = yt.streams.get_audio_only()

        temp_file_path = audio_stream.download(output_path=temp_dir, filename_prefix="yt_")

        with open(temp_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            return transcription.text

    except pytube.exceptions.VideoUnavailable:
        raise HTTPException(status_code=400, detail="YouTube: Video erişilebilir değil veya silinmiş.")
    except Exception as e:
        print(f"YouTube Ses İşleme Hatası: {e}")
        raise HTTPException(status_code=500, detail=f"YouTube/Whisper İşleme Hatası: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            temp_dir = os.path.dirname(temp_file_path)
            if os.path.isdir(temp_dir) and not os.listdir(temp_dir):
                os.rmdir(temp_dir)


# --- RAPOR PROMPTU (8 Başlık) ---
RAPOR_PROMPTU = """
Sen, 'Akıllı İçerik Platformu' adına çalışan, detay odaklı bir yapay zekâ uzmanısın. 
Görevin, sana verilen bir içerik metnini analiz etmek ve bu metni, öğrenmeyi ve eyleme geçmeyi kolaylaştıracak şekilde, 8 ana başlıkta özetleyen net bir **Markdown (.md) formatında rapor** hazırlamaktır.

Raporun formatı AŞAĞIDAKİ YAPILANDIRILMIŞ ŞEKİLDE, TÜM BAŞLIKLAR ZORUNLU OLARAK OLMALIDIR:

### 1. Konu Özeti (3-5 Cümle)
[Buraya içeriğin genel amacını ve ana temasını 3-5 net cümle ile yaz.]

### 2. Konu Bölümlendirme (Gezinme Haritası)
[İçeriğin ana başlıklarını ve mantıksal akışını gösteren bir liste hazırla. Bölüm başlıklarını net bir şekilde listele.]
* Bölüm 1 Adı
* Bölüm 2 Adı
* ...

### 3. Temel Kavramlar Sözlüğü (Markdown Tablosu)
["Bu içerikte bilmem gereken kilit kelimeler neler?" sorusuna cevap ver. Bu kavramları ve kısa tanımlarını içeren iki sütunlu bir Markdown Tablosu oluştur. Tabloya en az 5 temel kavram ekle.]

| Kavram | Tanım |
|---|---|
| Bilgi Güvenliği | Hassas verilerin yetkisiz erişime karşı korunması. |
| ... | ... |

### 4. Öğrenme Çıkarımları (Liste)
[Bu içerik bittiğinde aklımda kalması gereken 3 ana prensibi maddeler halinde, kısa ve öz olarak yaz.]
* Ana prensip 1
* Ana prensip 2
* ...

### 5. Pratik Öneri (1 Paragraf)
[Bu bilgiyi gerçek hayatta veya iş akışında nasıl kullanabileceğine dair 1 paragraflık somut bir eylem önerisi yaz.]

### 6. Faydalı Kaynaklar ve Araçlar (Liste)
[İçeriğin konusuyla ilgili, öğrenmeyi derinleştirecek ve işe yarayacak 3-5 adet ek kaynak, araç, program, site veya bu alandaki uzmanların adını bir liste olarak öner.]
* Kaynak/Araç 1 (Kısa açıklama)
* Kaynak/Araç 2 (Kısa açıklama)
* ...

### 7. Mini Quiz (3-5 Soru)
[Kullanıcının konuyu ne kadar anladığını test etmek için 3 adet, kısa cevaplı veya çoktan seçmeli, kritik soru hazırla. Her sorunun hemen altına DOĞRU CEVABI da **parantez içinde** belirt.]
1. Soru 1? (Cevap: ...)
2. Soru 2? (Cevap: ...)
3. Soru 3? (Cevap: ...)

### 8. Kişisel Notlar (Boş Alan)
[Bu bölümü kullanıcı kendi notlarını alsın diye boş bırak. Sadece '### 8. Kişisel Notlar' başlığını yaz ve altını boş bırak.]
"""

# --- YENİ KULLANICI YÖNETİMİ ENDPOINT'İ ---

@app.post("/register")
def register_user(user_data: UserRegistration):
    """Yeni kullanıcı kaydını dinamik olarak yapar ve token döndürür."""
    for data in USERS_DB.values():
        if data.get("user_id") == user_data.user_id:
            raise HTTPException(status_code=400, detail="Bu kullanıcı ID'si zaten kullanılıyor.")

    new_token = secrets.token_urlsafe(32)
    
    USERS_DB[new_token] = {
        "user_id": user_data.user_id,
        "email": user_data.email,
        "password_hash": "hardcoded_for_demo" 
    }
    
    # Lokal çalışmada users.json'a kaydetmeyi dene
    if not os.getenv("RENDER"):
        save_users()

    return {
        "user_id": user_data.user_id,
        "token": new_token,
        "message": f"Kayıt başarılı. Token'ınız ile analiz yapmaya başlayabilirsiniz. Token'ı X-API-TOKEN başlığında kullanın."
    }


# --- ANA İŞLEM ENDPOINT'i ---

@app.post("/analiz-et", tags=["Ana Akış (Tüm Dosya Tipleri)"])
async def analiz_et_ve_raporla(
    dosya: Optional[UploadFile] = File(None), 
    youtube_url: Optional[str] = None,       
    api_token: Optional[str] = Header(None, alias="X-API-TOKEN") 
):
    
    # 1. GÜVENLİK KONTROLÜ (Token ile Kullanıcı Kimliği)
    user_id = get_user_id(api_token)
    
    # 2. İÇERİK TÜRÜNÜ BELİRLEME ve OKUMA
    metin = ""
    dosya_adi_temel = "Analiz_Raporu"

    try:
        if dosya:
            validate_file(dosya) 
            
            uzanti = os.path.splitext(dosya.filename)[1].lower()
            dosya_adi_temel = os.path.splitext(dosya.filename)[0]

            if uzanti in [".mp3", ".wav", ".m4a"]:
                metin = read_audio(dosya)
            elif uzanti == ".pdf":
                metin = read_pdf(dosya)
            elif uzanti in [".docx", ".doc"]:
                metin = read_docx(dosya)
            elif uzanti in [".pptx", ".ppt"]:
                metin = read_pptx(dosya)
            elif uzanti in [".jpg", ".jpeg", ".png"]:
                metin = read_image(dosya)
            else:
                raise HTTPException(status_code=400, detail="Desteklenmeyen dosya türü.")
        
        elif youtube_url:
            metin = download_youtube_audio(youtube_url)
            dosya_adi_temel = f"youtube-video-analizi"
        
        else:
            raise HTTPException(status_code=400, detail="Dosya yükleyin veya bir YouTube URL'si sağlayın.")
            
    except HTTPException as h:
        raise h 
    except Exception as e:
        print(f"İçerik Okuma Başarısız: {e}")
        raise HTTPException(status_code=500, detail="İçerik Okuma Başarısız oldu. Dosya bozuk olabilir.")


    # 3. METİN ANALİZİ (GPT-4o)
    if not metin or metin.strip() == "":
         raise HTTPException(status_code=400, detail="İçerikten metin çıkarılamadı.")

    try:
        chat_completion = client.chat.completions.create(
            model="gpt-4o",   
            messages=[
                {"role": "system", "content": RAPOR_PROMPTU},
                {"role": "user", "content": f"Lütfen aşağıdaki içerik metnini analiz et ve raporla:\n\n{metin}"}
            ]
        )
        rapor_metni = chat_completion.choices[0].message.content
        print(f"Rapor oluşturuldu. Kullanıcı: {user_id}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM/Raporlama hatası: {str(e)}")


    # --- YENİ 4. KULLANICI BAZLI KAYIT VE KALICI GCS DEPOLAMA ---
    try:
        # 1. GCS İstemcisini Başlatma
        sa_key_json = os.getenv(GCS_KEY_ENV_VAR)
        if not sa_key_json:
            raise Exception("GCS Service Account Key çevresel değişkeni ayarlanmadı.")

        credentials_dict = json.loads(sa_key_json)
        
        gcs_client = storage.Client.from_service_account_info(credentials_dict)
        bucket = gcs_client.bucket(GCS_BUCKET_NAME)

        # 2. Dosya Adını Oluşturma
        temiz_ad = slugify(dosya_adi_temel)
        zaman_damgasi = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        
        # GCS dosya yolu: {kullanici_id}/{dosya_adi}.md
        gcs_file_name = f"{user_id}/{temiz_ad}_{zaman_damgasi}.md"
        
        # 3. GCS'e Yükleme
        blob = bucket.blob(gcs_file_name)
        
        # Rapor metnini UTF-8 olarak kodlayıp yükle ve charset'i belirt (DÜZELTME BURADA)
        blob.upload_from_string(
            data=rapor_metni.encode('utf-8'), 
            content_type='text/markdown; charset=utf-8' # <-- UTF-8 DÜZELTMESİ
        )
            
        print(f"Rapor başarıyla GCS'e yüklendi: {gcs_file_name}")
        
        # 4. Genel Erişim URL'sini Oluşturma
        kaydedilen_dosya_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{gcs_file_name}"

    except Exception as e:
        print(f"HATA: Rapor GCS'e kaydedilemedi: {e}")
        kaydedilen_dosya_url = None


    # 5. KULLANICIYA YANIT DÖNÜŞÜ
    return {
        "user_id": user_id,
        "rapor_markdown": rapor_metni, 
        "dosya_url": kaydedilen_dosya_url
    }


# --- Sunucuyu Çalıştırmak için Ana Giriş Noktası ---
if __name__ == "__main__":
    print("Sunucuyu başlatmak için terminalde PROJE ANA DİZİNİNDE şu komutu çalıştırın:")
    print("uvicorn backend.main:app --reload")

# --- FRONTEND VE RAPORLAR KLASÖRÜNÜ SUNMA (EN SON YÜKLENMELİ) ---
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
