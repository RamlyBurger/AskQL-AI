"""CRUD operations package - organized by model."""

# Import all CRUD functions for easy access
from app.crud.conversation import (
    get_conversation,
    get_conversations,
    create_conversation,
    update_conversation_title,
    update_conversation_timestamp,
    delete_conversation,
    delete_all_conversations,
)

from app.crud.message import (
    create_message,
    get_conversation_messages,
    get_conversation_history,
)

from app.crud.user import (
    update_user_api_keys,
    get_user_api_keys,
)

from app.crud.dataset import (
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
