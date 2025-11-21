"""CRUD operations for Conversation model."""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app import models
import json


def get_conversation(db: Session, conversation_id: int, user_id: Optional[int] = None) -> Optional[models.Conversation]:
    """Get a single conversation by ID, optionally filtered by user_id."""
    query = db.query(models.Conversation).filter(models.Conversation.id == conversation_id)
    
    if user_id is not None:
        query = query.filter(models.Conversation.user_id == user_id)
    
    return query.first()


def get_conversations(db: Session, skip: int = 0, limit: int = 100, user_id: Optional[int] = None) -> List[models.Conversation]:
    """Get all conversations with pagination, optionally filtered by user_id."""
    query = db.query(models.Conversation)
    
    if user_id is not None:
        query = query.filter(models.Conversation.user_id == user_id)
    
    return query.order_by(models.Conversation.updated_at.desc()).offset(skip).limit(limit).all()


def create_conversation(db: Session, title: str, mode: str, user_id: Optional[int] = None) -> models.Conversation:
    """Create a new conversation."""
    db_conversation = models.Conversation(
        title=title,
        mode=mode,
        user_id=user_id
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation


def update_conversation_title(db: Session, conversation_id: int, title: str) -> Optional[models.Conversation]:
    """Update conversation title."""
    db_conversation = get_conversation(db, conversation_id)
    if not db_conversation:
        return None
    
    db_conversation.title = title
    db.commit()
    db.refresh(db_conversation)
    return db_conversation


def update_conversation_timestamp(db: Session, conversation_id: int) -> Optional[models.Conversation]:
    """Update conversation's updated_at timestamp to current time."""
    db_conversation = get_conversation(db, conversation_id)
    if not db_conversation:
        return None
    
    # Explicitly set updated_at to current timestamp
    from datetime import datetime
    db_conversation.updated_at = datetime.now()
    db.commit()
    db.refresh(db_conversation)
    return db_conversation


def delete_conversation(db: Session, conversation_id: int) -> bool:
    """Delete a conversation."""
    db_conversation = get_conversation(db, conversation_id)
    if not db_conversation:
        return False
    
    db.delete(db_conversation)
    db.commit()
    return True


def delete_all_conversations(db: Session, user_id: Optional[int] = None) -> int:
    """Delete all conversations for a user and return the count of deleted conversations.
    
    Explicitly deletes all messages first, then deletes conversations.
    """
    query = db.query(models.Conversation)
    
    # Filter by user_id if provided
    if user_id is not None:
        query = query.filter(models.Conversation.user_id == user_id)
    
    # Get all conversation IDs
    conversation_ids = [conv.id for conv in query.all()]
    count = len(conversation_ids)
    
    # Delete all messages for these conversations
    if conversation_ids:
        db.query(models.Message).filter(models.Message.conversation_id.in_(conversation_ids)).delete(synchronize_session=False)
    
    # Delete all conversations
    query.delete(synchronize_session=False)
    db.commit()
    return count
