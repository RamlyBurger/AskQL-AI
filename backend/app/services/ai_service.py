"""AI service for handling multiple AI providers."""
import google.generativeai as genai
from typing import Optional


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


class AIService:
    """Service for interacting with multiple AI providers."""
    
    def __init__(self):
        """Initialize AI service."""
        pass
    
    async def enhance_prompt(
        self,
        prompt: str,
        model: str,
        api_key: str,
        table_schemas: Optional[list] = None
    ) -> str:
        """
        Enhance a user's prompt to be more detailed and effective.
        
        Args:
            prompt: Original user prompt
            model: Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
            api_key: API key for the provider
            table_schemas: Optional list of table schemas if @ mentions are present
            
        Returns:
            Enhanced prompt string
        """
        # Build context with table schemas if provided
        context = ""
        if table_schemas:
            context = "\n\nAvailable dataset schemas:\n"
            for schema in table_schemas:
                context += f"\nTable: {schema['table_name']}\n"
                columns_str = ', '.join([f"{col['name']} ({col['type']})" for col in schema['columns']])
                context += f"Columns: {columns_str}\n"
        
        enhancement_instruction = f"""You are a prompt refinement assistant. Your task is to take a user's input and refine it to be formal, grammatically correct, and clear while preserving the original intent.

Original prompt: {prompt}{context}

Please refine this prompt by:
1. Correcting any spelling or grammatical errors
2. Making the language more formal and professional
3. Ensuring clarity and proper sentence structure
4. Keeping the EXACT same meaning and intent as possible
5. NOT adding extra details, complexity, or changing the scope
7. CRITICAL: Preserve ALL dataset identifiers that start with @ (e.g., @Walmart_Sales, @dataset_name). These are dataset references and must remain EXACTLY as they appear in the original prompt.
8. Do NOT wrap the output in quotes or any other formatting - return just the plain refined text.

Return ONLY the refined prompt, without any explanation, preamble, or quotation marks."""

        # Use the same provider routing as generate_response
        if model.startswith("gemini"):
            return await self._generate_gemini_response(enhancement_instruction, model, api_key, None)
        elif model.startswith("gpt"):
            return await self._generate_openai_response(enhancement_instruction, model, api_key, None)
        elif model.startswith("claude"):
            return await self._generate_anthropic_response(enhancement_instruction, model, api_key, None)
        elif model.startswith("deepseek"):
            return await self._generate_deepseek_response(enhancement_instruction, model, api_key, None)
        else:
            raise ValueError(f"Unsupported model: {model}")
    
    async def autocomplete_prompt(
        self,
        prompt: str,
        model: str,
        api_key: str,
        table_schemas: Optional[list] = None
    ) -> str:
        """
        Autocomplete a user's partial prompt with AI suggestions.
        
        Args:
            prompt: Partial user prompt to complete
            model: Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
            api_key: API key for the provider
            table_schemas: Optional list of table schemas if @ mentions are present
            
        Returns:
            Completed prompt string
        """
        # Build context with table schemas if provided
        context = ""
        if table_schemas:
            context = "\n\nAvailable dataset schemas:\n"
            for schema in table_schemas:
                context += f"\nTable: {schema['table_name']}\n"
                columns_str = ', '.join([f"{col['name']} ({col['type']})" for col in schema['columns']])
                context += f"Columns: {columns_str}\n"
        
        autocomplete_instruction = f"""You are an autocomplete assistant for a chat interface. Complete the user's text in NATURAL LANGUAGE only.

Partial text: {prompt}{context}

IMPORTANT: 
- ONLY continue the user's sentence/question - do NOT answer it
- Complete the text in natural, conversational language (e.g., "show me the top 5 sales from @dataset")
- DO NOT generate SQL queries, code, or technical syntax
- Keep it simple and human-readable
- Return the FULL completed text (including the original partial text)
- Do NOT add quotes or explanations

Complete naturally:"""

        # Use the same provider routing as generate_response
        if model.startswith("gemini"):
            return await self._generate_gemini_response(autocomplete_instruction, model, api_key, None)
        elif model.startswith("gpt"):
            return await self._generate_openai_response(autocomplete_instruction, model, api_key, None)
        elif model.startswith("claude"):
            return await self._generate_anthropic_response(autocomplete_instruction, model, api_key, None)
        elif model.startswith("deepseek"):
            return await self._generate_deepseek_response(autocomplete_instruction, model, api_key, None)
        else:
            raise ValueError(f"Unsupported model: {model}")
    
    async def generate_response(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        table_schemas: Optional[list] = None,
        is_general_mode: bool = False,
        is_agent_mode: bool = False,
        attachments: Optional[list] = None,
        db_session = None,
        conversation_id: Optional[int] = None
    ) -> str:
        """
        Generate a response using the specified AI model.
        
        Args:
            query: User's query string
            model: Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
            api_key: API key for the provider
            conversation_history: Optional list of previous messages for context
            table_schemas: Optional list of table schema information
            is_general_mode: If True, allows general conversation (used with @general tag)
            is_agent_mode: If True, enables agent mode for CRUD operations
            attachments: Optional list of file attachments (images, etc.)
            db_session: Database session for extracting SQL/chart history
            conversation_id: ID of current conversation for history extraction
            
        Returns:
            Generated response string
        """
        # Process image attachments - load and encode them
        image_data_list = []
        if attachments:
            import base64
            from pathlib import Path
            
            for att in attachments:
                # Handle both Pydantic models and dictionaries
                if hasattr(att, 'file_type'):
                    # Pydantic model
                    file_type = att.file_type
                    file_url = att.url
                    filename = att.filename
                else:
                    # Dictionary
                    file_type = att.get('file_type', '')
                    file_url = att.get('url', '')
                    filename = att.get('filename', '')
                
                if file_type.startswith('image/'):
                    try:
                        # Convert URL to file path (remove leading slash and convert to absolute path)
                        # Remove leading slash and construct full path
                        file_path = Path(file_url.lstrip('/'))
                        
                        if file_path.exists():
                            with open(file_path, 'rb') as f:
                                image_bytes = f.read()
                                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                                image_data_list.append({
                                    'filename': filename,
                                    'mime_type': file_type,
                                    'data': image_base64
                                })
                    except Exception as e:
                        print(f"⚠️ Failed to load image {filename}: {str(e)}")
        
        # Build attachment context for text-only models
        attachment_context = ""
        if image_data_list:
            attachment_context = f"\n\nThe user has attached {len(image_data_list)} image(s). Please analyze them and answer the user's question."
        
        # Build enhanced query with table schema context
        if is_general_mode:
            # General mode: Allow general conversation
            schema_context = "You are AskQL, a friendly data analysis assistant. The user has tagged @general, which means they want to have a general conversation with you. You can answer questions about who you are, what you can do, and provide general information. Be helpful and friendly!\n\nIMPORTANT: You have access to the conversation history. When the user asks about previous questions or refers to earlier parts of the conversation, use the conversation history to provide context-aware responses. Remember what was discussed and reference it when relevant."
            enhanced_query = f"{schema_context}{attachment_context}\n\nUser Question: {query}"
        else:
            # Data analysis mode: Enforce dataset requirement
            schema_context = self._build_schema_context(table_schemas, is_agent_mode, db_session, conversation_id)
            enhanced_query = f"{schema_context}{attachment_context}\n\nUser Question: {query}"
        
        # Log the prompt
        self._log_ai_interaction(enhanced_query)
        
        # Determine provider from model name
        response = None
        if model.startswith("gemini"):
            response = await self._generate_gemini_response(enhanced_query, model, api_key, conversation_history, image_data_list)
        elif model.startswith("gpt"):
            response = await self._generate_openai_response(enhanced_query, model, api_key, conversation_history, image_data_list)
        elif model.startswith("claude"):
            response = await self._generate_anthropic_response(enhanced_query, model, api_key, conversation_history, image_data_list)
        elif model.startswith("deepseek"):
            response = await self._generate_deepseek_response(enhanced_query, model, api_key, conversation_history, image_data_list)
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        # Log the response
        self._log_ai_interaction(enhanced_query, response)
        
        return response
    
    async def generate_response_stream(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        table_schemas: Optional[list] = None,
        attachments: Optional[list] = None,
        db_session = None,
        conversation_id: Optional[int] = None
    ):
        """
        Generate a streaming response using the specified AI model.
        Yields chunks of text as they arrive from the AI.
        
        Args:
            query: User's query string
            model: Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
            api_key: API key for the provider
            conversation_history: Optional list of previous messages for context
            table_schemas: Optional list of table schema information
            attachments: Optional list of file attachments (images, etc.)
            db_session: Database session for extracting SQL/chart history
            conversation_id: ID of current conversation for history extraction
            
        Yields:
            Text chunks as they arrive
        """
        # Process image attachments - load and encode them
        image_data_list = []
        if attachments:
            import base64
            from pathlib import Path
            
            for att in attachments:
                # Handle both Pydantic models and dictionaries
                if hasattr(att, 'file_type'):
                    # Pydantic model
                    file_type = att.file_type
                    file_url = att.url
                    filename = att.filename
                else:
                    # Dictionary
                    file_type = att.get('file_type', '')
                    file_url = att.get('url', '')
                    filename = att.get('filename', '')
                
                if file_type.startswith('image/'):
                    try:
                        # Convert URL to file path (remove leading slash and convert to absolute path)
                        # Remove leading slash and construct full path
                        file_path = Path(file_url.lstrip('/'))
                        
                        if file_path.exists():
                            with open(file_path, 'rb') as f:
                                image_bytes = f.read()
                                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                                image_data_list.append({
                                    'filename': filename,
                                    'mime_type': file_type,
                                    'data': image_base64
                                })
                    except Exception as e:
                        print(f"⚠️ Failed to load image {filename}: {str(e)}")
        
        # Build enhanced query with table schema context
        # ALWAYS build schema context (even when empty) to enforce dataset requirement
        schema_context = self._build_schema_context(table_schemas, False, db_session, conversation_id)
        
        # Build attachment context for text-only models
        attachment_context = ""
        if image_data_list:
            attachment_context = f"\n\nThe user has attached {len(image_data_list)} image(s). Please analyze them and answer the user's question."
        
        enhanced_query = f"{schema_context}{attachment_context}\n\nUser Question: {query}"
        
        # Log the prompt
        self._log_ai_interaction(enhanced_query)
        
        # Collect full response for logging
        full_response = ""
        
        # Determine provider from model name and stream
        if model.startswith("gemini"):
            async for chunk in self._generate_gemini_response_stream(enhanced_query, model, api_key, conversation_history):
                full_response += chunk
                yield chunk
        elif model.startswith("gpt"):
            async for chunk in self._generate_openai_response_stream(enhanced_query, model, api_key, conversation_history):
                full_response += chunk
                yield chunk
        elif model.startswith("claude"):
            async for chunk in self._generate_anthropic_response_stream(enhanced_query, model, api_key, conversation_history):
                full_response += chunk
                yield chunk
        elif model.startswith("deepseek"):
            async for chunk in self._generate_deepseek_response_stream(enhanced_query, model, api_key, conversation_history, image_data_list):
                full_response += chunk
                yield chunk
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        # Log the complete response
        self._log_ai_interaction(enhanced_query, full_response)
    
    def _build_schema_context(self, table_schemas: list, is_agent_mode: bool = False, db_session = None, conversation_id: Optional[int] = None) -> str:
        """Build a context string from table schemas for the AI."""
        # Note: No-dataset case is now handled by hardcoded message in ask.py
        # This method should only be called when tables are actually selected
        
        # Safety check: if no schemas provided, return basic prompt
        if not table_schemas:
            return "You are a friendly and helpful chatbot. Answer questions clearly, provide useful explanations, and keep the conversation safe and respectful. Avoid sharing or asking for sensitive or private information."
        
        # Extract SQL and chart history if database session is available
        sql_history_context = ""
        chart_history_context = ""
        if db_session and conversation_id:
            try:
                from app.crud.history import get_history_context_for_ai
                
                history_context = get_history_context_for_ai(
                    db_session, 
                    conversation_id,
                    max_sql_entries=20,
                    max_chart_entries=20
                )
                
                sql_history_context = history_context["sql_context"]
                chart_history_context = history_context["chart_context"]
                    
            except Exception as e:
                print(f"⚠️ Warning: Failed to extract history context: {str(e)}")
                import traceback
                traceback.print_exc()
                # Continue without history context
        
        if is_agent_mode:
            # Agent Mode initial prompt - consistent with multi-step analysis format
            context_parts = [
                "Agent Mode Initial Analysis",
                "",
                "⚠️ CRITICAL RESTRICTIONS (MUST follow - violations will FAIL):",
                "- ABSOLUTELY NO: ALTER, DROP, CREATE, TRUNCATE commands",
                "- ABSOLUTELY NO: CTEs (WITH clauses)",
                "- ABSOLUTELY NO: Window functions (OVER/PARTITION BY/LAG/LEAD)",
                "- ONLY ALLOWED: SELECT, INSERT, UPDATE, DELETE",
                "- For data insertion: use **ONE** INSERT statement with multiple VALUES rows",
                "- NEVER add columns or modify table structure - work with existing columns only",
                "",
                "INSTRUCTIONS:",
                "",
                "1. Understand the request type:",
                "   - **Data insertion** → create records using one multi-VALUES INSERT",
                "   - **Prediction/forecasting** → analyze data patterns and insert predicted rows",
                "   - **Specific number of queries or rows** → respect exactly",
                "   - **Single query request** → provide one targeted query",
                "   - **Exploration** → start with initial analysis query",
                "",
                "2. Response Logic:",
                "   - For simple requests: provide direct SQL solution",
                "   - For complex requests: use 'MULTI_STEP_QUERY: Step 1' and break into steps",
                "   - For data insertion: create multiple records in a single INSERT when appropriate",
                "",
                "RESPONSE FORMAT:",
                "- If continuing with multi-step:",
                "    - Brief explanation (1 sentence)",
                "    - `MULTI_STEP_QUERY: Step 1`",
                "    - ```sql",
                "      <SQL here>",
                "      ```",
                "- If single query:",
                "    - Brief explanation of what you'll do",
                "    - ```sql",
                "      <SQL here>",
                "      ```",
                ""
            ]
        else:
            # Ask Mode prompt
            context_parts = [
                "You are a SQL assistant for SQLite. Generate simple SQL queries based on user questions.",
                "",
                "⚠️ RESTRICTIONS (queries violating these will FAIL):",
                "- NO CTEs (WITH clauses), window functions (LAG/LEAD/OVER/PARTITION BY), NO TRUNCATE, ALTER, DROP, CREATE, or complex subqueries",
                "- ONLY: SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, LIMIT, basic functions",
                "- For complex queries: use 'MULTI_STEP_QUERY: Step 1' and break into simple steps",
                "- SQLite lacks: STDDEV(), MEDIAN(), STRFTIME() on TEXT dates",
                ""
            ]
        
        for schema in table_schemas:
            table_name = schema['table_name']
            columns = schema['columns']
            sample_data = schema.get('sample_data', [])
            
            context_parts.append(f"Table: {table_name}")
            context_parts.append("Columns:")
            for col in columns:
                col_info = f"  - {col['name']} ({col['type']})"
                if col.get('primary_key'):
                    col_info += " [PRIMARY KEY]"
                context_parts.append(col_info)
            
            if sample_data:
                context_parts.append("\nSample Data (check date/number formats):")
                import json
                # Apply text truncation and numerical formatting to sample data
                formatted_sample_data = _truncate_text_fields(sample_data[:2], max_length=20)
                context_parts.append(json.dumps(formatted_sample_data, indent=2))  # Only 2 rows instead of 3
            
            context_parts.append("")
        
        context_parts.extend([
            "Rules:",
            "1. MULTIPLE QUERIES: If user asks to 'run X queries' or 'show me 5 queries':",
            "   - NEVER provide all queries at once in a single response",
            "   - Use 'MULTI_STEP_QUERY: Step 1' for the FIRST query only",
            "   - After that query executes, you'll be asked if another query is needed",
            "   - Respond with 'MULTI_STEP_QUERY: Step 2' and provide the NEXT query",
            "   - Continue one query at a time until all requested queries are complete",
            "   - When done, respond with 'QUERY_COMPLETE'",
            "",
            "2. EXPLORATORY QUESTIONS: If the question is broad/vague like 'What patterns do you see?', 'Analyze this data', 'Show me something interesting', 'What trends exist?', 'Tell me about this data':",
            "   - Start with 'MULTI_STEP_QUERY: Step 1' to get a manageable sample (e.g., SELECT * FROM table LIMIT 100)",
            "   - After seeing results, identify 1-2 specific patterns worth exploring",
            "   - Do NOT generate multiple complex queries upfront - let the data guide you",
            "   - Keep analysis focused and concise (2-3 queries max)",
            "",
            "3. SPECIFIC QUESTIONS: If question asks for specific data (top 10, average, where X > Y), generate targeted SQL immediately",
            "",
            "4. If question is NOT about data (greetings, personal questions), respond: 'UNRELATED_QUERY [message]'",
            "",
            "5. Check sample data for date formats. TEXT dates like '05-02-2010': use SUBSTR(Date,-4) for year, NOT STRFTIME()",
            "",
            "6. Complex queries (neighbors, anomalies, comparisons): Start with 'MULTI_STEP_QUERY: Step 1' and get base data first",
            "",
            "7. Use EXACT table names. Generate SQL in ```sql``` blocks. Keep it simple.",
            "",
            "CRITICAL: Only provide ONE SQL query per response. Never include multiple ```sql``` blocks in a single response.",
            ""
        ])
        
        # Add history context to the end of the prompt
        context_string = "\n".join(context_parts)
        context_string += sql_history_context + chart_history_context
        
        return context_string
    
    def _log_ai_interaction(self, prompt: str, response: str = None):
        """Simple logging of AI prompts and responses."""
        try:
            import os
            from datetime import datetime
            
            # Create debug directory if it doesn't exist
            debug_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'debug')
            os.makedirs(debug_dir, exist_ok=True)
            
            # Single log file for all interactions
            log_file = os.path.join(debug_dir, 'ai_prompts_responses.txt')
            
            # Write to file
            with open(log_file, 'a', encoding='utf-8') as f:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                f.write(f"# AI PROMPT [{timestamp}]\n")
                f.write(prompt)
                f.write(f"\n# END PROMPT [{timestamp}]\n\n")
                
                if response:
                    f.write(f"# AI RESPONSE [{timestamp}]\n")
                    f.write(response)
                    f.write(f"\n# END RESPONSE [{timestamp}]\n\n")
                    
        except Exception as e:
            print(f"⚠️ Warning: Failed to log AI interaction: {str(e)}")
    
    async def _generate_gemini_response(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        image_data_list: Optional[list] = None
    ) -> str:
        """Generate response using Google Gemini with vision support."""
        try:
            import PIL.Image
            import io
            import base64
            
            # Configure with user's API key
            genai.configure(api_key=api_key)
            gemini_model = genai.GenerativeModel(model)
            
            # Prepare content parts (text + images)
            content_parts = []
            
            # Add images first if provided
            if image_data_list:
                for img_data in image_data_list:
                    try:
                        # Decode base64 image
                        image_bytes = base64.b64decode(img_data['data'])
                        image = PIL.Image.open(io.BytesIO(image_bytes))
                        content_parts.append(image)
                    except Exception as e:
                        print(f"⚠️ Failed to process image for Gemini: {str(e)}")
            
            # Add text query
            content_parts.append(query)
            
            if conversation_history:
                # Build conversation context
                context_messages = []
                for msg in conversation_history[-10:]:  # Last 10 messages for context
                    role = "user" if msg["role"] == "user" else "model"
                    context_messages.append({
                        "role": role,
                        "parts": [msg["content"]]
                    })
                
                # Start chat with history
                chat = gemini_model.start_chat(history=context_messages)
                response = chat.send_message(content_parts)
            else:
                # Simple query without history
                response = gemini_model.generate_content(content_parts)
            
            return response.text
        
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    async def _generate_openai_response(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        image_data_list: Optional[list] = None
    ) -> str:
        """Generate response using OpenAI with vision support."""
        try:
            import openai
            
            client = openai.OpenAI(api_key=api_key)
            
            # Build messages
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Build content with images if provided
            if image_data_list:
                content = [{"type": "text", "text": query}]
                for img_data in image_data_list:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img_data['mime_type']};base64,{img_data['data']}"
                        }
                    })
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "user", "content": query})
            
            # Generate response
            response = client.chat.completions.create(
                model=model,
                messages=messages
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    async def _generate_anthropic_response(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        image_data_list: Optional[list] = None
    ) -> str:
        """Generate response using Anthropic Claude with vision support."""
        try:
            import anthropic
            
            client = anthropic.Anthropic(api_key=api_key)
            
            # Build messages
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Build content with images if provided
            if image_data_list:
                content = []
                for img_data in image_data_list:
                    content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img_data['mime_type'],
                            "data": img_data['data']
                        }
                    })
                content.append({"type": "text", "text": query})
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "user", "content": query})
            
            # Generate response
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=messages
            )
            
            return response.content[0].text
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")
    
    async def _generate_deepseek_response(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        image_data_list: Optional[list] = None
    ) -> str:
        """Generate response using DeepSeek (text-only, no vision support)."""
        try:
            from openai import OpenAI
            
            # DeepSeek uses OpenAI-compatible API but doesn't support vision
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com"
            )
            
            # Build messages
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Note: DeepSeek doesn't support image inputs
            # If images are provided, inform the user
            if image_data_list:
                image_notice = f"\n\n[Note: {len(image_data_list)} image(s) were attached, but DeepSeek models don't support image analysis. Please use a vision-capable model like GPT-4o, Gemini, or Claude for image analysis.]"
                query_with_notice = query + image_notice
                messages.append({"role": "user", "content": query_with_notice})
            else:
                messages.append({"role": "user", "content": query})
            
            # Generate response
            response = client.chat.completions.create(
                model=model,
                messages=messages
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise Exception(f"DeepSeek API error: {str(e)}")
    
    # Streaming methods
    async def _generate_gemini_response_stream(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None
    ):
        """Generate streaming response using Google Gemini."""
        try:
            genai.configure(api_key=api_key)
            gemini_model = genai.GenerativeModel(model)
            
            if conversation_history:
                context_messages = []
                for msg in conversation_history[-10:]:
                    role = "user" if msg["role"] == "user" else "model"
                    context_messages.append({
                        "role": role,
                        "parts": [msg["content"]]
                    })
                chat = gemini_model.start_chat(history=context_messages)
                response = chat.send_message(query, stream=True)
            else:
                response = gemini_model.generate_content(query, stream=True)
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    async def _generate_openai_response_stream(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None
    ):
        """Generate streaming response using OpenAI."""
        try:
            import openai
            
            client = openai.OpenAI(api_key=api_key)
            
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            messages.append({"role": "user", "content": query})
            
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    async def _generate_anthropic_response_stream(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None
    ):
        """Generate streaming response using Anthropic Claude."""
        try:
            import anthropic
            
            client = anthropic.Anthropic(api_key=api_key)
            
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            messages.append({"role": "user", "content": query})
            
            with client.messages.stream(
                model=model,
                max_tokens=4096,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    yield text
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")
    
    async def _generate_deepseek_response_stream(
        self,
        query: str,
        model: str,
        api_key: str,
        conversation_history: Optional[list] = None,
        image_data_list: Optional[list] = None
    ):
        """Generate streaming response using DeepSeek (text-only, no vision support)."""
        try:
            from openai import OpenAI
            
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com"
            )
            
            messages = []
            if conversation_history:
                for msg in conversation_history[-10:]:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Note: DeepSeek doesn't support image inputs
            # If images are provided, inform the user
            if image_data_list:
                image_notice = f"\n\n[Note: {len(image_data_list)} image(s) were attached, but DeepSeek models don't support image analysis. Please use a vision-capable model like GPT-4o, Gemini, or Claude for image analysis.]"
                query_with_notice = query + image_notice
                messages.append({"role": "user", "content": query_with_notice})
            else:
                messages.append({"role": "user", "content": query})
            
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        
        except Exception as e:
            raise Exception(f"DeepSeek API error: {str(e)}")


# Singleton instance
ai_service = AIService()
