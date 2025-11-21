"""
CRUD operations for database models.

NOTE: This file is kept for backward compatibility.
All CRUD operations have been reorganized into separate modules:

- app/crud/conversation.py -> Conversation model operations
- app/crud/message.py      -> Message model operations
- app/crud/user.py         -> User model operations (API Keys)
- app/crud/dataset.py      -> Dataset model operations

Import from app.crud package to access all CRUD functions.
"""

# Re-export all CRUD functions from the new modular structure
from app.crud import (
    # Conversation CRUD
    get_conversation,
    get_conversations,
    create_conversation,
    update_conversation_title,
    update_conversation_timestamp,
    delete_conversation,
    delete_all_conversations,
    # Message CRUD
    create_message,
    get_conversation_messages,
    get_conversation_history,
    # User CRUD
    update_user_api_keys,
    get_user_api_keys,
    # Dataset CRUD
    create_dataset,
    get_user_datasets,
    get_dataset,
    delete_dataset,
)

__all__ = [
    # Conversation CRUD
    "get_conversation",
    "get_conversations",
    "create_conversation",
    "update_conversation_title",
    "update_conversation_timestamp",
    "delete_conversation",
    "delete_all_conversations",
    # Message CRUD
    "create_message",
    "get_conversation_messages",
    "get_conversation_history",
    # User CRUD
    "update_user_api_keys",
    "get_user_api_keys",
    # Dataset CRUD
    "create_dataset",
    "get_user_datasets",
    "get_dataset",
    "delete_dataset",
]
