"""Ask mode and Agent mode API routes."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from app import crud, schemas
from app.database import get_db
from app.services.ai_service import ai_service
from app.services.dataset_service import get_dataset_service
from app.services.sql_executor import process_ai_response_with_sql
from app.services.ask_mode_service import process_ask_mode_stream
from app.services.agent_mode_service import process_agent_mode_stream, confirm_agent_operation_stream

router = APIRouter(prefix="/api", tags=["Ask Mode"])


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


def get_api_key_for_model(model: str, user_api_keys: dict) -> str:
    """Get the appropriate API key for the given model."""
    if model.startswith("gemini"):
        api_key = user_api_keys.get("google")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Google API key not configured. Please add it in Settings."
            )
    elif model.startswith("gpt"):
        api_key = user_api_keys.get("openai")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API key not configured. Please add it in Settings."
            )
    elif model.startswith("claude"):
        api_key = user_api_keys.get("anthropic")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Anthropic API key not configured. Please add it in Settings."
            )
    elif model.startswith("deepseek"):
        api_key = user_api_keys.get("deepseek")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="DeepSeek API key not configured. Please add it in Settings."
            )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {model}")
    
    return api_key


@router.post("/enhance-prompt")
async def enhance_prompt(
    request_data: dict,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Enhance a user's prompt to be more detailed and effective.
    Extracts table schemas if @ mentions are present in the prompt.
    """
    try:
        # Import session from auth routes
        from app.routes.auth import get_current_user_session
        current_user_session = get_current_user_session()
        
        # Get user ID from session or header
        from app.routes.chat import get_user_id_from_request
        user_id = get_user_id_from_request(http_request, current_user_session)
        
        # Get user's API keys
        user_api_keys = crud.get_user_api_keys(db, user_id)
        if not user_api_keys:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get prompt and model from request
        prompt = request_data.get("prompt", "")
        model = request_data.get("model", "gemini-2.5-flash")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # Get API key for model
        api_key = get_api_key_for_model(model, user_api_keys)
        
        # Extract table mentions from prompt (e.g., @Walmart_Sales)
        table_schemas = None
        if "@" in prompt:
            import re
            # Find all @mentions
            mentions = re.findall(r'@(\w+)', prompt)
            if mentions:
                dataset_service = get_dataset_service()
                table_schemas = []
                # Filter out 'general' and get schemas for actual tables
                actual_tables = [t for t in mentions if t.lower() != 'general']
                for table_name in actual_tables:
                    try:
                        schema = dataset_service.get_table_schema(table_name)
                        table_schemas.append(schema)
                    except Exception as e:
                        # Log error but continue with other tables
                        print(f"Warning: Failed to get schema for table {table_name}: {str(e)}")
        
        # Enhance the prompt using AI service with table schemas
        enhanced_prompt = await ai_service.enhance_prompt(
            prompt, 
            model, 
            api_key,
            table_schemas=table_schemas
        )
        
        return {"enhanced_prompt": enhanced_prompt.strip()}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error enhancing prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enhance prompt: {str(e)}")


@router.post("/autocomplete-prompt")
async def autocomplete_prompt(
    request_data: dict,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Autocomplete a user's partial prompt with AI suggestions.
    Extracts table schemas if @ mentions are present in the prompt.
    """
    try:
        # Import session from auth routes
        from app.routes.auth import get_current_user_session
        current_user_session = get_current_user_session()
        
        # Get user ID from session or header
        from app.routes.chat import get_user_id_from_request
        user_id = get_user_id_from_request(http_request, current_user_session)
        
        # Get user's API keys
        user_api_keys = crud.get_user_api_keys(db, user_id)
        if not user_api_keys:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get prompt and model from request
        prompt = request_data.get("prompt", "")
        model = request_data.get("model", "gemini-2.5-flash")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # Get API key for model
        api_key = get_api_key_for_model(model, user_api_keys)
        
        # Extract table mentions from prompt (e.g., @Walmart_Sales)
        table_schemas = None
        if "@" in prompt:
            import re
            # Find all @mentions
            mentions = re.findall(r'@(\w+)', prompt)
            if mentions:
                dataset_service = get_dataset_service()
                table_schemas = []
                # Filter out 'general' and get schemas for actual tables
                actual_tables = [t for t in mentions if t.lower() != 'general']
                for table_name in actual_tables:
                    try:
                        schema = dataset_service.get_table_schema(table_name)
                        table_schemas.append(schema)
                    except Exception as e:
                        # Log error but continue with other tables
                        print(f"Warning: Failed to get schema for table {table_name}: {str(e)}")
        
        # Autocomplete the prompt using AI service with table schemas
        autocompleted_prompt = await ai_service.autocomplete_prompt(
            prompt, 
            model, 
            api_key,
            table_schemas=table_schemas
        )
        
        return {"autocompleted_prompt": autocompleted_prompt.strip()}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error autocompleting prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to autocomplete prompt: {str(e)}")


@router.post("/ask", response_model=schemas.AskResponse, status_code=status.HTTP_200_OK)
async def ask_query(
    request_data: schemas.AskRequest,
    http_request: Request,
    db: Session = Depends(get_db)
) -> schemas.AskResponse:
    """
    Ask mode endpoint - sends user query to AI API and returns response.
    Creates or continues a conversation.
    """
    try:
        # Import session from auth routes
        from app.routes.auth import get_current_user_session
        current_user_session = get_current_user_session()
        
        # Get user ID from session or header
        user_id = get_user_id_from_request(http_request, current_user_session)
        
        # Get user's API keys
        user_api_keys = crud.get_user_api_keys(db, user_id)
        if not user_api_keys:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get API key for model
        api_key = get_api_key_for_model(request_data.model, user_api_keys)
        
        # Get or create conversation
        if request_data.conversation_id:
            conversation = crud.get_conversation(db, request_data.conversation_id)
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
        else:
            # Create new conversation with title from first few words of query
            title = request_data.query[:50] + "..." if len(request_data.query) > 50 else request_data.query
            conversation = crud.create_conversation(db, title=title, mode="ask", user_id=user_id)
        
        # Save user message with attachments
        attachments_list = None
        if request_data.attachments:
            attachments_list = [att.dict() for att in request_data.attachments]
        
        user_message = crud.create_message(
            db=db,
            conversation_id=conversation.id,
            role="user",
            content=request_data.query,
            attachments=attachments_list
        )
        
        # Check if @general tag is used
        is_general_mode = request_data.selected_tables and 'general' in [t.lower() for t in request_data.selected_tables]
        
        # If no tables selected (and not @general), return fixed message immediately
        if not request_data.selected_tables or len(request_data.selected_tables) == 0:
            print("⚠️ No dataset selected - returning fixed message")
            fixed_message = "I'd be happy to help you analyze your data! However, I notice you haven't selected a dataset.\n\nPlease tag the dataset you want to analyze using the @ symbol.\n\nFor example:\n- 'Show me top 5 sales @Walmart_Sales'\n- 'Find records that need attention @MyData'\n\nYou can find available datasets in the sidebar. Just type @ to see the list!\n\n💡 Tip: You can also use @general to ask me general questions about who I am or what I can do."
            
            # Save assistant message
            assistant_message = crud.create_message(
                db=db,
                conversation_id=conversation.id,
                role="assistant",
                content=fixed_message
            )
            
            return schemas.AskResponse(
                conversation_id=conversation.id,
                user_message=schemas.MessageResponse(
                    id=user_message.id,
                    conversation_id=conversation.id,
                    role=user_message.role,
                    content=user_message.content,
                    created_at=user_message.created_at
                ),
                assistant_message=schemas.MessageResponse(
                    id=assistant_message.id,
                    conversation_id=conversation.id,
                    role=assistant_message.role,
                    content=assistant_message.content,
                    created_at=assistant_message.created_at
                )
            )
        
        # Extract table schemas if tables are selected (excluding @general)
        table_schemas = None
        if not is_general_mode and request_data.selected_tables and len(request_data.selected_tables) > 0:
            dataset_service = get_dataset_service()
            table_schemas = []
            # Filter out 'general' from the list before getting schemas
            actual_tables = [t for t in request_data.selected_tables if t.lower() != 'general']
            for table_name in actual_tables:
                try:
                    schema = dataset_service.get_table_schema(table_name)
                    table_schemas.append(schema)
                except Exception as e:
                    # Log error but continue with other tables
                    print(f"Warning: Failed to get schema for table {table_name}: {str(e)}")
        
        # Get response from AI service
        try:
            ai_response = await ai_service.generate_response(
                query=request_data.query,
                model=request_data.model,
                api_key=api_key,
                table_schemas=table_schemas,
                is_general_mode=is_general_mode
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get response from AI API: {str(e)}"
            )
        
        # Process AI response - extract and execute SQL if tables are selected (not in general mode)
        final_response = ai_response
        if not is_general_mode and request_data.selected_tables and len(request_data.selected_tables) > 0:
            dataset_service = get_dataset_service()
            try:
                formatted_response, sql_query, execution_result = await process_ai_response_with_sql(
                    ai_response=ai_response,
                    dataset_service=dataset_service,
                    execute_queries=True,
                    ai_service=ai_service,
                    model=request_data.model,
                    api_key=api_key
                )
                final_response = formatted_response
            except Exception as e:
                # If SQL execution fails, use original response with error note
                print(f"Warning: SQL execution failed: {str(e)}")
                final_response = ai_response + f"\n\n*Note: Failed to execute SQL query: {str(e)}*"
        
        # Check if client is still connected before saving
        # If client disconnected (cancelled request), don't save the response
        if await http_request.is_disconnected():
            # Client disconnected, don't save the assistant message
            # Just rollback any pending changes and return error
            db.rollback()
            raise HTTPException(
                status_code=499,  # Client Closed Request
                detail="Client disconnected before response could be saved"
            )
        
        # Save assistant message only if client is still connected
        assistant_message = crud.create_message(
            db=db,
            conversation_id=conversation.id,
            role="assistant",
            content=final_response,
            model=request_data.model
        )
        
        # Update conversation timestamp to move it to top of recent chats
        crud.update_conversation_timestamp(db, conversation.id)
        
        return schemas.AskResponse(
            conversation_id=conversation.id,
            user_message=user_message,
            assistant_message=assistant_message
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask/stream")
async def ask_query_stream(
    request_data: schemas.AskRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Streaming version of ask endpoint - sends progressive updates.
    Uses the Ask Mode service for processing.
    """
    async def generate_stream():
        try:
            # Check if client is still connected
            if await http_request.is_disconnected():
                print("⚠️ Client disconnected before processing started")
                return
            
            # Import session from auth routes
            from app.routes.auth import get_current_user_session
            current_user_session = get_current_user_session()
            
            # Get user ID from session or header
            user_id = get_user_id_from_request(http_request, current_user_session)
            
            # Get user's API keys
            user_api_keys = crud.get_user_api_keys(db, user_id)
            if not user_api_keys:
                yield f"data: {json.dumps({'error': 'User not found'})}\n\n"
                return
            
            # Determine which API key to use based on model
            model = request_data.model
            try:
                api_key = get_api_key_for_model(model, user_api_keys)
            except HTTPException as e:
                yield f"data: {json.dumps({'error': e.detail})}\n\n"
                return
            
            # Get or create conversation
            if request_data.conversation_id:
                conversation = crud.get_conversation(db, request_data.conversation_id)
                if not conversation:
                    yield f"data: {json.dumps({'error': 'Conversation not found'})}\n\n"
                    return
            else:
                title = request_data.query[:50] + "..." if len(request_data.query) > 50 else request_data.query
                conversation = crud.create_conversation(db, title=title, mode="ask", user_id=user_id)
            
            # Save user message with attachments
            attachments_list = None
            if request_data.attachments:
                attachments_list = [att.dict() for att in request_data.attachments]
            
            user_message = crud.create_message(
                db=db,
                conversation_id=conversation.id,
                role="user",
                content=request_data.query,
                attachments=attachments_list
            )
            
            # If no tables selected (and not @general), return fixed message immediately
            if not request_data.selected_tables or len(request_data.selected_tables) == 0:
                print("⚠️ No dataset selected - returning fixed message")
                fixed_message = "I'd be happy to help you analyze your data! However, I notice you haven't selected a dataset.\n\nPlease tag the dataset you want to analyze using the @ symbol.\n\nFor example:\n- 'Show me top 5 sales @user\_1\_Walmart_Sales'\n- 'Find records that need attention @user\_1\_MyData'\n\nYou can find available datasets in the sidebar. Just type @ to see the list!\n\n💡 Tip: You can also use @general to ask me general questions about who I am or what I can do."
                
                # Save assistant message first
                assistant_message = crud.create_message(
                    db=db,
                    conversation_id=conversation.id,
                    role="assistant",
                    content=fixed_message
                )
                
                crud.update_conversation_timestamp(db, conversation.id)
                
                # Commit the changes to database
                db.commit()
                
                # Then yield the events
                yield f"data: {json.dumps({'type': 'final_answer', 'content': fixed_message})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation.id, 'user_message_id': user_message.id, 'assistant_message_id': assistant_message.id})}\n\n"
                return
            
            # Use Ask Mode service to process the stream
            async for event in process_ask_mode_stream(
                request_data=request_data,
                conversation_id=conversation.id,
                user_message_id=user_message.id,
                model=model,
                api_key=api_key,
                db=db
            ):
                # Check if client disconnected
                if await http_request.is_disconnected():
                    print("⚠️ Client disconnected during streaming, stopping...")
                    break
                yield event
            
        except Exception as e:
            print(f"❌ Error in ask stream: {str(e)}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(generate_stream(), media_type="text/event-stream")


@router.post("/agent")
async def agent_mode(
    request_data: schemas.AskRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Agent mode for CRUD operations on datasets.
    Uses the Agent Mode service for processing.
    """
    try:
        from app.routes.auth import get_current_user_session
        current_user_session = get_current_user_session()
        from app.routes.chat import get_user_id_from_request
        user_id = get_user_id_from_request(http_request, current_user_session)
        
        user_api_keys = crud.get_user_api_keys(db, user_id)
        if not user_api_keys:
            raise HTTPException(status_code=404, detail="User not found")
        
        model = request_data.model or "gemini-2.5-flash"
        api_key = get_api_key_for_model(model, user_api_keys)
        
        async def generate_stream():
            try:
                # Check if client is still connected
                if await http_request.is_disconnected():
                    print("⚠️ Client disconnected before processing started")
                    return
                
                # Get or create conversation
                conversation = None
                if request_data.conversation_id:
                    conversation = crud.get_conversation(db, request_data.conversation_id, user_id)
                    if not conversation:
                        raise HTTPException(status_code=404, detail="Conversation not found")
                else:
                    conversation = crud.create_conversation(db, title=request_data.query[:50], mode="agent", user_id=user_id)
                
                # Check if this is an Execute/Cancel confirmation
                is_confirmation_action = request_data.query.strip().lower() in ['execute', 'cancel']
                
                # Save user message with attachments (will be deleted by service if it's Execute/Cancel)
                attachments_list = None
                if request_data.attachments:
                    attachments_list = [att.dict() for att in request_data.attachments]
                
                user_message = crud.create_message(
                    db,
                    conversation_id=conversation.id,
                    role="user",
                    content=request_data.query,
                    attachments=attachments_list
                )
                user_message_id = user_message.id
                
                # For Execute/Cancel, flush but don't commit yet (service will delete and commit)
                if is_confirmation_action:
                    db.flush()
                else:
                    db.commit()
                
                # Use Agent Mode service to process the stream
                async for event in process_agent_mode_stream(
                    request_data=request_data,
                    conversation_id=conversation.id,
                    user_message_id=user_message_id,
                    model=model,
                    api_key=api_key,
                    db=db
                ):
                    # Check if client disconnected
                    if await http_request.is_disconnected():
                        print("⚠️ Client disconnected during streaming, stopping...")
                        break
                    yield event
                
            except Exception as e:
                print(f"❌ Agent error: {str(e)}")
                import traceback
                traceback.print_exc()
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(generate_stream(), media_type="text/event-stream")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/confirm")
async def confirm_agent_operation_route(
    request_data: schemas.AgentConfirmationRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Execute a confirmed agent operation (CREATE, UPDATE, DELETE).
    Uses the Agent Mode service for processing with streaming continuation.
    """
    try:
        from app.routes.auth import get_current_user_session
        current_user_session = get_current_user_session()
        from app.routes.chat import get_user_id_from_request
        user_id = get_user_id_from_request(http_request, current_user_session)
        
        # Verify conversation belongs to user
        conversation = crud.get_conversation(db, request_data.conversation_id, user_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get API key from user settings if not provided
        if not request_data.api_key:
            user_api_keys = crud.get_user_api_keys(db, user_id)
            if not user_api_keys:
                raise HTTPException(status_code=404, detail="User not found")
            
            model = request_data.model or "gemini-2.5-flash"
            request_data.api_key = get_api_key_for_model(model, user_api_keys)
        
        # Use Agent Mode service to confirm and execute operation with streaming
        async def event_generator():
            async for event in confirm_agent_operation_stream(request_data, db):
                yield event
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except Exception as e:
        print(f"❌ Confirmation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))