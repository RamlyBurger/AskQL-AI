"""CRUD operations for SQL execution and chart generation history."""
import json
import time
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app import models


def create_sql_execution_record(
    db: Session,
    conversation_id: int,
    sql_query: str,
    success: bool,
    row_count: int = 0,
    error_message: Optional[str] = None,
    execution_time_ms: Optional[int] = None
) -> models.SqlExecutionHistory:
    """Create a new SQL execution history record."""
    db_record = models.SqlExecutionHistory(
        conversation_id=conversation_id,
        sql_query=sql_query,
        success=success,
        row_count=row_count,
        error_message=error_message,
        execution_time_ms=execution_time_ms
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # Maintain only the latest 20 records per conversation
    _cleanup_old_sql_records(db, conversation_id)
    
    return db_record


def create_chart_generation_record(
    db: Session,
    conversation_id: int,
    chart_config: Dict[str, Any]
) -> models.ChartGenerationHistory:
    """Create a new chart generation history record."""
    # Extract chart information
    chart_type = chart_config.get("type", "unknown")
    title = chart_config.get("title", "Untitled Chart")
    x_axis_label = chart_config.get("x_axis_label")
    y_axis_label = chart_config.get("y_axis_label")
    
    # Extract dataset labels (column names) without data
    columns = []
    sample_categories = []
    total_categories = None
    
    if "data" in chart_config:
        data_config = chart_config["data"]
        
        # Extract column names from datasets
        if "datasets" in data_config:
            for dataset in data_config["datasets"]:
                if "label" in dataset:
                    columns.append(dataset["label"])
        
        # Extract category information
        if "labels" in data_config:
            labels = data_config["labels"]
            if labels:
                # Store first 5 categories as sample
                sample_categories = labels[:5]
                total_categories = len(labels)
    
    db_record = models.ChartGenerationHistory(
        conversation_id=conversation_id,
        chart_type=chart_type,
        title=title,
        columns=json.dumps(columns) if columns else None,
        x_axis_label=x_axis_label,
        y_axis_label=y_axis_label,
        sample_categories=json.dumps(sample_categories) if sample_categories else None,
        total_categories=total_categories
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # Maintain only the latest 20 records per conversation
    _cleanup_old_chart_records(db, conversation_id)
    
    return db_record


def get_recent_sql_history(
    db: Session,
    conversation_id: int,
    limit: int = 20
) -> List[models.SqlExecutionHistory]:
    """Get recent SQL execution history for a conversation."""
    return db.query(models.SqlExecutionHistory).filter(
        models.SqlExecutionHistory.conversation_id == conversation_id
    ).order_by(desc(models.SqlExecutionHistory.created_at)).limit(limit).all()


def get_recent_chart_history(
    db: Session,
    conversation_id: int,
    limit: int = 20
) -> List[models.ChartGenerationHistory]:
    """Get recent chart generation history for a conversation."""
    return db.query(models.ChartGenerationHistory).filter(
        models.ChartGenerationHistory.conversation_id == conversation_id
    ).order_by(desc(models.ChartGenerationHistory.created_at)).limit(limit).all()


def format_sql_history_for_prompt(sql_records: List[models.SqlExecutionHistory]) -> str:
    """Format SQL history records for inclusion in AI prompts."""
    if not sql_records:
        return ""
    
    formatted_entries = []
    # Reverse to show oldest first (chronological order)
    for i, record in enumerate(reversed(sql_records), 1):
        if record.success:
            formatted_entries.append(
                f"{i}. ✅ `{record.sql_query}` → {record.row_count} rows"
            )
        else:
            error_msg = record.error_message or "Unknown error"
            formatted_entries.append(
                f"{i}. ❌ `{record.sql_query}` → Error: {error_msg}"
            )
    
    return "\n".join(formatted_entries)


def format_chart_history_for_prompt(chart_records: List[models.ChartGenerationHistory]) -> str:
    """Format chart history records for inclusion in AI prompts."""
    if not chart_records:
        return ""
    
    formatted_entries = []
    # Reverse to show oldest first (chronological order)
    for i, record in enumerate(reversed(chart_records), 1):
        chart_info = f"{i}. {record.chart_type.upper()}: \"{record.title}\""
        
        # Add column information
        if record.columns:
            try:
                columns = json.loads(record.columns)
                if columns:
                    chart_info += f" (columns: {', '.join(columns)})"
            except (json.JSONDecodeError, TypeError):
                pass
        
        # Add category information
        if record.sample_categories:
            try:
                categories = json.loads(record.sample_categories)
                if categories:
                    if record.total_categories and record.total_categories > len(categories):
                        chart_info += f" (categories: {', '.join(categories)}... +{record.total_categories - len(categories)} more)"
                    else:
                        chart_info += f" (categories: {', '.join(categories)})"
            except (json.JSONDecodeError, TypeError):
                pass
        
        formatted_entries.append(chart_info)
    
    return "\n".join(formatted_entries)


def _cleanup_old_sql_records(db: Session, conversation_id: int, keep_count: int = 20):
    """Remove old SQL execution records, keeping only the most recent ones."""
    # Get all records for this conversation, ordered by creation time (newest first)
    all_records = db.query(models.SqlExecutionHistory).filter(
        models.SqlExecutionHistory.conversation_id == conversation_id
    ).order_by(desc(models.SqlExecutionHistory.created_at)).all()
    
    # If we have more than keep_count records, delete the oldest ones
    if len(all_records) > keep_count:
        records_to_delete = all_records[keep_count:]
        for record in records_to_delete:
            db.delete(record)
        db.commit()


def _cleanup_old_chart_records(db: Session, conversation_id: int, keep_count: int = 20):
    """Remove old chart generation records, keeping only the most recent ones."""
    # Get all records for this conversation, ordered by creation time (newest first)
    all_records = db.query(models.ChartGenerationHistory).filter(
        models.ChartGenerationHistory.conversation_id == conversation_id
    ).order_by(desc(models.ChartGenerationHistory.created_at)).all()
    
    # If we have more than keep_count records, delete the oldest ones
    if len(all_records) > keep_count:
        records_to_delete = all_records[keep_count:]
        for record in records_to_delete:
            db.delete(record)
        db.commit()


def get_history_context_for_ai(
    db: Session,
    conversation_id: int,
    max_sql_entries: int = 20,
    max_chart_entries: int = 20
) -> Dict[str, str]:
    """
    Get formatted history context for AI prompts.
    
    Returns:
        Dictionary with 'sql_context' and 'chart_context' strings
    """
    sql_records = get_recent_sql_history(db, conversation_id, max_sql_entries)
    chart_records = get_recent_chart_history(db, conversation_id, max_chart_entries)
    
    sql_context = ""
    chart_context = ""
    
    if sql_records:
        formatted_sql_history = format_sql_history_for_prompt(sql_records)
        sql_context = f"\n\n**RECENT SQL EXECUTION HISTORY (last {len(sql_records)} queries):**\n{formatted_sql_history}\n"
    
    if chart_records:
        formatted_chart_history = format_chart_history_for_prompt(chart_records)
        chart_context = f"\n\n**RECENT CHART GENERATION HISTORY (last {len(chart_records)} charts):**\n{formatted_chart_history}\n"
    
    return {
        "sql_context": sql_context,
        "chart_context": chart_context
    }
