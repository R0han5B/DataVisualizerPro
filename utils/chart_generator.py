import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

def available_chart_types():
    """
    Returns a list of available chart types
    
    Returns:
    list: List of supported chart types
    """
    return [
        'bar', 
        'line', 
        'scatter', 
        'pie', 
        'area', 
        'histogram',
        'box', 
        'violin'
    ]

def generate_chart(df, chart_type, x_column, y_column, title=None, use_color=True, height=400, show_grid=True):
    """
    Generate an interactive chart based on the specified parameters
    
    Parameters:
    df (pandas.DataFrame): The data to visualize
    chart_type (str): Type of chart to generate
    x_column (str): Column to use for x-axis
    y_column (str): Column to use for y-axis
    title (str, optional): Chart title
    use_color (bool, optional): Whether to use color coding
    height (int, optional): Height of the chart in pixels
    show_grid (bool, optional): Whether to show grid lines
    
    Returns:
    plotly.graph_objects.Figure: The generated chart
    """
    # Set default title if not provided
    if title is None:
        title = f"{y_column} by {x_column}"
    
    # Create figure with appropriate type
    if chart_type == 'bar':
        fig = px.bar(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            color=x_column if use_color else None,
            height=height
        )
    
    elif chart_type == 'line':
        fig = px.line(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            markers=True,
            height=height
        )
    
    elif chart_type == 'scatter':
        fig = px.scatter(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            color=x_column if use_color else None,
            height=height
        )
    
    elif chart_type == 'pie':
        # For pie charts, we need to aggregate if there are duplicate x values
        pie_data = df.groupby(x_column)[y_column].sum().reset_index()
        fig = px.pie(
            pie_data, 
            names=x_column, 
            values=y_column,
            title=title,
            height=height
        )
    
    elif chart_type == 'donut':
        # Similar to pie but with a hole
        pie_data = df.groupby(x_column)[y_column].sum().reset_index()
        fig = px.pie(
            pie_data, 
            names=x_column, 
            values=y_column,
            title=title,
            height=height,
            hole=0.4
        )
    
    elif chart_type == 'area':
        fig = px.area(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            height=height
        )
    
    elif chart_type == 'histogram':
        fig = px.histogram(
            df, 
            x=x_column,
            title=title,
            height=height,
            color=y_column if use_color else None
        )
    
    elif chart_type == 'box':
        fig = px.box(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            height=height,
            color=x_column if use_color else None
        )
    
    elif chart_type == 'violin':
        fig = px.violin(
            df, 
            x=x_column, 
            y=y_column,
            title=title,
            height=height,
            box=True
        )
    
    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")
    
    # Configure layout
    fig.update_layout(
        title_x=0.5,  # Center the title
        xaxis_title=x_column,
        yaxis_title=y_column if chart_type not in ['pie', 'donut'] else None,
        template="plotly" if show_grid else "plotly_white"
    )
    
    # Adjust for readability with many categories
    if chart_type in ['bar', 'pie', 'donut']:
        unique_categories = df[x_column].nunique()
        if unique_categories > 10:
            if chart_type == 'bar':
                fig.update_layout(xaxis_tickangle=-45)
            elif chart_type in ['pie', 'donut']:
                # Limit pie chart segments and add "Other" category
                top_n = 9  # Show top 9 categories and group the rest as "Other"
                pie_data = df.groupby(x_column)[y_column].sum().reset_index()
                sorted_data = pie_data.sort_values(by=y_column, ascending=False)
                
                top_data = sorted_data.head(top_n)
                other_value = sorted_data.iloc[top_n:][y_column].sum()
                
                if other_value > 0:
                    other_row = pd.DataFrame({x_column: ['Other'], y_column: [other_value]})
                    final_data = pd.concat([top_data, other_row], ignore_index=True)
                    
                    fig = px.pie(
                        final_data,
                        names=x_column,
                        values=y_column,
                        title=title,
                        height=height,
                        hole=0.4 if chart_type == 'donut' else 0
                    )
    
    return fig
