"""Chat page endpoints - includes attachments and conversation management."""
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api", tags=["chat"])

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/chat")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_user_id_from_request(request: Request, current_user_session: dict) -> int:
    """Extract user ID from request headers or session."""
    user_id = current_user_session.get('user_id')
    
    if user_id is None:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                user_id = int(token)
            except ValueError:
                pass
    
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return user_id


# ============================================================================
# CONVERSATION MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/conversations", response_model=List[schemas.ConversationResponse])
def list_conversations(request: Request, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all conversations for the current user."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    conversations = crud.get_conversations(db, skip=skip, limit=limit, user_id=user_id)
    return conversations


@router.get("/conversations/{conversation_id}", response_model=schemas.ConversationResponse)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Get a specific conversation with all messages."""
    conversation = crud.get_conversation(db, conversation_id=conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations", response_model=schemas.MessageResponseSimple)
def delete_all_conversations(request: Request, db: Session = Depends(get_db)):
    """Delete all conversations for the current user."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    count = crud.delete_all_conversations(db, user_id=user_id)
    return {"message": f"Successfully deleted {count} conversation(s) and all associated messages"}


@router.delete("/conversations/{conversation_id}", response_model=schemas.MessageResponseSimple)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Delete a conversation."""
    success = crud.delete_conversation(db, conversation_id=conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted successfully"}


@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas.MessageResponse])
def get_conversation_messages(conversation_id: int, db: Session = Depends(get_db)):
    """Get all messages for a specific conversation."""
    # Verify conversation exists
    conversation = crud.get_conversation(db, conversation_id=conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = crud.get_conversation_messages(db, conversation_id=conversation_id)
    return messages


# ============================================================================
# FILE UPLOAD ENDPOINTS
# ============================================================================

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get the current user if authenticated, otherwise return None."""
    if credentials is None:
        return None
    
    try:
        from app.auth import decode_access_token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except Exception:
        return None


@router.post("/chat/upload")
async def upload_chat_attachment(
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a chat attachment (image, audio, PDF, text file).
    Returns the file URL and metadata.
    Note: Authentication is optional for development.
    """
    # Validate file type
    allowed_types = [
        "image/jpeg",
        "image/jpg", 
        "image/png",
        "image/gif",
        "image/webp",
        "audio/mpeg",
        "audio/wav",
        "audio/mp3",
        "application/pdf",
        "text/plain"
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not supported. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed size of 10MB"
        )
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Return file information
    file_url = f"/uploads/chat/{unique_filename}"
    
    return {
        "url": file_url,
        "filename": file.filename,
        "file_type": file.content_type,
        "size": len(file_content)
    }
