import streamlit as st
import pandas as pd
import json
import io
from utils.file_handler import load_file
from utils.data_analyzer import analyze_data
from utils.chart_generator import generate_chart, available_chart_types

# Page configuration
st.set_page_config(
    page_title="DataViz Pro",
    page_icon="📊",
    layout="wide"
)

# Application title and description
st.title("DataViz Pro: Automated Data Visualization")
st.markdown("""
Upload your CSV or JSON data files and automatically generate interactive visualizations.
Analyze patterns and customize your charts with just a few clicks.
""")

# Sidebar for upload and options
with st.sidebar:
    st.header("Data Input")
    uploaded_file = st.file_uploader(
        "Upload a CSV or JSON file",
        type=["csv", "json"],
        help="Select a data file from your computer"
    )
    
    # Show info about the expected format
    with st.expander("File Format Guidelines"):
        st.info("""
        - CSV files should have headers in the first row
        - JSON files should contain an array of objects with consistent keys
        - For best results, ensure numeric data is properly formatted
        """)

# Main content area
if uploaded_file is not None:
    try:
        # Load the data based on file type
        df = load_file(uploaded_file)
        
        # Display data preview
        st.subheader("Data Preview")
        st.dataframe(df.head(5), use_container_width=True)
        
        # Data analysis section
        st.subheader("Data Analysis")
        analysis_results = analyze_data(df)
        
        # Display data summary
        col1, col2 = st.columns(2)
        with col1:
            st.write("**Dataset Summary**")
            st.write(f"Total Rows: {len(df)}")
            st.write(f"Total Columns: {len(df.columns)}")
            
            # Display data types
            st.write("**Column Types**")
            for col, dtype in df.dtypes.items():
                st.write(f"- {col}: {dtype}")
        
        with col2:
            st.write("**Numeric Columns Summary**")
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                st.write(analysis_results['numeric_summary'])
            else:
                st.info("No numeric columns found for analysis")
        
        # Correlation matrix for numeric columns (if at least 2 exist)
        if 'correlation' in analysis_results and len(numeric_cols) > 1:
            st.subheader("Correlation Analysis")
            st.write("Correlation between numeric columns:")
            st.dataframe(analysis_results['correlation'], use_container_width=True)
            
        # Visualization section
        st.subheader("Data Visualization")
        
        # Chart configuration options
        col1, col2, col3 = st.columns(3)
        
        with col1:
            chart_type = st.selectbox(
                "Select Chart Type",
                options=available_chart_types(),
                help="Choose the type of chart to visualize your data"
            )
        
        with col2:
            if len(df.columns) > 0:
                x_axis = st.selectbox(
                    "X-Axis",
                    options=df.columns.tolist(),
                    help="Select the column for the X-axis"
                )
            
        with col3:
            if len(df.columns) > 0:
                # Determine suitable Y-axis options (prefer numeric columns)
                numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
                y_options = numeric_cols if numeric_cols else df.columns.tolist()
                
                if chart_type in ['pie', 'donut']:
                    # For pie charts, we need a value column
                    y_axis = st.selectbox(
                        "Value Column",
                        options=y_options,
                        help="Select the column with values to visualize"
                    )
                else:
                    y_axis = st.selectbox(
                        "Y-Axis",
                        options=y_options,
                        help="Select the column for the Y-axis"
                    )
        
        # Additional chart options
        with st.expander("Chart Customization"):
            chart_title = st.text_input("Chart Title", value=f"{y_axis} vs {x_axis}" if 'x_axis' in locals() and 'y_axis' in locals() else "Data Visualization")
            use_color = st.checkbox("Use Color Coding", value=True)
            
            # Height adjustment
            chart_height = st.slider("Chart Height", min_value=300, max_value=800, value=400, step=50)
            
            # Additional options based on chart type
            if chart_type in ['bar', 'line']:
                show_grid = st.checkbox("Show Grid Lines", value=True)
            else:
                show_grid = False
                
            if chart_type == 'pie':
                donut = st.checkbox("Make it a Donut Chart", value=False)
                if donut:
                    chart_type = 'donut'
        
        # Generate and display the chart
        st.subheader(chart_title)
        if 'x_axis' in locals() and 'y_axis' in locals():
            try:
                chart = generate_chart(
                    df, 
                    chart_type=chart_type, 
                    x_column=x_axis, 
                    y_column=y_axis,
                    title=chart_title,
                    use_color=use_color,
                    height=chart_height,
                    show_grid=show_grid
                )
                st.plotly_chart(chart, use_container_width=True)
                
                # Download options for the chart
                st.download_button(
                    label="Download Chart as HTML",
                    data=chart.to_html(),
                    file_name=f"{chart_title.replace(' ', '_')}.html",
                    mime="text/html"
                )
            except Exception as e:
                st.error(f"Error generating chart: {str(e)}")
                st.info("Try selecting different columns or chart type.")
    
    except Exception as e:
        st.error(f"Error processing file: {str(e)}")
        st.info("Please check your file format and try again.")

else:
    # Display info when no file is uploaded
    st.info("👆 Upload a CSV or JSON file from the sidebar to get started")
    
    # Show example of what can be done
    st.subheader("What you can do with DataViz Pro:")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("### 📊 Generate Charts")
        st.markdown("Automatically create bar, line, pie, scatter, and area charts from your data")
    
    with col2:
        st.markdown("### 📈 Analyze Patterns")
        st.markdown("Discover trends, correlations, and statistics in your dataset")
    
    with col3:
        st.markdown("### 🎨 Customize Visuals")
        st.markdown("Adjust colors, labels, and chart settings to create the perfect visualization")
    
    # Disclaimer about data privacy
    st.markdown("---")
    st.caption("**Privacy Note**: Your data is processed locally and is not stored on any server.")
