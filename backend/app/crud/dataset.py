"""CRUD operations for Dataset model."""
from typing import List, Optional
from sqlalchemy.orm import Session
from app import models


def create_dataset(
    db: Session,
    user_id: int,
    name: str,
    file_type: str,
    table_name: str,
    row_count: int,
    column_count: int,
    columns: str
) -> models.Dataset:
    """Create a new dataset record."""
    db_dataset = models.Dataset(
        user_id=user_id,
        name=name,
        file_type=file_type,
        table_name=table_name,
        row_count=row_count,
        column_count=column_count,
        columns=columns
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


def get_user_datasets(db: Session, user_id: int) -> List[models.Dataset]:
    """Get all datasets for a user."""
    return db.query(models.Dataset).filter(
        models.Dataset.user_id == user_id
    ).order_by(models.Dataset.created_at.desc()).all()


def get_dataset(db: Session, dataset_id: int) -> Optional[models.Dataset]:
    """Get a single dataset by ID."""
    return db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()


def delete_dataset(db: Session, dataset_id: int) -> bool:
    """Delete a dataset record."""
    db_dataset = get_dataset(db, dataset_id)
    if not db_dataset:
        return False
    
    db.delete(db_dataset)
    db.commit()
    return True
