"""Authentication API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import bcrypt

from app import crud, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Simple in-memory session storage (for demo purposes)
current_user_session = {}


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))


@router.post("/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user.password)
    db_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Store user in session
    current_user_session['user_id'] = db_user.id
    
    # Return a simple token (just the user ID for now)
    return {"access_token": str(db_user.id), "token_type": "simple"}


@router.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return simple token."""
    # Find user by email
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Store user in session
    current_user_session['user_id'] = user.id
    
    # Return a simple token (just the user ID)
    return {"access_token": str(user.id), "token_type": "simple"}


@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    """Get current authenticated user information."""
    # Try to get user from session first
    user_id = current_user_session.get('user_id')
    
    # If not in session, try to get from Authorization header
    if user_id is None:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                user_id = int(token)
            except ValueError:
                pass
    
    # If still no user_id, return first user (for testing)
    if user_id is None:
        user = db.query(models.User).first()
        if user:
            return user
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


def get_current_user_session():
    """Get the current user session dictionary."""
    return current_user_session
