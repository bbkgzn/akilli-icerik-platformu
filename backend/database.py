import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Render'dan gelen DATABASE_URL'yi oku
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Eğer DATABASE_URL yoksa (lokal test için) sqlite kullan (opsiyonel)
# if not SQLALCHEMY_DATABASE_URL:
#     SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

# SQLAlchemy motorunu oluştur
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Veritabanı oturumları (session) için bir fabrika (factory) oluştur
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Modellerimizin miras alacağı temel sınıf (Base)
Base = declarative_base()

def init_db():
    """
    Veritabanını ve tabloları başlatır.
    Bu fonksiyonu main.py'de uygulama başlarken çağıracağız.
    """
    try:
        print("Veritabanı tabloları oluşturuluyor...")
        Base.metadata.create_all(bind=engine)
        print("Veritabanı tabloları başarıyla oluşturuldu.")
    except Exception as e:
        print(f"HATA: Veritabanı tabloları oluşturulamadı: {e}")
