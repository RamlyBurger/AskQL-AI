"""Dataset service for parsing and storing uploaded files."""
import pandas as pd
import json
import sqlite3
import os
from typing import Dict, List, Tuple
from pathlib import Path


class DatasetService:
    """Service for handling dataset uploads and parsing."""
    
    def __init__(self, db_path: str):
        """Initialize dataset service with database path."""
        self.db_path = db_path
    
    def parse_csv(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """Parse CSV file and return DataFrame and metadata."""
        try:
            df = pd.read_csv(file_path)
            metadata = self._get_dataframe_metadata(df)
            return df, metadata
        except Exception as e:
            raise ValueError(f"Failed to parse CSV file: {str(e)}")
    
    def parse_excel(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """Parse Excel file and return DataFrame and metadata."""
        try:
            # Read first sheet by default
            df = pd.read_excel(file_path, sheet_name=0)
            metadata = self._get_dataframe_metadata(df)
            return df, metadata
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    
    def parse_json(self, file_path: str) -> Tuple[pd.DataFrame, Dict]:
        """Parse JSON file and return DataFrame and metadata."""
        try:
            # Try to read as JSON array or JSON lines
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Convert to DataFrame
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                # If it's a dict, try to convert to DataFrame
                df = pd.DataFrame([data])
            else:
                raise ValueError("JSON must be an array of objects or a single object")
            
            metadata = self._get_dataframe_metadata(df)
            return df, metadata
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to parse JSON file: {str(e)}")
    
    def parse_database(self, file_path: str) -> Tuple[List[Tuple[str, pd.DataFrame]], Dict]:
        """Parse SQLite database file and return all tables with metadata."""
        try:
            conn = sqlite3.connect(file_path)
            cursor = conn.cursor()
            
            # Get all table names
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            
            if not tables:
                conn.close()
                raise ValueError("No tables found in database")
            
            # Read all tables
            table_data = []
            for table_name in tables:
                table_name = table_name[0]
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
                table_data.append((table_name, df))
            
            conn.close()
            
            # Use first table for metadata
            metadata = self._get_dataframe_metadata(table_data[0][1])
            metadata['table_count'] = len(table_data)
            
            return table_data, metadata
        except Exception as e:
            raise ValueError(f"Failed to parse database file: {str(e)}")
    
    def _get_dataframe_metadata(self, df: pd.DataFrame) -> Dict:
        """Extract metadata from DataFrame."""
        columns_info = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            columns_info.append({
                'name': col,
                'type': dtype
            })
        
        return {
            'row_count': len(df),
            'column_count': len(df.columns),
            'columns': columns_info
        }
    
    def save_to_database(self, df: pd.DataFrame, table_name: str, user_id: int) -> bool:
        """Save DataFrame to SQLite database."""
        try:
            # Create a user-specific table name to avoid conflicts
            safe_table_name = f"user_{user_id}_{table_name}"
            
            # Connect to database
            conn = sqlite3.connect(self.db_path)
            
            # Save DataFrame to SQLite
            df.to_sql(safe_table_name, conn, if_exists='replace', index=False)
            
            conn.close()
            return True
        except Exception as e:
            raise ValueError(f"Failed to save data to database: {str(e)}")
    
    def get_table_data(self, table_name: str, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Retrieve data from a table."""
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Get data with pagination
            query = f"SELECT * FROM {table_name} LIMIT {limit} OFFSET {offset}"
            df = pd.read_sql_query(query, conn)
            
            # Get total count
            count_query = f"SELECT COUNT(*) as count FROM {table_name}"
            cursor = conn.cursor()
            cursor.execute(count_query)
            total_count = cursor.fetchone()[0]
            
            conn.close()
            
            # Convert to list of dicts
            data = df.to_dict('records')
            
            return data, total_count
        except Exception as e:
            raise ValueError(f"Failed to retrieve table data: {str(e)}")
    
    def delete_table(self, table_name: str) -> bool:
        """Delete a table from the database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            raise ValueError(f"Failed to delete table: {str(e)}")
    
    def get_table_schema(self, table_name: str) -> Dict:
        """Get the schema information for a table."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get column information using PRAGMA
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns_info = cursor.fetchall()
            
            if not columns_info:
                conn.close()
                raise ValueError(f"Table {table_name} not found")
            
            # Format column information
            columns = []
            for col in columns_info:
                # col format: (cid, name, type, notnull, dflt_value, pk)
                columns.append({
                    'name': col[1],
                    'type': col[2],
                    'nullable': not bool(col[3]),
                    'primary_key': bool(col[5])
                })
            
            # Get sample data (first 3 rows)
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
            sample_rows = cursor.fetchall()
            
            # Get column names for sample data
            column_names = [col[1] for col in columns_info]
            sample_data = []
            for row in sample_rows:
                sample_data.append(dict(zip(column_names, row)))
            
            conn.close()
            
            return {
                'table_name': table_name,
                'columns': columns,
                'sample_data': sample_data
            }
        except Exception as e:
            raise ValueError(f"Failed to get table schema: {str(e)}")
    
    def execute_sql_query(self, query: str, limit: int = 100) -> Dict:
        """
        Execute a SQL query and return results.
        Only allows SELECT queries for safety.
        """
        try:
            # Security check: only allow SELECT queries
            query_upper = query.strip().upper()
            if not query_upper.startswith('SELECT'):
                raise ValueError("Only SELECT queries are allowed for security reasons")
            
            # Check for dangerous keywords
            dangerous_keywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE']
            for keyword in dangerous_keywords:
                if keyword in query_upper:
                    raise ValueError(f"Query contains forbidden keyword: {keyword}")
            
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # This allows us to access columns by name
            cursor = conn.cursor()
            
            # Execute the query with a limit to prevent excessive data
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Convert to list of dictionaries with index numbers and text truncation
            result_data = []
            for idx, row in enumerate(rows, 1):
                row_dict = {"#": idx}  # Add index number as first column
                for key, value in dict(row).items():
                    # Truncate long text values (over 100 characters)
                    if isinstance(value, str) and len(value) > 100:
                        row_dict[key] = value[:97] + "..."
                    else:
                        row_dict[key] = value
                result_data.append(row_dict)
            
            # Get row count
            row_count = len(result_data)
            
            conn.close()
            
            return {
                'success': True,
                'columns': list(result_data[0].keys()) if result_data else [],
                'data': result_data,
                'row_count': row_count
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'columns': [],
                'data': [],
                'row_count': 0
            }
    
    def execute_write_query(self, query: str) -> Dict:
        """
        Execute a write query (INSERT, UPDATE, DELETE).
        Used by Agent mode for CRUD operations.
        """
        try:
            query_upper = query.strip().upper()
            
            # Only allow INSERT, UPDATE, DELETE
            allowed_operations = ['INSERT', 'UPDATE', 'DELETE']
            is_allowed = any(query_upper.startswith(op) for op in allowed_operations)
            
            if not is_allowed:
                raise ValueError("Only INSERT, UPDATE, and DELETE queries are allowed")
            
            # Check for dangerous keywords
            dangerous_keywords = ['DROP', 'ALTER', 'CREATE', 'TRUNCATE']
            for keyword in dangerous_keywords:
                if keyword in query_upper:
                    raise ValueError(f"Query contains forbidden keyword: {keyword}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Handle multiple statements separated by semicolons
            if ';' in query and query.count(';') > 1:
                # Split by semicolon and execute each statement
                statements = [stmt.strip() for stmt in query.split(';') if stmt.strip()]
                total_rows_affected = 0
                
                for statement in statements:
                    cursor.execute(statement)
                    total_rows_affected += cursor.rowcount
                
                rows_affected = total_rows_affected
            else:
                # Single statement
                cursor.execute(query)
                rows_affected = cursor.rowcount
            
            # Commit the transaction
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'row_count': rows_affected,
                'message': f'Successfully affected {rows_affected} row(s)'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'row_count': 0
            }
    
    def get_all_table_names(self) -> List[str]:
        """Get all table names from the database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get all table names
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = cursor.fetchall()
            
            conn.close()
            
            # Extract table names from tuples
            table_names = [table[0] for table in tables]
            return table_names
        except Exception as e:
            print(f"Warning: Failed to get table names: {str(e)}")
            return []


# Create singleton instance
dataset_service = None

def get_dataset_service(db_path: str = "askql.db") -> DatasetService:
    """Get or create dataset service instance."""
    global dataset_service
    if dataset_service is None:
        dataset_service = DatasetService(db_path)
    return dataset_service
