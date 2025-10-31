#
# Akıllı İçerik Platformu (Versiyon 7.0 - Stabil Sadece Ses Analizi)
# Created by b!g
#

# --- Temel Kütüphane İçe Aktarımlıarı ---
import os
import uvicorn
import secrets 
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv 
from typing import Optional

# --- Veritabanı İçe Aktarımlıarı (Sadece User/Token) ---
from sqlalchemy.orm import Session
from . import crud, models, schemas
from .database import SessionLocal, engine, init_db

# --- İçerik Okuyucular ve LLM (Sadece SES) ---
import openai
# PyPDF2, docx, pptx, pytube V7'de kaldırıldı

# --- Bulut Depolama (V7'de kaldırıldı) ---
# from google.cloud import storage 

# --- GÜVENLİK AYARLARI (Sadece SES) ---
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}
# GCS ayarları V7'de kaldırıldı

# --- API Anahtarını Yükleme ---
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
openai.api_key = os.getenv("OPENAI_API_KEY")

if openai.api_key is None and not os.getenv("RENDER"): 
    raise EnvironmentError("OPENAI_API_KEY .env dosyasında ayarlanmamış.")

client = openai.OpenAI(api_key=openai.api_key or os.getenv("OPENAI_API_KEY"))

# --- VERİTABANI BAŞLATMA ---
try:
    init_db() # User ve Token tablolarını oluşturur
except Exception as e:
    print(f"Veritabanı başlatma hatası (uygulama başlarken): {e}")
    
# --- FastAPI Sunucusunu Başlatma ---
app = FastAPI(
    title="Akıllı İçerik Platformu API (V7 - Stabil)",
    description="Sadece ses dosyalarını analiz edip rapor oluşturan platform.",
    version="0.7.0" 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- VERİTABANI BAĞIMLILIĞi ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- GÜVENLİK VE KİMLİK DOĞRULAMA ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user_from_token(
    db: Session = Depends(get_db), 
    token: str = Header(..., alias="X-API-TOKEN")
) -> models.User:
    user = crud.get_user_by_token(db, token=token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş X-API-TOKEN",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- AKILLI DOSYA OKUMA İŞLEVLERİ (Sadece SES) ---
def read_audio(file_data: UploadFile) -> str:
    """Yüklenen ses dosyasından metni Whisper ile okur."""
    file_data.file.seek(0) # V6'dan gelen kritik düzeltme
    try:
        transcription = client.audio.transcriptions.create(
            model="whisper-1", 
            file=(file_data.filename, file_data.file, file_data.content_type)
        )
        return transcription.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper Okuma Hatası: {e}")

# --- PDF, DOCX, PPTX, IMAGE, YOUTUBE okuyucuları V7'de kaldırıldı ---

# --- RAPOR PROMPTU (Değişiklik yok) ---
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

# --- KULLANICI VE OTURUM ENDPOINT'LERİ (Değişiklik yok) ---

@app.post("/register", response_model=schemas.TokenResponse, tags=["Kimlik Doğrulama"])
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
    
    db_user_by_id = crud.get_user_by_user_id_str(db, user_id_str=user.user_id_str)
    if db_user_by_id:
        raise HTTPException(status_code=400, detail="Bu kullanıcı ID'si zaten kullanılıyor.")
    
    db_user = crud.create_user(db=db, user=user)
    
    new_token_str = secrets.token_urlsafe(32)
    crud.create_user_token(db=db, user=db_user, token=new_token_str)
    
    return {"access_token": new_token_str, "token_type": "bearer"}

@app.post("/token", response_model=schemas.TokenResponse, tags=["Kimlik Doğrulama"])
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = crud.get_user_by_user_id_str(db, user_id_str=form_data.username)
    
    if not user or not crud.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kullanıcı ID'si veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    new_token_str = secrets.token_urlsafe(32)
    crud.create_user_token(db=db, user=user, token=new_token_str)
    
    return {"access_token": new_token_str, "token_type": "bearer"}


@app.get("/users/me", response_model=schemas.User, tags=["Kimlik Doğrulama"])
async def read_users_me(current_user: models.User = Depends(get_current_user_from_token)):
    return current_user


# --- RAPOR ENDPOINT'LERİ (V7'de kaldırıldı) ---
# /reports/my-reports endpoint'i kaldırıldı.

# --- ANA İŞLEM ENDPOINT'i (V7 - BASİTLEŞTİRİLDİ) ---

@app.post("/analiz-et", tags=["Raporlama"])
async def analiz_et_ve_raporla(
    dosya: UploadFile = File(...), # Zorunlu ve sadece 'dosya'
    current_user: models.User = Depends(get_current_user_from_token)
    # db: Session = Depends(get_db) # DB'ye kayıt yapmayacağımız için V7'de kaldırıldı
):
    
    user_id_str = current_user.user_id_str
    metin = ""

    # 1. GÜVENLİK KONTROLÜ (Sadece Ses)
    if not dosya:
        raise HTTPException(status_code=400, detail="Dosya yüklenmedi.")

    uzanti = os.path.splitext(dosya.filename)[1].lower()
    if uzanti not in ALLOWED_EXTENSIONS:
         raise HTTPException(status_code=400, detail=f"Desteklenmeyen dosya türü. Sadece: {ALLOWED_EXTENSIONS}")

    # 2. İÇERİK OKUMA (Sadece Ses)
    try:
        metin = await run_in_threadpool(read_audio, dosya)
    except Exception as e:
        # read_audio zaten HTTPException fırlatıyor, ama yine de yakalayalım
        print(f"İçerik Okuma Başarısız: {e}")
        raise HTTPException(status_code=500, detail=f"İçerik Okuma Başarısız oldu. {e}")

    if not metin or metin.strip() == "":
         raise HTTPException(status_code=400, detail="Sesten metin çıkarılamadı (Dosya boş veya okunamadı).")

    # 3. METİN ANALİZİ (GPT-4o) (Değişiklik yok)
    try:
        def run_openai_call():
            return client.chat.completions.create(
                model="gpt-4o",   
                messages=[
                    {"role": "system", "content": RAPOR_PROMPTU},
                    {"role": "user", "content": f"Lütfen aşağıdaki içerik metnini analiz et ve raporla:\n\n{metin}"}
                ]
            )
        
        chat_completion = await run_in_threadpool(run_openai_call)
        rapor_metni = chat_completion.choices[0].message.content
        print(f"Rapor (sadece ses) oluşturuldu. Kullanıcı: {user_id_str}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM/Raporlama hatası: {str(e)}")


    # --- 4. KALICI GCS DEPOLAMA (V7'de kaldırıldı) ---
    # ...
    # --- 5. RAPORU VERİTABANINA KAYDETME (V7'de kaldırıldı) ---
    # ...


    # 6. KULLANICIYA YANIT DÖNÜŞÜ (Basitleştirildi)
    return {
        "user_id": user_id_str,
        "rapor_markdown": rapor_metni, 
        "dosya_url": None # GCS V7'de devrede değil
    }

# --- FRONTEND'İ SUNMA ---
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
