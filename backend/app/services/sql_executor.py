"""SQL query extraction and execution service."""
import re
import json
from typing import Optional, Dict, Tuple
from app.services.chart_generator import ask_ai_for_chart_config, structure_chart_data, format_chart_block


def extract_sql_from_response(ai_response: str) -> Optional[str]:
    """
    Extract SQL query from AI response.
    Looks for SQL code blocks in markdown format.
    """
    # Pattern to match SQL code blocks: ```sql ... ```
    sql_pattern = r'```sql\s*(.*?)\s*```'
    matches = re.findall(sql_pattern, ai_response, re.DOTALL | re.IGNORECASE)
    
    if matches:
        # Return the first SQL query found, clean up any markers
        sql = matches[0].strip()
        # Remove MULTI_STEP_QUERY markers if present
        sql = re.sub(r'MULTI_STEP_QUERY:\s*Step\s*\d+\s*', '', sql, flags=re.IGNORECASE).strip()
        # Ensure it's actually SQL (starts with SELECT, INSERT, UPDATE, DELETE, WITH, etc.)
        if sql and re.match(r'^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER)\s', sql, re.IGNORECASE):
            return sql
    
    # Try without language specifier: ``` ... ```
    code_pattern = r'```\s*(SELECT.*?)\s*```'
    matches = re.findall(code_pattern, ai_response, re.DOTALL | re.IGNORECASE)
    
    if matches:
        sql = matches[0].strip()
        sql = re.sub(r'MULTI_STEP_QUERY:\s*Step\s*\d+\s*', '', sql, flags=re.IGNORECASE).strip()
        return sql
    
    return None


async def format_query_result(
    query: str, 
    result: Dict, 
    ai_response: str,
    ai_service=None,
    model: str = None,
    api_key: str = None,
    user_query: str = ""
) -> str:
    """
    Format the response with executed query results.
    
    Args:
        query: The SQL query that was executed
        result: The execution result from dataset_service
        ai_response: The original AI response
        
    Returns:
        Formatted response string
    """
    if not result['success']:
        return f"""**Executed SQL Query:**
```sql
{query}
```

**Error:**
{result['error']}

**Original AI Response:**
{ai_response}
"""
    
    # Format the data as a table
    data = result['data']
    columns = result['columns']
    row_count = result['row_count']
    
    # Build response
    response_parts = [
        "**Executed SQL Query:**",
        "```sql",
        query,
        "```",
        "",
        f"**Query Result:** ({row_count} row{'s' if row_count != 1 else ''} returned)",
        ""
    ]
    
    if row_count > 0:
        # Format as JSON for collapsible display
        response_parts.append("<details>")
        response_parts.append("<summary>Results</summary>")
        response_parts.append("")
        response_parts.append("```json")
        response_parts.append(json.dumps(data, indent=2))
        response_parts.append("```")
        response_parts.append("</details>")
        response_parts.append("")
        
        # Ask AI if chart is needed and generate it (BEFORE answer)
        if ai_service and model and api_key:
            try:
                chart_decision = await ask_ai_for_chart_config(result, ai_service, model, api_key, user_query=user_query)
                if chart_decision:
                    chart_config = structure_chart_data(result, chart_decision)
                    response_parts.append("---")
                    response_parts.append("")
                    response_parts.append("**📊 Visualization:**")
                    response_parts.append(format_chart_block(chart_config))
                    response_parts.append("")
                else:
                    pass
            except Exception as e:
                import traceback
                traceback.print_exc()
        
        # Add interpretation (AFTER visualization)
        response_parts.append("---")
        response_parts.append("")
        response_parts.append("**Answer:**")
        
        # Try to provide a natural language answer based on the results
        if row_count == 1 and len(columns) <= 3:
            # Single row result - provide direct answer
            row = data[0]
            answer_parts = []
            for col, val in row.items():
                answer_parts.append(f"**{col}**: {val}")
            response_parts.append("Based on the query results, " + ", ".join(answer_parts))
        else:
            # Multiple rows - provide summary
            response_parts.append(f"The query returned {row_count} row(s). See the detailed results above.")
    else:
        response_parts.append("No results found.")
    
    return "\n".join(response_parts)


async def process_ai_response_with_sql(
    ai_response: str,
    dataset_service,
    execute_queries: bool = True,
    ai_service=None,
    model: str = None,
    api_key: str = None
) -> Tuple[str, Optional[str], Optional[Dict]]:
    """
    Process AI response, extract SQL, execute it, and format results.
    
    Args:
        ai_response: The AI's response text
        dataset_service: Instance of DatasetService
        execute_queries: Whether to actually execute queries
        ai_service: AI service for chart generation
        model: AI model to use
        api_key: API key for the model
        
    Returns:
        Tuple of (formatted_response, extracted_query, execution_result)
    """
    if not execute_queries:
        return ai_response, None, None
    
    # Extract SQL query
    sql_query = extract_sql_from_response(ai_response)
    
    if not sql_query:
        # No SQL query found, return original response
        return ai_response, None, None
    
    # Execute the query
    result = dataset_service.execute_sql_query(sql_query)
    
    # Format the response with results (now async with chart generation)
    formatted_response = await format_query_result(
        sql_query, 
        result, 
        ai_response,
        ai_service=ai_service,
        model=model,
        api_key=api_key
    )
    
    return formatted_response, sql_query, result
