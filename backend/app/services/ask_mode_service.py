"""Ask Mode service for handling data analysis queries with SQL execution and visualization."""
import json
import re
from typing import Optional, AsyncGenerator
from sqlalchemy.orm import Session

from app import crud, schemas
from app.services.ai_service import ai_service
from app.services.dataset_service import get_dataset_service
from app.services.sql_executor import extract_sql_from_response
from app.services.query_executor import execute_select_query_with_chart, build_result_content_for_storage


def _truncate_text_fields(data, max_length: int = 20):
    """Recursively truncate string fields and format numbers to 2 decimal places."""
    if isinstance(data, dict):
        return {key: _truncate_text_fields(value, max_length) for key, value in data.items()}
    elif isinstance(data, list):
        return [_truncate_text_fields(item, max_length) for item in data]
    elif isinstance(data, str) and len(data) > max_length:
        return data[:max_length-3] + "..."
    elif isinstance(data, (int, float)) and not isinstance(data, bool):
        # Format numbers to 2 decimal places, but keep integers as integers if they have no decimal part
        if isinstance(data, float) and data.is_integer():
            return int(data)
        elif isinstance(data, float):
            return round(data, 2)
        else:
            return data
    else:
        return data


def _get_text_truncation_length(query_count: int, is_last_5_results: bool) -> int:
    """Determine text truncation length based on query count and position."""
    if query_count <= 5 or is_last_5_results:
        return 20  # Standard truncation for ≤5 queries or last 5 results
    else:
        return 10  # Shorter truncation for older results when >5 queries


def _limit_result_rows(results: list, query_count: int, is_last_5_results: bool = False, is_last_query: bool = False) -> list:
    """Limit the number of rows based on query count and position."""
    if is_last_query:
        # Show max 20 rows for the most recent query
        return results[:20]
    elif query_count <= 5 or is_last_5_results:
        # Show max 10 rows for each result when <= 5 queries or for last 5 results
        return results[:10]
    else:
        # Show max 3 rows for each result when > 5 queries (except last 5)
        return results[:3]


def escape_table_names_in_response(response: str, table_names: list) -> str:
    """
    Wrap table names in backticks to prevent Markdown from treating underscores as italics.
    """
    if not table_names:
        return response
    
    for table_name in table_names:
        # Only escape if not already in backticks or code blocks
        # Replace table_name with `table_name` but avoid replacing if already escaped
        pattern = r'(?<!`)(?<!``)' + re.escape(table_name) + r'(?!`)(?!``)'
        response = re.sub(pattern, f'`{table_name}`', response)
    
    return response


async def process_ask_mode_stream(
    request_data: schemas.AskRequest,
    conversation_id: int,
    user_message_id: int,
    model: str,
    api_key: str,
    db: Session
) -> AsyncGenerator[str, None]:
    """
    Process an Ask Mode query with streaming response.
    
    Args:
        request_data: The ask request data
        conversation_id: ID of the conversation
        user_message_id: ID of the user message
        model: AI model to use
        api_key: API key for the AI provider
        db: Database session
        
    Yields:
        Server-sent events with query results, charts, and answers
    """
    # Check if @general tag is used
    is_general_mode = request_data.selected_tables and 'general' in [t.lower() for t in request_data.selected_tables]
    
    # Retrieve conversation history (excluding the current user message)
    conversation_history = []
    try:
        conversation = crud.get_conversation(db, conversation_id)
        if conversation:
            # Get all messages except the current one
            all_messages = crud.get_conversation_messages(db, conversation_id)
            for msg in all_messages:
                if msg.id != user_message_id:  # Exclude current message
                    conversation_history.append({
                        "role": msg.role,
                        "content": msg.content
                    })
    except Exception as e:
        print(f"⚠️ Warning: Failed to retrieve conversation history: {str(e)}")
    
    # Extract table schemas if tables are selected (excluding @general)
    table_schemas = None
    if not is_general_mode and request_data.selected_tables:
        dataset_service = get_dataset_service()
        table_schemas = []
        # Filter out 'general' from the list before getting schemas
        actual_tables = [t for t in request_data.selected_tables if t.lower() != 'general']
        for table_name in actual_tables:
            try:
                schema = dataset_service.get_table_schema(table_name)
                table_schemas.append(schema)
            except Exception as e:
                print(f"Warning: Failed to get schema for table {table_name}: {str(e)}")
    
    # STEP 1: Analyze query and decide action (General or SQL)
    
    # Process attachments (convert to format AI can understand)
    attachments_data = []
    if request_data.attachments:
        for attachment in request_data.attachments:
            attachments_data.append({
                "url": attachment.url,
                "filename": attachment.filename,
                "file_type": attachment.file_type
            })
    
    ai_response = await ai_service.generate_response(
        query=request_data.query,
        model=model,
        api_key=api_key,
        conversation_history=conversation_history,
        table_schemas=table_schemas,
        is_general_mode=is_general_mode,
        attachments=attachments_data if attachments_data else None,
        db_session=db,
        conversation_id=conversation_id
    )
    
    # STEP 2: Check if general mode, unrelated query, missing dataset, or SQL execution needed
    is_unrelated_query = 'UNRELATED_QUERY' in ai_response
    is_missing_dataset = 'MISSING_DATASET' in ai_response
    sql_query = None
    result = None
    final_answer = None
    graph_decision_json = None
    all_results = []  # Store all query results for multi-step
    all_sql_queries = []  # Store all SQL queries
    all_reasoning = []  # Track reasoning for each step
    
    if is_general_mode:
        # STEP 2a: Handle general conversation mode
        final_answer = ai_response
        yield f"data: {json.dumps({'type': 'ai_response', 'content': ai_response})}\n\n"
        yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
    elif is_missing_dataset:
        # STEP 2a: Handle missing dataset
        final_answer = ai_response.replace('MISSING_DATASET', '').strip()
        yield f"data: {json.dumps({'type': 'ai_response', 'content': ai_response})}\n\n"
        yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
    elif is_unrelated_query:
        # STEP 2b: Handle unrelated query (reject it)
        final_answer = ai_response.replace('UNRELATED_QUERY', '').strip()
        yield f"data: {json.dumps({'type': 'ai_response', 'content': ai_response})}\n\n"
        yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
    else:
        # STEP 2b: Execute SQL
        
        # STEP 3: Extract and execute SQL (with multi-step support)
        sql_query = extract_sql_from_response(ai_response)
        
        # Check if no SQL was extracted - could be explanation or non-data question
        if not sql_query:
            # If AI response contains explanation or is answering a question, use it
            # Otherwise show the rejection message
            if len(ai_response.strip()) > 50 and 'UNRELATED_QUERY' not in ai_response:
                # Likely an explanation or answer - use AI's response
                # Escape table names to prevent Markdown italic rendering
                escaped_response = escape_table_names_in_response(ai_response, request_data.selected_tables)
                final_answer = escaped_response  # Store for database save
                yield f"data: {json.dumps({'type': 'final_answer', 'content': escaped_response})}\n\n"
            else:
                # Short response or UNRELATED_QUERY - show rejection message
                final_answer = "I notice you've tagged a dataset, but your question doesn't seem to be about querying or analyzing data. I'm designed to help you explore and analyze your datasets using SQL queries.\n\nIf you want to ask general questions, please use @general instead.\n\nIf you'd like to analyze the data, try asking questions like:\n- 'Show me the top 10 records'\n- 'What's the average sales?'\n- 'Find records where...'"
                yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'ai_response', 'content': ai_response})}\n\n"
        
        max_iterations = 10  # Limit to prevent infinite loops
        iteration = 0
        dataset_service = get_dataset_service()
        
        # Multi-step query loop
        while sql_query and iteration < max_iterations:
            iteration += 1            # Execute query and generate chart using shared function
            result_storage = {}
            async for event in execute_select_query_with_chart(
                sql_query=sql_query,
                user_query=request_data.query,
                model=model,
                api_key=api_key,
                result_storage=result_storage,
                db_session=db,
                conversation_id=conversation_id
            ):
                yield event
            
            # Get result from storage
            result = result_storage.get('result')
            chart_config = result_storage.get('chart_config')
            
            # Store result and chart_config
            all_sql_queries.append(sql_query)
            if result:
                # Add chart_config to result for consistency
                if chart_config:
                    result['chart_config'] = chart_config
                all_results.append(result)
            
            # Check if we've reached max iterations
            if iteration >= max_iterations:
                break
            
            # STEP 5: Ask AI if another query is needed
            # Build detailed result summary including errors
            result_summary = []
            total_queries = len(all_sql_queries)
            
            for i, (q, r) in enumerate(zip(all_sql_queries, all_results)):
                if r.get('success'):
                    # Determine if this is one of the last 5 results
                    is_last_5 = i >= total_queries - 5
                    # Determine if this is the last (most recent) query
                    is_last_query = i == total_queries - 1
                    
                    # Limit rows based on query count and position
                    limited_data = _limit_result_rows(r['data'], total_queries, is_last_5, is_last_query)
                    
                    # Determine text truncation length based on query count and position
                    truncation_length = _get_text_truncation_length(total_queries, is_last_5)
                    
                    # Truncate text fields with dynamic length
                    truncated_data = _truncate_text_fields(limited_data, max_length=truncation_length)
                    
                    result_summary.append({
                        'query': q,
                        'success': True,
                        'row_count': r['row_count'],
                        'result': truncated_data
                    })
                else:
                    result_summary.append({
                        'query': q,
                        'success': False,
                        'error': r.get('error', 'Query returned no results'),
                        'row_count': 0
                    })
            
            next_step_prompt = f"""COMPLETION DECISION: Should we stop or continue?

Original User Question: "{request_data.query}"
Queries Executed So Far: {len(all_sql_queries)}

Previous Results:
{json.dumps(result_summary, indent=2)}

CRITICAL RULES - Apply in this exact order:

1. **EXPLICIT NUMBER REQUESTS** ("run 5 queries", "show me 3 queries", "execute 10 queries"):
   - If user specified a number AND {len(all_sql_queries)} < that number → Continue
   - If user specified a number AND {len(all_sql_queries)} >= that number → STOP

2. **SPECIFIC DATA QUESTIONS** (User asks for ONE specific thing):
   Examples: "show total sales for each store", "display top 5 stores", "what's the average sales by region", "count of customers", "show all records where X > Y"
   
   ⚠️ CRITICAL CHECK - Does the current result ALREADY answer the user's specific question?
   - Review the user's question: "{request_data.query}"
   - Review the last result: Does it contain the data the user asked for?
   - If YES (question is answered) → STOP IMMEDIATELY
   - If NO (question not answered yet) → Continue
   
   DO NOT add "more insights" or "additional analysis" if the question is already answered!

3. **EXPLORATORY/ANALYSIS REQUESTS** (Vague, asking for insights/patterns):
   Examples: "analyze this data", "show me patterns", "explore the dataset", "what trends exist", "tell me about this data"
   - If {len(all_sql_queries)} >= 3 → STOP (sufficient exploration)
   - If {len(all_sql_queries)} < 3 → Continue with different angle

IMPORTANT: Analyze the user's question "{request_data.query}":
- Is it asking for ONE specific thing that can be directly answered? (If YES and we have it → STOP)
- Or is it exploratory/vague asking for general insights? (If YES → Continue until 3 queries)

RESPONSE FORMAT:
- If STOP: Say only "QUERY_COMPLETE"
- If CONTINUE: Brief reason (1 sentence) + "MULTI_STEP_QUERY: Step {iteration + 1}" + SQL query

Your decision:"""
            
            next_step_response = await ai_service.generate_response(
                query=next_step_prompt,
                model=model,
                api_key=api_key,
                conversation_history=conversation_history,
                table_schemas=table_schemas,
                db_session=db,
                conversation_id=conversation_id
            )
            
            # Extract and show AI's brief reasoning
            reasoning = next_step_response.split('MULTI_STEP_QUERY')[0].split('QUERY_COMPLETE')[0].strip()
            
            if 'QUERY_COMPLETE' in next_step_response:
                break
            
            # Extract next SQL query
            sql_query = extract_sql_from_response(next_step_response)
            if not sql_query:
                break
            
            # Store reasoning for the NEXT query (will be used when building database content)
            if reasoning:
                # Clean reasoning text before streaming (same cleanup as in database storage)
                cleaned_reasoning = reasoning.rstrip()
                if cleaned_reasoning.endswith('**'):
                    cleaned_reasoning = cleaned_reasoning[:-2].rstrip()
                
                # Show cleaned reasoning to user (full text, no truncation)
                yield f"data: {json.dumps({'type': 'brief_reasoning', 'content': cleaned_reasoning})}\n\n"
                # Store the original reasoning for database content building
                all_reasoning.append(reasoning)
            else:
                all_reasoning.append(None)
            
            ai_response = next_step_response  # Update for multi-step detection
        
        # Use the last successful result for conclusion
        result = all_results[-1] if all_results else None
        sql_query = all_sql_queries[-1] if all_sql_queries else None
        
        if result and result['success'] and result['row_count'] > 0:
            # Send loading status before generating conclusion
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is generating conclusion...'})}\n\n"
            
            # Ask AI to provide conclusion based on ALL results
            if len(all_results) > 1:
                # Multi-step query - show all results
                results_summary = []
                total_queries = len(all_sql_queries)
                
                for i, (query, res) in enumerate(zip(all_sql_queries, all_results), 1):
                    # Determine if this is one of the last 5 results
                    is_last_5 = i > total_queries - 5
                    # Determine if this is the last (most recent) query
                    is_last_query = i == total_queries
                    
                    # Limit rows based on query count and position
                    raw_data = res.get('data', [])
                    limited_data = _limit_result_rows(raw_data, total_queries, is_last_5, is_last_query)
                    
                    # Determine text truncation length based on query count and position
                    truncation_length = _get_text_truncation_length(total_queries, is_last_5)
                    
                    # Truncate text fields with dynamic length
                    truncated_data = _truncate_text_fields(limited_data, max_length=truncation_length)
                    
                    results_summary.append({
                        'step': i,
                        'query': query,
                        'row_count': res.get('row_count', 0),
                        'data': truncated_data
                    })
                
                conclusion_prompt = f"""Based on the multi-step query results below, provide a comprehensive conclusion.

Original Question: {request_data.query}

Query Results (multiple steps):
{json.dumps(results_summary, indent=2)}

Provide a clear answer to the user's question, synthesizing insights from all query steps. Keep it conversational and under 5 sentences.

IMPORTANT: Do NOT add headers like "Conclusion:", "Answer:", or any emoji prefixes. Start directly with your analysis.

Then, offer 2-3 helpful follow-up suggestions using this EXACT format:
<suggestions>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
</suggestions>

Suggestion Guidelines (create diverse, visualization-friendly queries):
- Each suggestion should lead to a different type of data analysis
- Use patterns like: "Compare X across Y", "Show top/bottom N by Z", "Show trend of X over time", "Show distribution of X", "Compare X and Y across Z"
- Make suggestions specific to the actual columns in the dataset
- Avoid vague suggestions like "analyze more" - be concrete and actionable"""
            else:
                # Single query
                # Apply text truncation and row limiting for single query results
                raw_data = result.get('data', [])
                limited_data = _limit_result_rows(raw_data, 1, True, True)  # Single query, treat as last 5 and last query
                truncated_data = _truncate_text_fields(limited_data, max_length=20)
                
                conclusion_prompt = f"""Based on the query results below, provide a brief, insightful conclusion.

Query returned {result['row_count']} row(s).

Results:
{json.dumps(truncated_data, indent=2)}

Provide a concise summary highlighting the key insights from this data. Keep it conversational and under 3 sentences.

IMPORTANT: Do NOT add headers like "Conclusion:", "Answer:", or any emoji prefixes. Start directly with your analysis.

Then, offer 2-3 helpful follow-up suggestions using this EXACT format:
<suggestions>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
<suggestion>Imperative command for specific actionable analysis (no question mark)</suggestion>
</suggestions>

Suggestion Guidelines (create diverse, visualization-friendly queries):
- Each suggestion should lead to a different type of data analysis
- Use patterns like: "Compare X across Y", "Show top/bottom N by Z", "Show trend of X over time", "Show distribution of X", "Compare X and Y across Z"
- Make suggestions specific to the actual columns in the dataset
- Avoid vague suggestions like "analyze more" - be concrete and actionable"""
            
            # Stream the final answer chunk by chunk
            final_answer = ""
            async for chunk in ai_service.generate_response_stream(
                query=conclusion_prompt,
                model=model,
                api_key=api_key,
                conversation_history=conversation_history,
                db_session=db,
                conversation_id=conversation_id
            ):
                final_answer += chunk
                yield f"data: {json.dumps({'type': 'final_answer_chunk', 'content': chunk})}\n\n"
            
            yield f"data: {json.dumps({'type': 'final_answer_complete', 'content': final_answer})}\n\n"
    
    # Build the complete assistant message content for database storage
    assistant_content = ""
    
    # For multi-step queries, include ALL steps
    if len(all_sql_queries) > 1:
        for i, (query, res) in enumerate(zip(all_sql_queries, all_results), 1):
            # Add reasoning before this step (if available)
            # Reasoning at index i-2 explains why we're doing query i (query 2 uses reasoning[0], query 3 uses reasoning[1], etc.)
            if i > 1 and i-2 < len(all_reasoning) and all_reasoning[i-2]:
                # Strip trailing whitespace and markdown formatting from reasoning to avoid extra newlines/asterisks
                reasoning_text = all_reasoning[i-2].rstrip()
                # Remove trailing ** if present (AI sometimes adds this)
                if reasoning_text.endswith('**'):
                    reasoning_text = reasoning_text[:-2].rstrip()
                assistant_content += f"\n\n---\n\n💭 **Next Step:** {reasoning_text}\n\n"
            elif i > 1:
                assistant_content += f"\n\n---\n\n💭 **Next Step:** Analyzing further...\n\n"
            
            # Use shared function to build result content
            assistant_content += build_result_content_for_storage(query, res, include_chart=True)
    else:
        # Single query - use shared function
        if sql_query and result:
            assistant_content = build_result_content_for_storage(sql_query, result, include_chart=True)

    
    if final_answer:
        if assistant_content:
            assistant_content += f"\n\n---\n\n**Answer:**\n{final_answer}"
        else:
            # If no SQL/results, just add the answer without separator
            assistant_content = final_answer
    
    # Save assistant message to database
    assistant_message = crud.create_message(
        db=db,
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_content,
        model=model
    )
    
    # Update conversation timestamp
    crud.update_conversation_timestamp(db, conversation_id)
    
    # Send completion
    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
