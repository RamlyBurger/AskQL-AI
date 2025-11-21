"""Shared query execution service for SELECT queries with chart generation."""
import json
import time
from typing import AsyncGenerator, Optional, Dict, Any

from app.services.dataset_service import get_dataset_service
from app.services.ai_service import ai_service


async def execute_select_query_with_chart(
    sql_query: str,
    user_query: str,
    model: str,
    api_key: str,
    result_storage: Optional[Dict[str, Any]] = None,
    db_session = None,
    conversation_id: Optional[int] = None
) -> AsyncGenerator[str, None]:
    """
    Execute a SELECT query and generate chart if applicable.
    
    This function:
    1. Sends the SQL query to frontend
    2. Executes the query
    3. Sends the results to frontend
    4. Decides if a chart should be generated
    5. Generates and sends chart configuration if needed
    
    Args:
        sql_query: The SQL SELECT query to execute
        user_query: The original user query (for chart generation context)
        model: AI model to use for chart generation
        api_key: API key for the AI provider
        result_storage: Optional dict to store the result and chart_config for database storage
        db_session: Database session for storing execution history
        conversation_id: ID of conversation for history tracking
        
    Yields:
        Server-sent events with query results and chart configuration
    """
    # Send SQL query to frontend
    yield f"data: {json.dumps({'type': 'sql_query', 'content': sql_query})}\n\n"
    
    # Send loading status BEFORE execution
    yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is executing query...'})}\n\n"
    
    # Execute query and measure execution time
    start_time = time.time()
    dataset_service = get_dataset_service()
    result = dataset_service.execute_sql_query(sql_query)
    execution_time_ms = int((time.time() - start_time) * 1000)
    
    # Store SQL execution history in database
    if db_session and conversation_id:
        try:
            from app.crud.history import create_sql_execution_record
            record = create_sql_execution_record(
                db=db_session,
                conversation_id=conversation_id,
                sql_query=sql_query,
                success=result.get('success', False),
                row_count=result.get('row_count', 0),
                error_message=result.get('error') if not result.get('success') else None,
                execution_time_ms=execution_time_ms
            )
        except Exception as e:
            print(f"⚠️ Warning: Failed to store SQL execution history: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Store result if storage provided
    if result_storage is not None:
        result_storage['result'] = result
    
    # Pause for 1 second after query execution
    time.sleep(1)
    
    # Send results to frontend
    yield f"data: {json.dumps({'type': 'sql_result', 'content': result})}\n\n"
    
    # Decide on graph generation
    graph_decision_json = None
    
    # Check if user explicitly requested charts
    user_wants_chart = 'chart' in user_query.lower() or 'graph' in user_query.lower() or 'visuali' in user_query.lower()
    
    should_generate_chart = (
        result['success'] and result['row_count'] > 0 and (
            (2 <= result['row_count'] <= 100 and len(result['columns']) >= 2) or
            (user_wants_chart and result['row_count'] >= 1 and len(result['columns']) >= 2)
        )
    )
    
    if should_generate_chart:
        from app.services.chart_generator import structure_chart_data, ask_ai_for_chart_config
        
        # Send loading status for chart decision
        yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is deciding whether to generate charts...'})}\n\n"
        
        # Add 1 second delay so users can see the loading state
        import asyncio
        await asyncio.sleep(2)
        
        # Ask AI to decide what to chart
        chart_decision = await ask_ai_for_chart_config(
            result,
            ai_service,
            model,
            api_key,
            user_query=user_query
        )
        
        if chart_decision:
            # Send loading status for chart generation
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is generating charts...'})}\n\n"
            
            # Add another brief delay for chart generation
            await asyncio.sleep(5)
            
            chart_config = structure_chart_data(result, chart_decision)
            
            # Store chart generation history in database
            if db_session and conversation_id and chart_config:
                try:
                    from app.crud.history import create_chart_generation_record
                    record = create_chart_generation_record(
                        db=db_session,
                        conversation_id=conversation_id,
                        chart_config=chart_config
                    )
                except Exception as e:
                    print(f"⚠️ Warning: Failed to store chart generation history: {str(e)}")
                    import traceback
                    traceback.print_exc()
            
            # Store chart config in the result for database storage
            if result_storage is not None:
                result_storage['chart_config'] = chart_config
            
            graph_decision_json = {
                'should_generate_graph': True,
                'graph_type': chart_decision.get('chart_type', 'bar')
            }
            
            # Send graph decision first
            yield f"data: {json.dumps({'type': 'graph_decision', 'content': graph_decision_json})}\n\n"
            
            # Then send chart config
            yield f"data: {json.dumps({'type': 'chart_config', 'content': chart_config})}\n\n"
            
            # Clear loading status after chart is sent
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is analyzing results...'})}\n\n"
        else:
            graph_decision_json = {'should_generate_graph': False}
            yield f"data: {json.dumps({'type': 'graph_decision', 'content': graph_decision_json})}\n\n"
    else:
        graph_decision_json = {'should_generate_graph': False}
        yield f"data: {json.dumps({'type': 'graph_decision', 'content': graph_decision_json})}\n\n"


def build_result_content_for_storage(
    sql_query: str,
    result: Dict[str, Any],
    include_chart: bool = True
) -> str:
    """
    Build formatted content for database storage including query, results, and optional chart.
    
    Args:
        sql_query: The SQL query that was executed
        result: The query result dictionary
        include_chart: Whether to include chart block if available
        
    Returns:
        Formatted content string for database storage
    """
    content = f"**Executed SQL Query:**\n```sql\n{sql_query}\n```"
    
    if result.get('success'):
        row_count = result.get('row_count', 0)
        content += f"\n\n**📋 Query Result:** ({row_count} row{'s' if row_count != 1 else ''} returned)\n\n"
        
        # Only show table block if there's actual data
        if row_count > 0 and result.get('data'):
            content += f"```table\n{json.dumps(result['data'], indent=2)}\n```"
        else:
            content += "*No rows returned.*"
        
        # Add chart if available and requested
        if include_chart and result.get('chart_config'):
            from app.services.chart_generator import format_chart_block
            content += f"\n\n**📊 Visualization:**\n{format_chart_block(result['chart_config'])}"
    else:
        error_msg = result.get('error', 'Unknown error')
        content += f"\n\n**❌ Error:** {error_msg}"
    
    return content
