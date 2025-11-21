"""SQLAlchemy models for AskQL system."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class MessageRole(str, enum.Enum):
    """Message role enum."""
    USER = "user"
    ASSISTANT = "assistant"


class ChatMode(str, enum.Enum):
    """Chat mode enum."""
    ASK = "ask"
    AGENT = "agent"


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # API Keys for different providers
    google_api_key = Column(String(255), nullable=True)
    openai_api_key = Column(String(255), nullable=True)
    anthropic_api_key = Column(String(255), nullable=True)
    deepseek_api_key = Column(String(255), nullable=True)
    
    # Relationship to conversations
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """Conversation model for storing chat sessions."""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for backward compatibility
    title = Column(String(255), nullable=False)
    mode = Column(Enum(ChatMode), nullable=False, default=ChatMode.ASK)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message model for storing individual chat messages."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    model = Column(String(100), nullable=True)  # AI model used for assistant messages
    attachments = Column(Text, nullable=True)  # JSON string of file attachments
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to conversation
    conversation = relationship("Conversation", back_populates="messages")


class Dataset(Base):
    """Dataset model for storing uploaded datasets."""
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # csv, xlsx, json, db
    table_name = Column(String(255), nullable=False)  # Name of the table in SQLite
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    columns = Column(Text, nullable=True)  # JSON string of column names and types
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to user
    user = relationship("User", backref="datasets")


class SqlExecutionHistory(Base):
    """Model for storing SQL execution history per conversation."""
    __tablename__ = "sql_execution_history"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sql_query = Column(Text, nullable=False)
    success = Column(Boolean, nullable=False)
    row_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)  # Execution time in milliseconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to conversation
    conversation = relationship("Conversation", backref="sql_history")


class ChartGenerationHistory(Base):
    """Model for storing chart generation history per conversation."""
    __tablename__ = "chart_generation_history"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    chart_type = Column(String(50), nullable=False)  # bar, line, pie, etc.
    title = Column(String(500), nullable=False)
    columns = Column(Text, nullable=True)  # JSON array of column names used
    x_axis_label = Column(String(255), nullable=True)
    y_axis_label = Column(String(255), nullable=True)
    sample_categories = Column(Text, nullable=True)  # JSON array of first few category names
    total_categories = Column(Integer, nullable=True)  # Total number of categories
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to conversation
    conversation = relationship("Conversation", backref="chart_history")
