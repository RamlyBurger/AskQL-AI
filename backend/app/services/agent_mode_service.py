"""Agent Mode service for handling CRUD operations on datasets - Revised to work like Ask Mode."""
import json
import re
import asyncio
from typing import AsyncGenerator, List
from sqlalchemy.orm import Session

from app import crud, schemas
from app.models import Message
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


def extract_table_names_from_message(message: str, available_tables: List[str]) -> List[str]:
    """
    Extract table names mentioned with @ symbols from a message.
    
    Args:
        message: The user message to parse
        available_tables: List of available table names
        
    Returns:
        List of table names mentioned in the message
    """
    mentioned_tables = []
    mention_pattern = re.compile(r'@(\w+)')
    
    for match in mention_pattern.finditer(message):
        table_name = match.group(1)
        # Include if it's 'general' or a valid table, and not already in the list
        if (table_name == "general" or table_name in available_tables) and table_name not in mentioned_tables:
            mentioned_tables.append(table_name)
    
    return mentioned_tables


async def process_agent_mode_stream(
    request_data: schemas.AskRequest,
    conversation_id: int,
    user_message_id: int,
    model: str,
    api_key: str,
    db: Session,
    is_continuation: bool = False
) -> AsyncGenerator[str, None]:
    """
    Process an Agent Mode query with streaming response - REVISED to work like Ask Mode.
    Uses a single message that streams content and pauses for confirmation on destructive operations.
    
    Args:
        request_data: The ask request data
        conversation_id: ID of the conversation
        user_message_id: ID of the user message
        model: AI model to use
        api_key: API key for the AI provider
        db: Database session
        is_continuation: Whether this is a continuation after confirmation
        
    Yields:
        Server-sent events with operation details and results
    """
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
    
    # Extract table names mentioned in the current user message to check for @general
    dataset_service = get_dataset_service()
    available_tables = dataset_service.get_all_table_names()  # Get all available tables
    mentioned_tables = extract_table_names_from_message(request_data.query, available_tables)
    
    # Check if @general is used - redirect to general conversation
    is_general_mode = 'general' in mentioned_tables
    
    if is_general_mode:
        # Handle @general questions by providing context from conversation history
        user_question = request_data.query.replace("@general", "").strip().lower()
        
        # Look for the last user question in conversation history
        last_user_question = None
        for msg in reversed(conversation_history):
            if msg["role"] == "user":
                last_user_question = msg["content"]
                break
        
        if "what did i ask" in user_question or "what was my question" in user_question:
            if last_user_question:
                general_message = f"Your last question was: **\"{last_user_question}\"**"
            else:
                general_message = "I don't see any previous questions in our conversation history."
        else:
            # For other general questions, use AI service to provide actual answers
            try:
                # Get AI response for the general question
                general_message = await ai_service.generate_response(
                    query=request_data.query.replace("@general", "").strip(),
                    model=model,
                    api_key=api_key,
                    conversation_history=conversation_history,
                    is_general_mode=True,
                    attachments=request_data.attachments if hasattr(request_data, 'attachments') else None,
                    db_session=db,
                    conversation_id=conversation_id
                )
            except Exception as e:
                # Fallback if AI service fails
                general_message = f"I can help with general questions, but encountered an error: {str(e)}. Please try again or switch to Ask Mode for general conversations."
        
        yield f"data: {json.dumps({'type': 'final_answer', 'content': general_message})}\n\n"
        
        # Save message
        assistant_message = crud.create_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content=general_message,
            model=model
        )
        
        crud.update_conversation_timestamp(db, conversation_id)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
        return
    
    # Check if tables are mentioned (required for Agent Mode, unless it's Execute/Cancel)
    if not mentioned_tables and request_data.query.strip().lower() not in ['execute', 'cancel']:
        # Return error message
        error_message = "Please select at least one dataset by using @ mention in your message (e.g., @dataset_name). Agent Mode requires a dataset to perform operations on."
        
        yield f"data: {json.dumps({'type': 'final_answer', 'content': error_message})}\n\n"
        
        # Save error message
        assistant_message = crud.create_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content=error_message,
            model=model
        )
        
        crud.update_conversation_timestamp(db, conversation_id)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
        return
    
    # Get table schemas only for tables mentioned in the current message
    table_schemas = []
    if mentioned_tables:
        for table_name in mentioned_tables:
            if table_name != "general":  # Skip @general as it's not a real table
                try:
                    schema = dataset_service.get_table_schema(table_name)
                    table_schemas.append(schema)
                except Exception as e:
                    print(f"Failed to get schema for table {table_name}: {str(e)}")
    
    # Check if this is a confirmation response (Execute/Cancel)
    if request_data.query.strip().lower() in ['execute', 'cancel']:
        async for event in handle_confirmation_response(
            request_data, conversation_id, user_message_id, model, api_key, db, 
            available_tables, conversation_history
        ):
            yield event
        return
    
    # Start the agent mode processing like ask mode - single streaming message
    async for event in process_agent_operations_stream(
        request_data, conversation_id, user_message_id, model, api_key, db,
        table_schemas, conversation_history
    ):
        yield event


async def handle_confirmation_response(
    request_data, conversation_id, user_message_id, model, api_key, db,
    available_tables, conversation_history
):
    """Handle Execute/Cancel confirmation responses."""
    # Find the original user message and table schemas for Execute/Cancel operations
    messages = crud.get_conversation_messages(db, conversation_id)
    
    # Find the last user message that contains @ mentions (before the current Execute/Cancel)
    mentioned_tables = []
    for msg in reversed(messages):
        if msg.role == 'user' and msg.id != user_message_id and '@' in msg.content:
            mentioned_tables = extract_table_names_from_message(msg.content, available_tables)
            break
    
    # Rebuild table schemas for the mentioned tables
    table_schemas = []
    dataset_service = get_dataset_service()
    for table_name in mentioned_tables:
        if table_name != "general":
            try:
                schema = dataset_service.get_table_schema(table_name)
                table_schemas.append(schema)
            except Exception as e:
                print(f"Failed to get schema for table {table_name}: {str(e)}")
    
    # Find the last assistant message with SQL
    last_assistant_msg = None
    for msg in reversed(messages):
        if msg.role == 'assistant' and '**SQL to Execute:**' in msg.content:
            last_assistant_msg = msg
            break
    
    if last_assistant_msg and request_data.query.strip().lower() == 'execute':
        # Extract SQL from the last message
        sql_match = re.search(r'```sql\n(.*?)\n```', last_assistant_msg.content, re.DOTALL)
        operation_match = re.search(r'operation="(\w+)"', last_assistant_msg.content)
        
        if sql_match and operation_match:
            sql_query = sql_match.group(1).strip()
            operation = operation_match.group(1).strip()
            
            # Execute the operation
            result = dataset_service.execute_write_query(sql_query)
            
            # Remove confirmation buttons from the message
            updated_content = re.sub(r'\n\n<confirmation[^>]+/>', '', last_assistant_msg.content)
            updated_content = re.sub(r'\*\*⚠️ This operation will modify your data\. Please confirm:\*\*\n*', '', updated_content)
            
            # Build result content to append
            if result.get('success'):
                row_count = result.get('row_count', 0)
                result_summary = f"Successfully executed {operation} operation. {row_count} row(s) affected."
                result_content = f"\n\n**✅ Result:** {result_summary}"
            else:
                error_msg = result.get('error', 'Unknown error')
                result_summary = f"Operation failed: {error_msg}"
                result_content = f"\n\n**❌ Error:** {result_summary}"
            
            # Update the message content
            last_assistant_msg.content = updated_content.strip() + result_content
            
            # Delete the "Execute" user message
            user_msg = db.query(Message).filter(Message.id == user_message_id).first()
            if user_msg:
                db.delete(user_msg)
            
            # Stream the result to frontend
            yield f"data: {json.dumps({'type': 'sql_result', 'content': result})}\n\n"
            
            # Continue with next operations if successful
            if result.get('success'):
                # Continue streaming in the same message
                async for event in continue_agent_operations_stream(
                    last_assistant_msg, conversation_id, user_message_id, model, api_key, db,
                    table_schemas, conversation_history
                ):
                    yield event
            else:
                crud.update_conversation_timestamp(db, conversation_id)
                db.commit()
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'assistant_message_id': last_assistant_msg.id})}\n\n"
    
    elif request_data.query.strip().lower() == 'cancel':
        # User cancelled - remove confirmation buttons
        if last_assistant_msg:
            updated_content = re.sub(r'\n\n<confirmation[^>]+/>', '', last_assistant_msg.content)
            updated_content = re.sub(r'\*\*⚠️ This operation will modify your data\. Please confirm:\*\*\n*', '', updated_content)
            last_assistant_msg.content = updated_content.strip()
        
        # Delete the "Cancel" user message
        user_msg = db.query(Message).filter(Message.id == user_message_id).first()
        if user_msg:
            db.delete(user_msg)
        
        db.commit()
        yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Operation cancelled'})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id})}\n\n"


async def process_agent_operations_stream(
    request_data, conversation_id, user_message_id, model, api_key, db,
    table_schemas, conversation_history
):
    """Process agent operations with streaming like ask mode."""
    
    # Use the exact same pattern as ask mode - start with AI analysis
    ai_response = await ai_service.generate_response(
        query=request_data.query,
        model=model,
        api_key=api_key,
        conversation_history=conversation_history,
        table_schemas=table_schemas,
        is_agent_mode=True,
        db_session=db,
        conversation_id=conversation_id
    )
    
    # Send initial AI response like ask mode
    yield f"data: {json.dumps({'type': 'ai_response', 'content': ai_response})}\n\n"
    
    # Extract SQL from AI response
    sql_query = extract_sql_from_response(ai_response)
    
    if not sql_query:
        # No SQL found, just return the AI response as final answer
        yield f"data: {json.dumps({'type': 'final_answer', 'content': ai_response})}\n\n"
        
        # Save assistant message
        assistant_message = crud.create_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content=ai_response,
            model=model
        )
        
        crud.update_conversation_timestamp(db, conversation_id)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
        return
    
    # Determine operation type
    sql_upper = sql_query.upper().strip()
    if sql_upper.startswith("SELECT"):
        operation = "READ"
    elif sql_upper.startswith("INSERT"):
        operation = "CREATE"
    elif sql_upper.startswith("UPDATE"):
        operation = "UPDATE"
    elif sql_upper.startswith("DELETE"):
        operation = "DELETE"
    else:
        operation = "READ"  # Default
    
    # Create assistant message that will be updated
    streamingMessageId = (Date.now() + 1) if 'Date' in globals() else (conversation_id * 1000 + user_message_id)
    
    # For destructive operations, request confirmation first
    if operation in ["CREATE", "UPDATE", "DELETE"]:
        # Build confirmation message content
        import base64
        encoded_sql = base64.b64encode(sql_query.encode()).decode()
        encoded_message = base64.b64encode(f"{operation} operation".encode()).decode()
        
        # Check if AI response already contains the SQL formatting
        if "**SQL to Execute:**" in ai_response or "```sql" in ai_response:
            # AI already formatted the SQL, just add confirmation
            confirmation_content = f"{ai_response}\n\n**⚠️ This operation will modify your data. Please confirm:**\n\n<confirmation operation=\"{operation}\" sql=\"{encoded_sql}\" message=\"{encoded_message}\" model=\"{model}\" />"
        else:
            # AI didn't format SQL, add it manually
            confirmation_content = f"{ai_response}\n\n**SQL to Execute:**\n```sql\n{sql_query}\n```\n\n**⚠️ This operation will modify your data. Please confirm:**\n\n<confirmation operation=\"{operation}\" sql=\"{encoded_sql}\" message=\"{encoded_message}\" model=\"{model}\" />"
        
        # Create assistant message with confirmation
        assistant_message = crud.create_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content=confirmation_content,
            model=model
        )
        
        # Send confirmation required event
        yield f"data: {json.dumps({'type': 'confirmation_required', 'content': {'operation': operation, 'sql': sql_query, 'message': f'{operation} operation'}})}\n\n"
        
        crud.update_conversation_timestamp(db, conversation_id)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
        return
    
    # For READ operations, execute immediately like ask mode
    else:
        # Create initial assistant message
        assistant_message = crud.create_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content="",
            model=model
        )
        
        # Execute query with streaming like ask mode (frontend builds content)
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
        
        # Get result for final content building
        result = result_storage.get('result')
        chart_config = result_storage.get('chart_config')
        
        if chart_config:
            result['chart_config'] = chart_config
        
        # Multi-step logic like ask mode
        all_results = [result]
        all_sql_queries = [sql_query]
        all_reasoning = []  # Store reasoning for each step like ask mode
        max_iterations = 10
        iteration = 1
        
        # Continue with multi-step queries if needed
        while iteration < max_iterations:
            # Check if we should continue (like ask mode multi-step logic)
            # Build results summary for the prompt
            results_summary = []
            for q, r in zip(all_sql_queries, all_results):
                results_summary.append({
                    'query': q,
                    'row_count': r.get('row_count', 0),
                    'success': r.get('success', False)
                })
            
            next_step_prompt = f"""Agent Mode Multi-Step Analysis

⚠️ CRITICAL RESTRICTIONS (MUST follow - violations will FAIL):
- ABSOLUTELY NO: ALTER, DROP, CREATE, TRUNCATE commands
- ABSOLUTELY NO: CTEs (WITH clauses)  
- ABSOLUTELY NO: Window functions (OVER/PARTITION BY/LAG/LEAD)
- ONLY ALLOWED: SELECT, INSERT, UPDATE, DELETE
- For data insertion: use **ONE** INSERT statement with multiple VALUES rows
- NEVER add columns or modify table structure - work with existing columns only

Original Question: {request_data.query}
Queries Executed So Far: {len(all_sql_queries)}

Previous Results:
{json.dumps(results_summary, indent=2)}

CRITICAL RULES - Apply in this exact order:

1. **EXPLICIT NUMBER REQUESTS** ("run 5 queries", "execute 10 operations"):
   - If user specified a number AND {len(all_sql_queries)} < that number → Continue
   - If user specified a number AND {len(all_sql_queries)} >= that number → STOP

2. **SPECIFIC DATA QUESTIONS** (User asks for ONE specific thing):
   Examples: "show total sales for each store", "display top 5 stores", "count of customers"
   
   ⚠️ CRITICAL CHECK - Does the current result ALREADY answer the user's specific question?
   - Review the user's question: "{request_data.query}"
   - Review the last result: Does it contain the data the user asked for?
   - If YES (question is answered) → STOP IMMEDIATELY
   - If NO (question not answered yet) → Continue
   
   DO NOT add "more insights" or "additional analysis" if the question is already answered!

3. **DATA INSERTION/MODIFICATION REQUESTS**:
   - If user asked to insert/create data and insertion was successful → STOP
   - If user asked to insert/create data but insertion failed → Continue with alternative

4. **EXPLORATORY/ANALYSIS REQUESTS** (Vague, asking for insights/patterns):
   Examples: "analyze this data", "show me patterns", "explore the dataset"
   - If {len(all_sql_queries)} >= 3 → STOP (sufficient exploration)
   - If {len(all_sql_queries)} < 3 → Continue with different angle

IMPORTANT: Analyze "{request_data.query}":
- Is it asking for ONE specific thing that can be directly answered? (If YES and we have it → STOP)
- Or is it exploratory/vague asking for general insights? (If YES → Continue until 3 queries)

RESPONSE FORMAT:
- If STOP: Say only "QUERY_COMPLETE"
- If CONTINUE: Brief reason (1 sentence) + "MULTI_STEP_QUERY: Step {iteration + 1}" + SQL query

Your decision:
"""
            
            # Send loading status while AI decides next step
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is analyzing results...'})}\n\n"
            
            next_step_response = await ai_service.generate_response(
                query=next_step_prompt,
                model=model,
                api_key=api_key,
                conversation_history=conversation_history,
                table_schemas=table_schemas,
                db_session=db,
                conversation_id=conversation_id
            )
            
            if 'QUERY_COMPLETE' in next_step_response:
                break
            
            # Extract next SQL query
            next_sql = extract_sql_from_response(next_step_response)
            if not next_sql:
                break
            
            iteration += 1
            
            # Show reasoning for next step
            reasoning = next_step_response.split('MULTI_STEP_QUERY')[0].split('QUERY_COMPLETE')[0].strip()
            if reasoning:
                cleaned_reasoning = reasoning.rstrip()
                if cleaned_reasoning.endswith('**'):
                    cleaned_reasoning = cleaned_reasoning[:-2].rstrip()
                yield f"data: {json.dumps({'type': 'brief_reasoning', 'content': cleaned_reasoning})}\n\n"
                # Store the original reasoning for database content building
                all_reasoning.append(reasoning)
                
                # Show AI is planning after the delay
                yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is planning...'})}\n\n"
                
                # Add delay to show planning status
                await asyncio.sleep(1.0)
            else:
                all_reasoning.append(None)
            
            # Send status that AI is writing SQL commands
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is writing SQL commands...'})}\n\n"
            await asyncio.sleep(0.5)
            
            # Check if next query is destructive and needs confirmation
            next_sql_upper = next_sql.upper().strip()
            if next_sql_upper.startswith("INSERT"):
                next_operation = "CREATE"
            elif next_sql_upper.startswith("UPDATE"):
                next_operation = "UPDATE"
            elif next_sql_upper.startswith("DELETE"):
                next_operation = "DELETE"
            else:
                next_operation = "READ"
            
            if next_operation in ["CREATE", "UPDATE", "DELETE"]:
                # This is a destructive operation - request confirmation
                # Build current content from all previous steps
                current_content = ""
                
                # Add all previous steps to current content
                for i, (prev_query, prev_res) in enumerate(zip(all_sql_queries, all_results), 1):
                    if i > 1:
                        # Add reasoning for this step if available
                        if i-2 < len(all_reasoning) and all_reasoning[i-2]:
                            reasoning_text = all_reasoning[i-2].rstrip()
                            if reasoning_text.endswith('**'):
                                reasoning_text = reasoning_text[:-2].rstrip()
                            current_content += f"\n\n---\n\n💭 **Next Step:** {reasoning_text}\n\n"
                        else:
                            current_content += f"\n\n---\n\n💭 **Next Step:** Analyzing further...\n\n"
                    
                    # Add query result content
                    current_content += build_result_content_for_storage(prev_query, prev_res, include_chart=True)
                
                # Add separator and confirmation for the new destructive operation
                if len(all_sql_queries) > 0:
                    # Add reasoning for the destructive operation
                    if len(all_reasoning) > 0 and all_reasoning[-1]:
                        reasoning_text = all_reasoning[-1].rstrip()
                        if reasoning_text.endswith('**'):
                            reasoning_text = reasoning_text[:-2].rstrip()
                        current_content += f"\n\n---\n\n💭 **Next Step:** {reasoning_text}\n\n"
                    else:
                        current_content += f"\n\n---\n\n💭 **Next Step:** Based on the analysis, I need to execute a {next_operation} operation.\n\n"
                
                # Add confirmation request
                import base64
                encoded_sql = base64.b64encode(next_sql.encode()).decode()
                encoded_message = base64.b64encode(f"Step {iteration}: {next_operation} operation".encode()).decode()
                
                confirmation_content = f"**SQL to Execute:**\n```sql\n{next_sql}\n```\n\n**⚠️ This operation will modify your data. Please confirm:**\n\n<confirmation operation=\"{next_operation}\" sql=\"{encoded_sql}\" message=\"{encoded_message}\" model=\"{model}\" />"
                
                # Update the existing assistant message with all content + confirmation
                assistant_message.content = current_content + confirmation_content
                db.commit()
                
                # Send confirmation required event
                yield f"data: {json.dumps({'type': 'confirmation_required', 'content': {'operation': next_operation, 'sql': next_sql, 'message': f'Step {iteration}: {next_operation} operation'}})}\n\n"
                
                crud.update_conversation_timestamp(db, conversation_id)
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"
                return
            else:
                # Add delay to show 'AI is writing SQL commands' message before execution
                await asyncio.sleep(1.5)
                
                # Execute READ query normally
                next_result_storage = {}
                async for event in execute_select_query_with_chart(
                    sql_query=next_sql,
                    user_query=request_data.query,
                    model=model,
                    api_key=api_key,
                    result_storage=next_result_storage,
                    db_session=db,
                    conversation_id=conversation_id
                ):
                    yield event
                
                # Store results
                next_result = next_result_storage.get('result')
                next_chart_config = next_result_storage.get('chart_config')
                
                if next_chart_config:
                    next_result['chart_config'] = next_chart_config
                
                all_sql_queries.append(next_sql)
                all_results.append(next_result)
        
        # Generate final conclusion like ask mode
        yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is generating conclusion...'})}\n\n"
        
        if len(all_results) > 1:
            # Multi-step conclusion
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

IMPORTANT: Do NOT add headers like "Conclusion:", "Answer:", or any emoji prefixes. Start directly with your analysis."""
        else:
            # Single query conclusion
            # Apply text truncation and row limiting for single query results
            raw_data = result.get('data', [])
            limited_data = _limit_result_rows(raw_data, 1, True, True)  # Single query, treat as last 5 and last query
            truncated_data = _truncate_text_fields(limited_data, max_length=20)
            
            conclusion_prompt = f"""Based on the query results below, provide a brief, insightful conclusion.

Query returned {result['row_count']} row(s).

Results:
{json.dumps(truncated_data, indent=2)}

Provide a concise summary highlighting the key insights from this data. Keep it conversational and under 3 sentences.

IMPORTANT: Do NOT add headers like "Conclusion:", "Answer:", or any emoji prefixes. Start directly with your analysis."""
        
        # Stream the final answer like ask mode
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
        
        # Build complete assistant message content for database storage (like ask mode)
        assistant_content = ""
        
        # For multi-step queries, include ALL steps like ask mode
        if len(all_sql_queries) > 1:
            for i, (query, res) in enumerate(zip(all_sql_queries, all_results), 1):
                # Add reasoning before this step (if available) like ask mode
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
                assistant_content += f"\n\n---\n\n**💡 Conclusion:**\n{final_answer}"
            else:
                assistant_content = final_answer
        
        assistant_message.content = assistant_content
        
        # Save final message
        crud.update_conversation_timestamp(db, conversation_id)
        db.commit()
        
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message.id})}\n\n"


async def continue_agent_operations_stream(
    assistant_message, conversation_id, user_message_id, model, api_key, db,
    table_schemas, conversation_history
):
    """Continue agent operations after confirmation in the same message."""
    
    # Use the same multi-step analysis prompt as the main flow
    # Get conversation history to understand what's been done
    messages = crud.get_conversation_messages(db, conversation_id)
    
    # Extract the original user request - find the first user message in this conversation
    original_request = "Continue with remaining operations"
    for msg in messages:
        if msg.role == 'user':
            original_request = msg.content
            break  # Get the first user message, which contains the original request
    
    # Build results summary from conversation - be more specific about what was done
    results_summary = []
    operation_count = 0
    import re
    
    # Look through all assistant messages for completed operations
    for msg in messages:
        if msg.role == 'assistant':
            # Find all success result patterns in the message content
            result_patterns = re.findall(r'\*\*✅ Result:\*\* Successfully (created|deleted|updated) (\d+) record\(s\)\.', msg.content)
            # Find all error result patterns
            error_patterns = re.findall(r'\*\*❌ Error:\*\* (.+)', msg.content)
            
            for pattern in result_patterns:
                operation_count += 1
                operation_verb = pattern[0]  # created, deleted, updated
                record_count = pattern[1]
                
                if operation_verb == "created":
                    operation_type = "INSERT"
                    details = f"Added {record_count} records"
                elif operation_verb == "deleted":
                    operation_type = "DELETE"
                    details = f"Deleted {record_count} records"
                elif operation_verb == "updated":
                    operation_type = "UPDATE"
                    details = f"Updated {record_count} records"
                else:
                    operation_type = operation_verb.upper()
                    details = f"{operation_verb.capitalize()} {record_count} records"
                
                results_summary.append({
                    'step': operation_count,
                    'operation': operation_type,
                    'details': details,
                    'success': True
                })
            
            # Process error patterns
            for error_message in error_patterns:
                operation_count += 1
                results_summary.append({
                    'step': operation_count,
                    'operation': 'ERROR',
                    'details': f"Operation failed: {error_message}",
                    'success': False
                })
    
    next_step_prompt = f"""Agent Mode Multi-Step Analysis

⚠️ CRITICAL RESTRICTIONS (MUST follow - violations will FAIL):
- ABSOLUTELY NO: ALTER, DROP, CREATE, TRUNCATE commands
- ABSOLUTELY NO: CTEs (WITH clauses)  
- ABSOLUTELY NO: Window functions (OVER/PARTITION BY/LAG/LEAD)
- ONLY ALLOWED: SELECT, INSERT, UPDATE, DELETE
- For data insertion: use **ONE** INSERT statement with multiple VALUES rows
- NEVER add columns or modify table structure - work with existing columns only

Original Question: {original_request}

COMPLETION DECISION: Should we stop or continue?

Original User Question: "{original_request}"
Operations Executed So Far: {operation_count}

Previous Results:
{json.dumps(results_summary, indent=2)}

CRITICAL RULES - Apply in this exact order:

1. **EXPLICIT NUMBER REQUESTS** ("run 5 queries", "execute 10 operations"):
   - If user specified a number AND {operation_count} < that number → Continue
   - If user specified a number AND {operation_count} >= that number → STOP

2. **SPECIFIC DATA QUESTIONS** (User asks for ONE specific thing):
   Examples: "show total sales for each store", "display top 5 stores", "count of customers"
   
   ⚠️ CRITICAL CHECK - Does the current result ALREADY answer the user's specific question?
   - Review the user's question: "{original_request}"
   - Review the last result: Does it contain the data the user asked for?
   - If YES (question is answered) → STOP IMMEDIATELY
   - If NO (question not answered yet) → Continue
   
   DO NOT add "more insights" or "additional analysis" if the question is already answered!

3. **DATA INSERTION/MODIFICATION REQUESTS**:
   - If user asked to insert/create data and insertion was successful → STOP
   - If user asked to insert/create data but insertion failed → Continue with alternative

4. **EXPLORATORY/ANALYSIS REQUESTS** (Vague, asking for insights/patterns):
   Examples: "analyze this data", "show me patterns", "explore the dataset"
   - If {operation_count} >= 3 → STOP (sufficient exploration)
   - If {operation_count} < 3 → Continue with different angle

IMPORTANT: Analyze "{original_request}":
- Is it asking for ONE specific thing that can be directly answered? (If YES and we have it → STOP)
- Or is it exploratory/vague asking for general insights? (If YES → Continue until 3 queries)

RESPONSE FORMAT:
- If STOP: Say only "OPERATION_COMPLETE"
- If CONTINUE: Brief reason (1 sentence) + "MULTI_STEP_QUERY: Step {operation_count + 1}" + SQL query

Your decision:"""
    
    # Show loading status while AI analyzes
    yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is analyzing data...'})}\n\n"
    
    # Debug: Save prompt and response to file
    import os
    debug_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'debug')
    os.makedirs(debug_dir, exist_ok=True)
    
    with open(os.path.join(debug_dir, 'agent_continuation_prompt.txt'), 'w', encoding='utf-8') as f:
        f.write("=== AGENT CONTINUATION PROMPT ===\n\n")
        f.write(next_step_prompt)
        f.write("\n\n=== END PROMPT ===\n")
    
    next_step_response = await ai_service.generate_response(
        query=next_step_prompt,
        model=model,
        api_key=api_key,
        conversation_history=conversation_history,
        table_schemas=table_schemas,
        is_agent_mode=True,
        db_session=db,
        conversation_id=conversation_id
    )
    
    if 'OPERATION_COMPLETE' in next_step_response:
        # Generate conclusion and finish
        yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is generating conclusion...'})}\n\n"
        
        conclusion_prompt = f"""Based on the conversation history, provide a brief conclusion summarizing what operations were completed.

Provide a concise, friendly summary of what was accomplished. Keep it under 2 sentences."""
        
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
        
        # Add summary to database for persistence, but frontend won't reload
        assistant_message.content += f"\n\n**💡 Summary:**\n{final_answer}"
        crud.update_conversation_timestamp(db, conversation_id)
        db.commit()
        
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'assistant_message_id': assistant_message.id})}\n\n"
        return
    
    # Check if AI wants to continue with another step
    if 'MULTI_STEP_QUERY' in next_step_response:
        # Extract SQL from AI response
        next_sql = extract_sql_from_response(next_step_response)
        
        if next_sql:
            # Determine operation type
            sql_upper = next_sql.upper().strip()
            if sql_upper.startswith("SELECT"):
                next_op_type = "READ"
            elif sql_upper.startswith("INSERT"):
                next_op_type = "CREATE"
            elif sql_upper.startswith("UPDATE"):
                next_op_type = "UPDATE"
            elif sql_upper.startswith("DELETE"):
                next_op_type = "DELETE"
            else:
                next_op_type = "READ"  # Default
            
            # Extract reasoning from the response
            reasoning_part = next_step_response.split('MULTI_STEP_QUERY')[0].strip()
            
            # Clean up the reasoning text - remove incomplete markdown formatting
            if reasoning_part.endswith('**'):
                reasoning_part = reasoning_part[:-2].strip()
            if reasoning_part.endswith('*'):
                reasoning_part = reasoning_part[:-1].strip()
            
            # Remove any trailing punctuation that might be incomplete
            reasoning_part = reasoning_part.rstrip('*').strip()
            
            next_message = reasoning_part if reasoning_part else f"Step {operation_count + 1}: {next_op_type} operation"
            
            # Send the next step reasoning first
            yield f"data: {json.dumps({'type': 'brief_reasoning', 'content': next_message})}\n\n"
            await asyncio.sleep(0.5)
            
            # Show loading status while preparing next step
            yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is writing SQL commands...'})}\n\n"
            await asyncio.sleep(0.5)
            
            if next_op_type == "READ":
                # Execute READ operation with streaming
                result_storage = {}
                event_count = 0
                async for event in execute_select_query_with_chart(
                    sql_query=next_sql,
                    user_query=f"{next_message} - {next_sql}",
                    model=model,
                    api_key=api_key,
                    result_storage=result_storage,
                    db_session=db,
                    conversation_id=conversation_id
                ):
                    event_count += 1
                    yield event
                
                # After streaming is complete, add result to message and continue
                result = result_storage.get('result')
                chart_config = result_storage.get('chart_config')
                
                # Add chart_config to result if it exists
                if chart_config and result:
                    result['chart_config'] = chart_config
                
                if result and result.get("success"):
                    # Build content for database storage
                    verification_content = f"\n\n{next_message}\n\n"
                    verification_content += build_result_content_for_storage(next_sql, result, include_chart=True)
                    assistant_message.content += verification_content
                    db.commit()
                    
                # After READ operation, continue to next step (but don't recurse infinitely)
                # Fall through to the conclusion generation logic below
            
            elif next_op_type in ["CREATE", "UPDATE", "DELETE"]:
                # Request confirmation for destructive operation
                import base64
                encoded_sql = base64.b64encode(next_sql.encode()).decode()
                encoded_message = base64.b64encode(next_message.encode()).decode()
                
                # Append confirmation to the existing message (don't create new message)
                confirmation_content = f"**SQL to Execute:**\n```sql\n{next_sql}\n```\n\n**⚠️ This operation will modify your data. Please confirm:**\n\n<confirmation operation=\"{next_op_type}\" sql=\"{encoded_sql}\" message=\"{encoded_message}\" model=\"{model}\" />"
                
                # Include the brief reasoning in the database so it persists after reload
                # This ensures the reasoning is visible after page refresh
                full_content = f"\n\n---\n\n💭 **Next Step:** {next_message}\n\n{confirmation_content}"
                assistant_message.content += full_content
                crud.update_conversation_timestamp(db, conversation_id)
                db.commit()
                
                yield f"data: {json.dumps({'type': 'confirmation_required', 'content': {'operation': next_op_type, 'sql': next_sql, 'message': next_message}})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'assistant_message_id': assistant_message.id})}\n\n"
                return
    
    # If no MULTI_STEP_QUERY found, operations are complete - generate conclusion
    yield f"data: {json.dumps({'type': 'loading', 'content': 'AI is generating conclusion...'})}\n\n"
    
    conclusion_prompt = f"""Based on the conversation history, provide a brief conclusion summarizing what operations were completed.

Provide a concise, friendly summary of what was accomplished. Keep it under 2 sentences."""
    
    final_answer = ""
    chunk_count = 0
    async for chunk in ai_service.generate_response_stream(
        query=conclusion_prompt,
        model=model,
        api_key=api_key,
        conversation_history=conversation_history,
        db_session=db,
        conversation_id=conversation_id
    ):
        final_answer += chunk
        chunk_count += 1
        yield f"data: {json.dumps({'type': 'final_answer_chunk', 'content': chunk})}\n\n"
    
    yield f"data: {json.dumps({'type': 'final_answer_complete', 'content': final_answer})}\n\n"
    
    # Add summary to database for persistence
    assistant_message.content += f"\n\n**💡 Summary:**\n{final_answer}"
    crud.update_conversation_timestamp(db, conversation_id)
    db.commit()
    
    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'assistant_message_id': assistant_message.id})}\n\n"


async def confirm_agent_operation_stream(
    request_data: schemas.AgentConfirmationRequest,
    db: Session
):
    """
    Execute a confirmed agent operation (CREATE, UPDATE, DELETE) with streaming continuation.
    
    Args:
        request_data: The confirmation request data
        db: Database session
        
    Yields:
        Server-sent events with operation results and continuation
    """
    
    if not request_data.confirmed:
        # User cancelled the operation
        yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Operation cancelled by user'})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': request_data.conversation_id})}\n\n"
        return
    
    # Find the last assistant message with confirmation tag
    messages = crud.get_conversation_messages(db, request_data.conversation_id)
    last_assistant_msg = None
    for msg in reversed(messages):
        if msg.role == 'assistant' and '<confirmation' in msg.content:
            last_assistant_msg = msg
            break
    
    # Execute the SQL operation
    dataset_service = get_dataset_service()
    result = dataset_service.execute_write_query(request_data.sql_query)
    
    # Build result message to append
    if result.get('success'):
        row_count = result.get('row_count', 0)
        if request_data.operation == "CREATE":
            final_answer = f"Successfully created {row_count} record(s)."
        elif request_data.operation == "UPDATE":
            final_answer = f"Successfully updated {row_count} record(s)."
        elif request_data.operation == "DELETE":
            final_answer = f"Successfully deleted {row_count} record(s)."
        else:
            final_answer = "Operation completed successfully."
        result_content = f"\n\n**✅ Result:** {final_answer}"
    else:
        error_msg = result.get('error', 'Unknown error')
        result_content = f"\n\n**❌ Error:** Operation failed: {error_msg}"
        final_answer = error_msg
    
    # Update the SAME message: remove confirmation buttons and append result
    if last_assistant_msg:
        # Remove confirmation tag and warning from the end of the message
        updated_content = re.sub(r'\n\n<confirmation[^>]+/>', '', last_assistant_msg.content)
        updated_content = re.sub(r'\*\*⚠️ This operation will modify your data\. Please confirm:\*\*\n*', '', updated_content)
        
        # Append the result to the message (don't replace the entire content)
        last_assistant_msg.content = updated_content.strip() + result_content
        db.commit()
    
    # Send the result event
    yield f"data: {json.dumps({'type': 'sql_result', 'content': result})}\n\n"
    
    # Continue with next operations regardless of success/failure
    if last_assistant_msg:
        if result.get('success'):
            print(f"[AGENT DEBUG] Operation successful, continuing with next operations")
        else:
            print(f"[AGENT DEBUG] Operation failed, but continuing to let AI decide next steps")
            print(f"[AGENT DEBUG] Error: {result.get('error', 'Unknown error')}")
        
        # Get conversation history and table schemas for continuation
        conversation_history = []
        try:
            all_messages = crud.get_conversation_messages(db, request_data.conversation_id)
            for msg in all_messages:
                conversation_history.append({
                    "role": msg.role,
                    "content": msg.content
                })
        except Exception as e:
            print(f"⚠️ Warning: Failed to retrieve conversation history: {str(e)}")
        
        # Extract table names from conversation to get schemas
        dataset_service = get_dataset_service()
        available_tables = dataset_service.get_all_table_names()
        
        # Find the original user message with @ mentions
        mentioned_tables = []
        for msg in reversed(all_messages):
            if msg.role == 'user' and '@' in msg.content:
                mentioned_tables = extract_table_names_from_message(msg.content, available_tables)
                if mentioned_tables:
                    break
        
        # Get table schemas
        table_schemas = []
        for table_name in mentioned_tables:
            if table_name != "general":
                try:
                    schema = dataset_service.get_table_schema(table_name)
                    table_schemas.append(schema)
                except Exception as e:
                    print(f"Failed to get schema for table {table_name}: {str(e)}")
        
        # Continue with agent operations stream
        async for event in continue_agent_operations_stream(
            last_assistant_msg,
            request_data.conversation_id,
            None,  # No user_message_id for confirmation
            request_data.model,
            request_data.api_key,
            db,
            table_schemas,
            conversation_history
        ):
            yield event
    else:
        # No assistant message found - this shouldn't happen
        print(f"[AGENT DEBUG] No assistant message found, ending operation")
        crud.update_conversation_timestamp(db, request_data.conversation_id)
        db.commit()
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': request_data.conversation_id})}\n\n"
    
    print(f"[AGENT DEBUG] ===== CONFIRM_AGENT_OPERATION_STREAM COMPLETE =====")
