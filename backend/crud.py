from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

# main.py'den parola hashleme fonksiyonlarini buraya tasidik
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# --- Kullanici CRUD ---

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_user_id_str(db: Session, user_id_str: str):
    return db.query(models.User).filter(models.User.user_id_str == user_id_str).first()

def create_user(db: Session, user: schemas.UserCreate):
    """
    Yeni kullaniciyi veritabanina kaydeder.
    """
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
    """
    Kullanici icin yeni bir token'i veritabanina kaydeder.
    """
    db_token = models.Token(access_token=token, owner=user)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token

def get_user_by_token(db: Session, token: str):
    """
    Token'a gore kullaniciyi bulan fonksiyon (Eski get_user_id'nin yerini alacak)
    """
    db_token = db.query(models.Token).filter(models.Token.access_token == token).first()
    if db_token:
        return db_token.owner
    return None

# --- Rapor CRUD ---

def create_user_report(db: Session, report: schemas.ReportCreate, user_id: int):
    """
    Yeni raporun GCS linkini veritabanina kaydeder.
    """
    db_report = models.Report(**report.model_dump(), user_id=user_id)
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def get_user_reports(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """
    Bir kullanicinin tum raporlarini veritabanindan listeler (Tespit 3.3'u cozer)
    """
    return db.query(models.Report).filter(models.Report.user_id == user_id).offset(skip).limit(limit).all()
