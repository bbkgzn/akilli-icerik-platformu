# backend/crud.py (V7 - Sadece User ve Token)
from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

# V6'daki stabil PBKDF2_SHA256 karmasını kullanıyoruz
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# --- Kullanıcı CRUD ---

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_user_id_str(db: Session, user_id_str: str):
    return db.query(models.User).filter(models.User.user_id_str == user_id_str).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        user_id_str=user.user_id_str,
        email=user.email,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Token CRUD ---

def create_user_token(db: Session, user: models.User, token: str):
    db_token = models.Token(access_token=token, owner=user)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token

def get_user_by_token(db: Session, token: str):
    db_token = db.query(models.Token).filter(models.Token.access_token == token).first()
    if db_token:
        return db_token.owner
    return None

# --- Rapor CRUD fonksiyonları V7'de kaldırıldı ---
