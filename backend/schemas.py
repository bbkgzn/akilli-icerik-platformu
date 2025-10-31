# backend/schemas.py (V7 - Sadece User ve Token)
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Token Şemaları ---
class TokenData(BaseModel):
    user_id_str: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- Rapor Şemaları V7'de kaldırıldı ---

# --- Kullanıcı Şemaları ---
class UserBase(BaseModel):
    user_id_str: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool = True

    # Rapor listesi (reports) V7'de kaldırıldı.
    class Config:
        from_attributes = Truee
