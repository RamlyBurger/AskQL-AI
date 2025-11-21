"""Chart generation service - asks AI for chart decisions, then structures data with Python."""
import json
from typing import Dict, List, Optional, Any


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


async def ask_ai_for_chart_config(
    query_result: Dict,
    ai_service,
    model: str,
    api_key: str,
    user_query: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Ask AI to determine if chart is needed and what type.
    
    Args:
        query_result: The query execution result with data, columns, row_count
        ai_service: AI service instance
        model: AI model to use
        api_key: API key for the model
        user_query: The original user query to check for explicit chart type requests
        
    Returns:
        Chart decision dict or None
    """
    data = query_result.get('data', [])
    columns = query_result.get('columns', [])
    row_count = query_result.get('row_count', 0)
    
    # Don't ask AI for empty results
    if row_count == 0:
        return None
    
    # For single-row results, create a simple bar chart automatically
    if row_count == 1:
        # Find numeric columns for visualization
        numeric_cols = []
        for col in columns:
            if data and col in data[0]:
                val = data[0][col]
                if isinstance(val, (int, float)):
                    numeric_cols.append(col)
        
        # If we have at least one numeric column, create a bar chart
        if numeric_cols:
            return {
                'chart_type': 'bar',
                'x_axis': columns[0],  # First column as category
                'y_axes': numeric_cols,  # All numeric columns as values
                'title': f'{", ".join(numeric_cols)} by {columns[0]}'
            }
        return None
    
    # Prepare prompt for AI
    user_query_context = f"\n\nOriginal User Query: {user_query}" if user_query else ""
    
    # Apply text truncation and numerical formatting to sample data
    sample_data = _truncate_text_fields(data[:5], max_length=20)
    
    prompt = f"""Analyze this SQL result data and intelligently choose the most meaningful chart configuration.

Data: {row_count} rows, columns: {', '.join(columns)}
Sample: {json.dumps(sample_data, indent=2)}{user_query_context}

⚠️ CRITICAL ANALYSIS REQUIRED:
1. **Examine Sample Data Carefully**: Look at the actual sample data values, not just column names
2. **Duplicate Detection**: Count unique values in each potential x-axis column from the sample
3. **Smart X-Axis Selection**: Choose the column with the most unique values that creates meaningful categories

MANDATORY DUPLICATE CHECK:
- **Store Column**: Count unique Store values in sample data
- **Date Column**: Count unique Date values in sample data  
- **Other Categorical Columns**: Count unique values for each potential x-axis
- **Rule**: If a column has mostly duplicate values in the sample, DO NOT use it as x-axis

INTELLIGENT AXIS SELECTION:
- **If Store values are mostly the same**: Use Date as x-axis for time series OR another differentiating column
- **If Date values are mostly the same**: Use Store as x-axis for store comparison OR another differentiating column
- **For rankings**: Choose the column that actually varies across rows in the sample data
- **For time trends**: Only use Date if there are multiple distinct dates in the sample

EXAMPLE ANALYSIS:
Sample showing Store=1, Store=1, Store=1, Store=1, Store=1 with different dates:
- Store has 1 unique value → BAD x-axis choice (no variation)
- Date has 5 unique values → GOOD x-axis choice (shows variation)
- Correct choice: x_axis="Date" for time series of sales

CHART TYPE PRIORITY:
1. **User Request**: Explicit chart type mentions override all rules
2. **PIE**: Distribution/breakdown of categorical data (3-8 segments)
3. **LINE**: Time trends with multiple distinct time points
4. **GROUPED_BAR**: Comparing 2+ metrics across categories
5. **BAR**: Single metric comparison, rankings, or when other types don't fit

JSON Response:
{{
  "should_chart": true/false,
  "chart_type": "line|bar|pie|grouped_bar",
  "x_axis": "most_meaningful_categorical_column",
  "y_axis": ["compatible_numeric_columns"],
  "title": "Descriptive chart title",
  "x_axis_label": "Clear x label",
  "y_axis_label": "Clear y label"
}}

Return {{"should_chart": false}} if data is unsuitable for visualization."""

    try:
        # Ask AI for chart decision
        response = await ai_service.generate_response(
            query=prompt,
            model=model,
            api_key=api_key,
            conversation_history=None,
            table_schemas=None
        )
        
        # Extract JSON from response
        # Try to find JSON object in response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            json_str = json_match.group()
            chart_decision = json.loads(json_str)
            
            if chart_decision.get('should_chart'):
                return chart_decision
            else:
                return None
        else:
            return None
        
    except Exception as e:
        print(f"❌ Error asking AI for chart config: {e}")
        import traceback
        traceback.print_exc()
        return None


def filter_compatible_scales(data: List[Dict], y_axes: List[str]) -> List[str]:
    """
    Filter numeric columns to only include those with compatible scales.
    
    When columns have vastly different ranges (e.g., millions vs single digits),
    displaying them on the same chart makes smaller values invisible.
    
    Args:
        data: The query result data
        y_axes: List of numeric column names
        
    Returns:
        Filtered list of column names with compatible scales
    """
    if len(y_axes) <= 1:
        return y_axes
    
    # Calculate average values for each column
    column_averages = {}
    for col in y_axes:
        values = []
        for row in data:
            val = row.get(col)
            if isinstance(val, (int, float)) and val != 0:  # Exclude zeros to avoid skewing averages
                values.append(abs(val))  # Use absolute values
            elif val is not None:
                try:
                    num_val = float(val)
                    if num_val != 0:
                        values.append(abs(num_val))
                except (ValueError, TypeError):
                    continue
        
        if values:
            column_averages[col] = sum(values) / len(values)
        else:
            # If all values are zero or invalid, use a small default to avoid division issues
            column_averages[col] = 1.0
    
    # Group columns by similar scales (within 2 orders of magnitude)
    scale_groups = []
    for col, avg in column_averages.items():
        # Find a compatible group (within 100x difference)
        placed = False
        for group in scale_groups:
            group_avg = sum(column_averages[c] for c in group) / len(group)
            ratio = max(avg, group_avg) / min(avg, group_avg)
            
            # If within 100x difference, add to this group
            if ratio <= 100:
                group.append(col)
                placed = True
                break
        
        # If no compatible group found, create new group
        if not placed:
            scale_groups.append([col])
    
    # Return the largest group (most columns with compatible scales)
    if scale_groups:
        largest_group = max(scale_groups, key=len)
        excluded_columns = [col for col in y_axes if col not in largest_group]
        
        return largest_group
    
    # Fallback: return first column if no groups found
    return y_axes[:1]


def structure_chart_data(
    query_result: Dict,
    chart_decision: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Structure the query data into proper chart format based on AI's decision.
    
    Args:
        query_result: The query execution result
        chart_decision: AI's decision about chart type and axes
        
    Returns:
        Structured chart configuration ready for frontend
    """
    data = query_result.get('data', [])
    
    x_axis = chart_decision.get('x_axis')
    y_axes = chart_decision.get('y_axis', [])
    chart_type = chart_decision.get('chart_type', 'bar')
    title = chart_decision.get('title', 'Data Visualization')
    x_axis_label = chart_decision.get('x_axis_label', x_axis)
    y_axis_label = chart_decision.get('y_axis_label')
    
    # Filter out non-numeric columns from y_axes
    if data and y_axes:
        numeric_y_axes = []
        for y_col in y_axes:
            # Check if column has numeric values
            first_val = data[0].get(y_col)
            if isinstance(first_val, (int, float)):
                numeric_y_axes.append(y_col)
            else:
                # Try to convert - if it fails, it's not numeric
                try:
                    float(first_val)
                    numeric_y_axes.append(y_col)
                except (ValueError, TypeError):
                    print(f"⚠️ Excluding non-numeric column '{y_col}' from chart")
        
        # Update y_axes with only numeric columns
        if numeric_y_axes:
            y_axes = numeric_y_axes
            
            # Filter out columns with vastly different scales to improve chart readability
            if len(y_axes) > 1:
                y_axes = filter_compatible_scales(data, y_axes)
        else:
            # No numeric y columns, can't create chart
            print(f"⚠️ No numeric y-axis columns found, cannot create chart")
            return None
    
    # Convert grouped_bar to bar (frontend handles multiple datasets as grouped)
    if chart_type == 'grouped_bar':
        chart_type = 'bar'
    
    # Validate scatter chart has numeric x-axis
    if chart_type == 'scatter' and data:
        # Check if x_axis column is numeric
        first_x_val = data[0].get(x_axis)
        is_numeric_x = isinstance(first_x_val, (int, float))
        
        # If x-axis is not numeric, convert to bar chart
        if not is_numeric_x:
            print(f"⚠️ Scatter chart has non-numeric x-axis '{x_axis}', converting to bar chart")
            chart_type = 'bar'
            # Limit y_axes to 2 most relevant columns for readability
            if len(y_axes) > 2:
                y_axes = y_axes[:2]
    
    # For scatter charts, we need numeric x values
    if chart_type == 'scatter':
        # Extract x values as numbers
        x_values = []
        for row in data:
            val = row.get(x_axis)
            # Convert to number
            if isinstance(val, (int, float)):
                x_values.append(val)
            else:
                try:
                    x_values.append(float(val))
                except (ValueError, TypeError):
                    x_values.append(0)
        
        # Extract datasets from y_axis columns with x-y pairs
        datasets = []
        for y_col in y_axes:
            scatter_data = []
            for idx, row in enumerate(data):
                val = row.get(y_col)
                # Convert to number
                if isinstance(val, (int, float)):
                    y_val = val
                else:
                    try:
                        y_val = float(val)
                    except (ValueError, TypeError):
                        y_val = 0
                
                scatter_data.append({
                    "x": x_values[idx],
                    "y": y_val
                })
            
            datasets.append({
                "label": y_col,
                "data": scatter_data
            })
        
        chart_config = {
            "type": chart_type,
            "title": title,
            "x_axis_label": x_axis_label,
            "data": {
                "datasets": datasets
            }
        }
        if y_axis_label:
            chart_config["y_axis_label"] = y_axis_label
        return chart_config
    else:
        # For other chart types (line, bar, pie)
        # Extract labels from x_axis column
        labels = []
        seen_labels = set()
        for row in data:
            label = str(row.get(x_axis, ''))
            # Skip duplicate labels to avoid duplicate x-axis items
            if label in seen_labels:
                continue
            seen_labels.add(label)
            labels.append(label)
        
        # Extract datasets from y_axis columns
        datasets = []
        for y_col in y_axes:
            values = []
            seen_labels_for_values = set()
            for row in data:
                label = str(row.get(x_axis, ''))
                # Only include values for unique labels
                if label in seen_labels_for_values:
                    continue
                seen_labels_for_values.add(label)
                
                val = row.get(y_col)
                # Convert to number, default to 0 if not numeric
                if isinstance(val, (int, float)):
                    values.append(val)
                else:
                    try:
                        values.append(float(val))
                    except (ValueError, TypeError):
                        values.append(0)
            
            datasets.append({
                "label": y_col,
                "data": values
            })
        
        chart_config = {
            "type": chart_type,
            "title": title,
            "data": {
                "labels": labels,
                "datasets": datasets
            }
        }
        if x_axis_label and x_axis_label != x_axis:
            chart_config["x_axis_label"] = x_axis_label
        if y_axis_label:
            chart_config["y_axis_label"] = y_axis_label
        return chart_config


def format_chart_block(chart_config: Dict[str, Any]) -> str:
    """
    Format chart configuration as a markdown code block.
    
    Args:
        chart_config: Chart configuration dict
        
    Returns:
        Formatted markdown string
    """
    return f"""```chart
{json.dumps(chart_config, indent=2)}
```"""
