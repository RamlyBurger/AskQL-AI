"""Settings page API routes (API Keys management)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/user", tags=["Settings"])


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


@router.get("/api-keys", response_model=schemas.APIKeysResponse)
def get_api_keys(request: Request, db: Session = Depends(get_db)):
    """Get user's API keys."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    
    api_keys = crud.get_user_api_keys(db, user_id)
    if api_keys is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return schemas.APIKeysResponse(**api_keys)


@router.put("/api-keys", response_model=schemas.APIKeysResponse)
def update_api_keys(
    api_keys: schemas.APIKeysUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Update user's API keys."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    
    # Update API keys
    updated_user = crud.update_user_api_keys(
        db,
        user_id,
        api_keys.model_dump(exclude_unset=True)
    )
    
    if updated_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return updated keys
    updated_keys = crud.get_user_api_keys(db, user_id)
    return schemas.APIKeysResponse(**updated_keys)
