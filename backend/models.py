# backend/models.py (V7 - Sadece User ve Token)
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base # database.py'den Base'i al

class User(Base):
    """
    Kalıcı Kullanıcı tablosu.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Bir kullanıcının birden fazla token'ı olabilir
    # Rapor ilişkisi (reports) V7'de kaldırıldı.
    tokens = relationship("Token", back_populates="owner")


class Token(Base):
    """
    Kalıcı Token tablosu.
    """
    __tablename__ = "tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    access_token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id")) # User tablosuna bağla

    owner = relationship("User", back_populates="tokens")

# --- Report (Rapor) modeli V7'de kaldırıldı ---
