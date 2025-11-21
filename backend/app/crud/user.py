"""CRUD operations for User model (API Keys management)."""
from typing import Optional
from sqlalchemy.orm import Session
from app import models


def update_user_api_keys(db: Session, user_id: int, api_keys: dict) -> Optional[models.User]:
    """Update user's API keys."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    # Update only provided keys
    if api_keys.get("google") is not None:
        user.google_api_key = api_keys["google"] if api_keys["google"] else None
    if api_keys.get("openai") is not None:
        user.openai_api_key = api_keys["openai"] if api_keys["openai"] else None
    if api_keys.get("anthropic") is not None:
        user.anthropic_api_key = api_keys["anthropic"] if api_keys["anthropic"] else None
    if api_keys.get("deepseek") is not None:
        user.deepseek_api_key = api_keys["deepseek"] if api_keys["deepseek"] else None
    
    db.commit()
    db.refresh(user)
    return user


def get_user_api_keys(db: Session, user_id: int) -> Optional[dict]:
    """Get user's API keys."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    return {
        "google": user.google_api_key,
        "openai": user.openai_api_key,
        "anthropic": user.anthropic_api_key,
        "deepseek": user.deepseek_api_key
    }
