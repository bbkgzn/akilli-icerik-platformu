from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Token Şemaları ---
class TokenData(BaseModel):
    user_id_str: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- Rapor Şemaları ---
class ReportBase(BaseModel):
    gcs_url: str
    file_name: str | None = None

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True # SQLAlchemy modelleri ile Pydantic'i eşleştirir

# --- Kullanıcı Şemaları ---
class UserBase(BaseModel):
    user_id_str: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool = True # Gelecekte kullanıcı banlama vb. için
    reports: List[Report] = []

    class Config:
        from_attributes = True
