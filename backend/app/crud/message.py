"""CRUD operations for Message model."""
from typing import List, Optional
from sqlalchemy.orm import Session
from app import models
import json


def create_message(
    db: Session, 
    conversation_id: int, 
    role: str, 
    content: str, 
    model: str = None,
    attachments: Optional[List[dict]] = None
) -> models.Message:
    """Create a new message with optional attachments."""
    # Convert attachments list to JSON string if provided
    attachments_json = None
    if attachments:
        attachments_json = json.dumps(attachments)
    
    db_message = models.Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        model=model,
        attachments=attachments_json
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


def get_conversation_messages(db: Session, conversation_id: int) -> List[models.Message]:
    """Get all messages for a specific conversation."""
    return db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()


def get_conversation_history(db: Session, conversation_id: int, limit: int = 10) -> List[dict]:
    """Get conversation history in format suitable for Gemini API."""
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.desc()).limit(limit).all()
    
    # Reverse to get chronological order
    messages.reverse()
    
    return [
        {
            "role": msg.role,
            "content": msg.content
        }
        for msg in messages
    ]
