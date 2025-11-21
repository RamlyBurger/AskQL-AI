"""FastAPI main application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models
from app.database import engine
from app.config import get_settings

# Import route modules
from app.routes import auth, ask, settings as settings_routes, dataset, chat

settings = get_settings()

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="AskQL API",
    description="Backend API for AskQL query system with multi-provider AI integration",
    version="1.0.0"
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers from different modules
# Each router handles endpoints for a specific page/feature
app.include_router(auth.router)              # Authentication endpoints (Login/Signup page)
app.include_router(chat.router)              # Chat page (conversations, messages, attachments)
app.include_router(ask.router)               # Ask mode endpoints (Chat page)
app.include_router(settings_routes.router)   # Settings page endpoints (API Keys)
app.include_router(dataset.router)           # Dataset page endpoints (Upload/View datasets)

# Mount static files for uploaded attachments
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def read_root():
    """Root endpoint."""
    return {"message": "Welcome to AskQL API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ============================================================================
# NOTE: All API endpoints have been organized into separate route modules:
# 
# - app/routes/auth.py          -> Authentication endpoints (Login/Signup)
# - app/routes/conversations.py -> Conversation management
# - app/routes/ask.py           -> Ask mode / Chat functionality
# - app/routes/settings.py      -> Settings page (API Keys management)
# - app/routes/dataset.py       -> Dataset page (Upload/View datasets)
#
# Each module contains endpoints specific to its page/feature for better
# code organization and maintainability.
# ============================================================================
