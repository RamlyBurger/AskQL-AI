"""Dataset page API routes."""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import json
import os
import tempfile
from pathlib import Path

from app import crud, schemas
from app.database import get_db
from app.services.dataset_service import get_dataset_service

router = APIRouter(prefix="/api/datasets", tags=["Dataset"])


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


def get_unique_filename(filename: str, existing_datasets: List, user_id: int) -> str:
    """Generate a unique filename by appending _1, _2, etc. if duplicates exist."""
    # Get base name without extension
    file_path = Path(filename)
    base_name = file_path.stem
    extension = file_path.suffix
    
    # Get all existing dataset names (without extensions) for this user
    existing_names = [Path(ds.name).stem for ds in existing_datasets]
    
    # Check if base name exists
    if base_name not in existing_names:
        return filename
    
    # Find next available number
    counter = 1
    while f"{base_name}_{counter}" in existing_names:
        counter += 1
    
    return f"{base_name}_{counter}{extension}"


@router.post("/upload", response_model=List[schemas.DatasetResponse])
async def upload_dataset(
    files: List[UploadFile] = File(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Upload and parse dataset files (CSV, XLSX, JSON, DB)."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    
    # Get existing datasets for duplicate checking
    existing_datasets = crud.get_user_datasets(db, user_id)
    
    dataset_service = get_dataset_service()
    uploaded_datasets = []
    
    for file in files:
        # Check for duplicates and generate unique filename
        unique_filename = get_unique_filename(file.filename, existing_datasets, user_id)
        # Get file extension
        file_ext = Path(file.filename).suffix.lower()
        
        # Validate file type
        valid_extensions = ['.csv', '.xlsx', '.xls', '.json', '.db', '.sqlite', '.sqlite3']
        if file_ext not in valid_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Supported types: {', '.join(valid_extensions)}"
            )
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Parse file based on type
            if file_ext == '.csv':
                df, metadata = dataset_service.parse_csv(tmp_file_path)
                file_type = 'csv'
                
                # Save to database
                table_name = Path(unique_filename).stem.replace(' ', '_').replace('-', '_')
                dataset_service.save_to_database(df, table_name, user_id)
                
                # Create dataset record
                db_dataset = crud.create_dataset(
                    db=db,
                    user_id=user_id,
                    name=unique_filename,
                    file_type=file_type,
                    table_name=f"user_{user_id}_{table_name}",
                    row_count=metadata['row_count'],
                    column_count=metadata['column_count'],
                    columns=json.dumps(metadata['columns'])
                )
                uploaded_datasets.append(db_dataset)
                # Update existing_datasets list for next file
                existing_datasets.append(db_dataset)
                
            elif file_ext in ['.xlsx', '.xls']:
                df, metadata = dataset_service.parse_excel(tmp_file_path)
                file_type = 'xlsx'
                
                # Save to database
                table_name = Path(unique_filename).stem.replace(' ', '_').replace('-', '_')
                dataset_service.save_to_database(df, table_name, user_id)
                
                # Create dataset record
                db_dataset = crud.create_dataset(
                    db=db,
                    user_id=user_id,
                    name=unique_filename,
                    file_type=file_type,
                    table_name=f"user_{user_id}_{table_name}",
                    row_count=metadata['row_count'],
                    column_count=metadata['column_count'],
                    columns=json.dumps(metadata['columns'])
                )
                uploaded_datasets.append(db_dataset)
                # Update existing_datasets list for next file
                existing_datasets.append(db_dataset)
                
            elif file_ext == '.json':
                df, metadata = dataset_service.parse_json(tmp_file_path)
                file_type = 'json'
                
                # Save to database
                table_name = Path(unique_filename).stem.replace(' ', '_').replace('-', '_')
                dataset_service.save_to_database(df, table_name, user_id)
                
                # Create dataset record
                db_dataset = crud.create_dataset(
                    db=db,
                    user_id=user_id,
                    name=unique_filename,
                    file_type=file_type,
                    table_name=f"user_{user_id}_{table_name}",
                    row_count=metadata['row_count'],
                    column_count=metadata['column_count'],
                    columns=json.dumps(metadata['columns'])
                )
                uploaded_datasets.append(db_dataset)
                # Update existing_datasets list for next file
                existing_datasets.append(db_dataset)
                
            elif file_ext in ['.db', '.sqlite', '.sqlite3']:
                table_data, metadata = dataset_service.parse_database(tmp_file_path)
                file_type = 'db'
                
                # Save each table from the database
                for table_name, df in table_data:
                    safe_table_name = table_name.replace(' ', '_').replace('-', '_')
                    dataset_service.save_to_database(df, safe_table_name, user_id)
                    
                    table_metadata = dataset_service._get_dataframe_metadata(df)
                    
                    # Generate unique name for this table
                    table_unique_name = get_unique_filename(f"{unique_filename} - {table_name}", existing_datasets, user_id)
                    
                    # Create dataset record for each table
                    db_dataset = crud.create_dataset(
                        db=db,
                        user_id=user_id,
                        name=table_unique_name,
                        file_type=file_type,
                        table_name=f"user_{user_id}_{safe_table_name}",
                        row_count=table_metadata['row_count'],
                        column_count=table_metadata['column_count'],
                        columns=json.dumps(table_metadata['columns'])
                    )
                    uploaded_datasets.append(db_dataset)
                    # Update existing_datasets list for next table
                    existing_datasets.append(db_dataset)
        
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    
    return uploaded_datasets


@router.get("", response_model=List[schemas.DatasetResponse])
def list_datasets(request: Request, db: Session = Depends(get_db)):
    """Get all datasets for the current user."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    datasets = crud.get_user_datasets(db, user_id)
    return datasets


@router.get("/{dataset_id}", response_model=schemas.DatasetDataResponse)
def get_dataset_data(
    dataset_id: int,
    limit: int = 100,
    offset: int = 0,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Get dataset with its data."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    
    # Get dataset record
    dataset = crud.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Verify ownership
    if dataset.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get data from table
    dataset_service = get_dataset_service()
    try:
        data, total_rows = dataset_service.get_table_data(dataset.table_name, limit, offset)
        return schemas.DatasetDataResponse(
            dataset=dataset,
            data=data,
            total_rows=total_rows
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve data: {str(e)}")


@router.delete("/{dataset_id}", response_model=schemas.MessageResponseSimple)
def delete_dataset(
    dataset_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete a dataset."""
    from app.routes.auth import get_current_user_session
    current_user_session = get_current_user_session()
    
    user_id = get_user_id_from_request(request, current_user_session)
    
    # Get dataset record
    dataset = crud.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Verify ownership
    if dataset.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete table from database
    dataset_service = get_dataset_service()
    try:
        dataset_service.delete_table(dataset.table_name)
    except Exception as e:
        # Log error but continue with record deletion
        print(f"Warning: Failed to delete table {dataset.table_name}: {str(e)}")
    
    # Delete dataset record
    success = crud.delete_dataset(db, dataset_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete dataset record")
    
    return {"message": "Dataset deleted successfully"}
