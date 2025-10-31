from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from .database import Base # Az önce oluşturduğumuz database.py'den Base'i al

class User(Base):
    """
    Kalıcı Kullanıcı tablosu. USERS_DB sözlüğünün yerini alır.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String, unique=True, index=True, nullable=False) # Bu, 'ali_yilmaz' gibi bir ID
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Bir kullanıcının birden fazla token'ı ve raporu olabilir
    tokens = relationship("Token", back_populates="owner")
    reports = relationship("Report", back_populates="owner")


class Token(Base):
    """
    Kalıcı Token tablosu. Artık restart'ta silinmeyecekler.
    """
    __tablename__ = "tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    access_token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id")) # User tablosuna bağla

    owner = relationship("User", back_populates="tokens")


class Report(Base):
    """
    Kalıcı Rapor tablosu (Tespit 3.3'ü çözer).
    Kullanıcının geçmiş raporlarını listelememizi sağlar.
    """
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    gcs_url = Column(String, nullable=False) # Raporun GCS'deki kalıcı linki
    file_name = Column(String) # Raporun adı
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id")) # User tablosuna bağla

    owner = relationship("User", back_populates="reports")
