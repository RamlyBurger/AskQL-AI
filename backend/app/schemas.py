"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, field_serializer, model_validator
import json


# Message Schemas
class MessageBase(BaseModel):
    """Base schema for Message."""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)
    model: Optional[str] = None
    attachments: Optional[List[dict]] = None


class MessageCreate(MessageBase):
    """Schema for creating a message."""
    pass


class MessageResponse(BaseModel):
    """Schema for message response."""
    id: int
    conversation_id: int
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str  # Allow empty content for existing data
    model: Optional[str] = None
    attachments: Optional[List[dict]] = None
    created_at: datetime

    @field_serializer('created_at')
    def serialize_created_at(self, dt: datetime, _info):
        """Ensure datetime is serialized as ISO format with timezone."""
        if dt.tzinfo is None:
            # If no timezone info, assume UTC
            from datetime import timezone
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    @model_validator(mode='before')
    @classmethod
    def parse_attachments(cls, data):
        """Parse attachments JSON string to list before validation."""
        # Handle both dict and ORM object
        if isinstance(data, dict):
            # Already a dict, just parse attachments if needed
            if 'attachments' in data and isinstance(data['attachments'], str):
                try:
                    data = data.copy()  # Don't modify original
                    data['attachments'] = json.loads(data['attachments'])
                except Exception as e:
                    data['attachments'] = None
        else:
            # Handle ORM object (from_attributes=True) - convert to dict
            if hasattr(data, 'attachments'):
                # Always convert ORM to dict to avoid modifying tracked objects
                data_dict = {
                    'id': data.id,
                    'conversation_id': data.conversation_id,
                    'role': data.role,
                    'content': data.content,
                    'model': data.model,
                    'created_at': data.created_at,
                    'attachments': None
                }
                
                # Parse attachments if it's a JSON string
                if data.attachments:
                    if isinstance(data.attachments, str):
                        try:
                            data_dict['attachments'] = json.loads(data.attachments)
                        except Exception as e:
                            data_dict['attachments'] = None
                    else:
                        data_dict['attachments'] = data.attachments
                
                return data_dict
        
        return data

    class Config:
        from_attributes = True


# Conversation Schemas
class ConversationBase(BaseModel):
    """Base schema for Conversation."""
    title: str = Field(..., min_length=1, max_length=255)
    mode: str = Field(..., pattern="^(ask|agent)$")


class ConversationCreate(ConversationBase):
    """Schema for creating a conversation."""
    pass


class ConversationResponse(ConversationBase):
    """Schema for conversation response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    messages: List[MessageResponse] = []

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info):
        """Ensure datetime is serialized as ISO format with timezone."""
        if dt is None:
            return None
        if dt.tzinfo is None:
            # If no timezone info, assume UTC
            from datetime import timezone
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True


# Attachment Schema
class AttachmentInfo(BaseModel):
    """Schema for file attachment information."""
    url: str
    filename: str
    file_type: str
    size: int


# Ask Mode Schemas
class AskRequest(BaseModel):
    """Schema for Ask mode request."""
    query: str = Field(..., min_length=1, max_length=5000)
    conversation_id: Optional[int] = None
    model: str = Field(default="gemini-2.5-flash")
    selected_tables: Optional[List[str]] = None
    attachments: Optional[List[AttachmentInfo]] = []


class AskResponse(BaseModel):
    """Schema for Ask mode response."""
    conversation_id: int
    user_message: MessageResponse
    assistant_message: MessageResponse


# Generic Response
class MessageResponseSimple(BaseModel):
    """Generic message response."""
    message: str


# User/Auth Schemas
class UserBase(BaseModel):
    """Base schema for User."""
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Schema for user registration."""
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """Schema for user response."""
    id: int
    is_active: bool
    created_at: datetime

    @field_serializer('created_at')
    def serialize_created_at(self, dt: datetime, _info):
        """Ensure datetime is serialized as ISO format with timezone."""
        if dt.tzinfo is None:
            from datetime import timezone
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token data."""
    user_id: Optional[int] = None


# API Keys Schemas
class APIKeysUpdate(BaseModel):
    """Schema for updating API keys."""
    google: Optional[str] = None
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    deepseek: Optional[str] = None


class APIKeysResponse(BaseModel):
    """Schema for API keys response."""
    google: Optional[str] = None
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    deepseek: Optional[str] = None
    
    class Config:
        from_attributes = True


# Dataset Schemas
class DatasetResponse(BaseModel):
    """Schema for dataset response."""
    id: int
    user_id: int
    name: str
    file_type: str
    table_name: str
    row_count: int
    column_count: int
    columns: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info):
        """Ensure datetime is serialized as ISO format with timezone."""
        if dt is None:
            return None
        if dt.tzinfo is None:
            from datetime import timezone
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    class Config:
        from_attributes = True


class DatasetDataResponse(BaseModel):
    """Schema for dataset data response."""
    dataset: DatasetResponse
    data: List[dict]
    total_rows: int


# Agent Confirmation Schema
class AgentConfirmationRequest(BaseModel):
    """Schema for agent operation confirmation."""
    conversation_id: int
    operation: str
    sql_query: str
    explanation: str
    confirmed: bool
    model: Optional[str] = None
    api_key: Optional[str] = None
