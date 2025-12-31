import streamlit as st
import pandas as pd
import plotly.express as px
import json
import os
import hashlib
import uuid
import datetime
import sqlalchemy
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from utils.file_handler import load_file
from utils.data_analyzer import analyze_data
from utils.chart_generator import generate_chart, available_chart_types

# Set page configuration
st.set_page_config(
    page_title="DataViz Pro",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# PostgreSQL setup
database_url = os.environ.get("DATABASE_URL")
engine = create_engine(database_url)
Base = declarative_base()

# Define database models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(100), nullable=False)
    data = Column(Text, nullable=True)  # JSON serialized
    analysis = Column(Text, nullable=True)  # JSON serialized
    charts = Column(Text, nullable=True)  # JSON serialized
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    
    user = relationship("User", back_populates="sessions")

# Create tables
Base.metadata.create_all(engine)

# Create a session factory
SessionLocal = sessionmaker(bind=engine)
db_session = SessionLocal()

# Initialize session state
if 'user' not in st.session_state:
    st.session_state.user = None
if 'data' not in st.session_state:
    st.session_state.data = None
if 'analysis' not in st.session_state:
    st.session_state.analysis = None
if 'charts' not in st.session_state:
    st.session_state.charts = []
if 'current_session_id' not in st.session_state:
    st.session_state.current_session_id = None
if 'user_sessions' not in st.session_state:
    st.session_state.user_sessions = []

# User Authentication Functions
def hash_password(password):
    """Create a hashed password"""
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(username, password):
    """Register a new user"""
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == username).first()
    if existing_user:
        return False, "Username already registered"
    
    # Create new user
    user = User(
        username=username,
        password=hash_password(password)
    )
    
    try:
        db_session.add(user)
        db_session.commit()
        return True, user.id
    except Exception as e:
        db_session.rollback()
        return False, str(e)

def login_user(username, password):
    """Login a user"""
    user = db_session.query(User).filter(User.username == username).first()
    
    if not user:
        return False, "User not found"
    
    if user.password != hash_password(password):
        return False, "Incorrect password"
    
    # Convert SQLAlchemy object to dict for session state
    user_dict = {
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at
    }
    
    return True, user_dict

def save_session(user_id, title, data, analysis, charts):
    """Save current session to database"""
    # Prepare data for PostgreSQL (JSON serialization)
    clean_data = []
    for item in data:
        if isinstance(item, dict):
            clean_item = {}
            for k, v in item.items():
                if isinstance(v, (int, float, str, bool, type(None))):
                    clean_item[k] = v
                else:
                    clean_item[k] = str(v)
            clean_data.append(clean_item)
        else:
            clean_data.append(str(item))
    
    # Clean analysis data 
    clean_analysis = {}
    if analysis:
        for key, value in analysis.items():
            if isinstance(value, (int, float, str, bool, type(None), list, dict)):
                clean_analysis[key] = value
            else:
                clean_analysis[key] = str(value)
    
    # Prepare chart configurations
    chart_configs = []
    for chart in charts:
        chart_config = {
            "type": chart["type"],
            "title": chart["title"],
            "x": chart["x"],
            "y": chart.get("y"),
            "use_color": chart.get("use_color", True),
            "height": chart.get("height", 400),
            "show_grid": chart.get("show_grid", True)
        }
        chart_configs.append(chart_config)
    
    # Convert to JSON strings
    data_json = json.dumps(clean_data)
    analysis_json = json.dumps(clean_analysis)
    charts_json = json.dumps(chart_configs)
    
    try:
        if st.session_state.current_session_id:
            # Update existing session
            session = db_session.query(Session).filter(Session.id == st.session_state.current_session_id).first()
            if session:
                session.title = title
                session.data = data_json
                session.analysis = analysis_json
                session.charts = charts_json
                session.updated_at = datetime.datetime.now()
                db_session.commit()
                return session.id
            else:
                # Session not found, create new
                new_session = Session(
                    user_id=user_id,
                    title=title,
                    data=data_json,
                    analysis=analysis_json,
                    charts=charts_json
                )
                db_session.add(new_session)
                db_session.commit()
                return new_session.id
        else:
            # Create new session
            new_session = Session(
                user_id=user_id,
                title=title,
                data=data_json,
                analysis=analysis_json,
                charts=charts_json
            )
            db_session.add(new_session)
            db_session.commit()
            return new_session.id
    except Exception as e:
        db_session.rollback()
        print(f"Error saving session: {str(e)}")
        return None

def load_sessions(user_id):
    """Load user's saved sessions"""
    try:
        sessions = db_session.query(Session).filter(Session.user_id == user_id).order_by(Session.updated_at.desc()).all()
        
        # Convert SQLAlchemy objects to dicts
        session_list = []
        for session in sessions:
            session_dict = {
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at,
                "updated_at": session.updated_at
            }
            session_list.append(session_dict)
            
        return session_list
    except Exception as e:
        print(f"Error loading sessions: {str(e)}")
        return []

def load_session(session_id):
    """Load a specific session"""
    try:
        session = db_session.query(Session).filter(Session.id == session_id).first()
        if not session:
            return None
            
        # Convert SQLAlchemy object to dict
        session_dict = {
            "id": session.id,
            "user_id": session.user_id,
            "title": session.title,
            "data": json.loads(session.data) if session.data else [],
            "analysis": json.loads(session.analysis) if session.analysis else {},
            "charts": json.loads(session.charts) if session.charts else [],
            "created_at": session.created_at,
            "updated_at": session.updated_at
        }
        
        return session_dict
    except Exception as e:
        print(f"Error loading session: {str(e)}")
        return None

# Title and description
st.title("DataViz Pro")
st.markdown("### Automated Data Visualization Tool")
st.markdown("Create interactive visualizations, save and share dashboards!")

# Login/Registration UI - Smaller, centered form with username instead of email
if not st.session_state.user:
    # Create columns to center the login form
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("<h3 style='text-align: center;'>Sign In</h3>", unsafe_allow_html=True)
        tab1, tab2 = st.tabs(["Login", "Register"])
        
        with tab1:
            login_username = st.text_input("Username", key="login_username")
            login_password = st.text_input("Password", type="password", key="login_password")
            
            if st.button("Login", key="login_button"):
                if login_username and login_password:
                    success, result = login_user(login_username, login_password)
                    if success:
                        st.session_state.user = result
                        st.session_state.user_sessions = load_sessions(result["id"])
                        st.success("Login successful!")
                        st.rerun()
                    else:
                        st.error(result)
                else:
                    st.warning("Please enter both username and password")
        
        with tab2:
            reg_username = st.text_input("Username", key="reg_username")
            reg_password = st.text_input("Password", type="password", key="reg_password")
            reg_password2 = st.text_input("Confirm Password", type="password", key="reg_password2")
            
            if st.button("Register", key="register_button"):
                if reg_username and reg_password:
                    if reg_password != reg_password2:
                        st.error("Passwords do not match")
                    else:
                        success, result = register_user(reg_username, reg_password)
                        if success:
                            st.success("Registration successful! Please login.")
                        else:
                            st.error(result)
                else:
                    st.warning("Please fill all fields")
    
    # Show features section for non-logged in users
    st.header("DataViz Pro Features")
    features = [
        "📊 23 different chart types for comprehensive data visualization",
        "📈 Automated data analysis and insights",
        "🔍 Interactive visualizations with zoom and hover details",
        "💾 Save and share your visualizations",
        "📱 User accounts with saved visualization history",
        "📂 Multiple charts in a single dashboard",
        "🤖 AI-powered chart recommendations"
    ]
    
    for feature in features:
        st.markdown(feature)

# Main application for logged-in users
else:
    # Sidebar for data upload and options
    with st.sidebar:
        st.write(f"Welcome, **{st.session_state.user.get('username')}**!")
        
        if st.button("Logout"):
            st.session_state.user = None
            st.session_state.data = None
            st.session_state.analysis = None
            st.session_state.charts = []
            st.session_state.current_session_id = None
            st.rerun()
        
        st.markdown("---")
        
        # Visualization Management
        st.header("Visualizations")
        
        viz_action = st.radio("", ["Create New", "Load Saved"], index=0)
        
        if viz_action == "Create New":
            session_title = st.text_input("Session Title", "New Visualization")
            
            if st.button("Create New Session"):
                st.session_state.data = None
                st.session_state.analysis = None
                st.session_state.charts = []
                st.session_state.current_session_id = None
                st.success(f"Created new visualization: {session_title}")
                st.rerun()
            
        else:  # Load Saved
            if st.session_state.user_sessions:
                session_options = [f"{s.get('title', 'Untitled')} ({s['created_at'].strftime('%Y-%m-%d')})" for s in st.session_state.user_sessions]
                selected_session = st.selectbox("Select a saved visualization", session_options)
                
                if st.button("Load Visualization"):
                    selected_idx = session_options.index(selected_session)
                    session_id = st.session_state.user_sessions[selected_idx]["id"]
                    
                    # Load full session data
                    session_data = load_session(session_id)
                    if session_data:
                        st.session_state.data = session_data.get("data", [])
                        st.session_state.analysis = session_data.get("analysis", {})
                        st.session_state.current_session_id = session_data["id"]
                        
                        # Recreate charts
                        st.session_state.charts = []
                        for chart_config in session_data.get("charts", []):
                            if st.session_state.data:
                                try:
                                    chart_figure = generate_chart(
                                        pd.DataFrame(st.session_state.data),
                                        chart_config["type"],
                                        chart_config["x"],
                                        chart_config.get("y"),
                                        chart_config.get("title", "Chart"),
                                        chart_config.get("use_color", True),
                                        chart_config.get("height", 400),
                                        chart_config.get("show_grid", True)
                                    )
                                    
                                    st.session_state.charts.append({
                                        "type": chart_config["type"],
                                        "figure": chart_figure,
                                        "title": chart_config.get("title", "Chart"),
                                        "x": chart_config["x"],
                                        "y": chart_config.get("y"),
                                        "use_color": chart_config.get("use_color", True),
                                        "height": chart_config.get("height", 400),
                                        "show_grid": chart_config.get("show_grid", True)
                                    })
                                except Exception as e:
                                    st.warning(f"Could not recreate chart: {str(e)}")
                        
                        st.success(f"Loaded visualization: {selected_session}")
                        st.rerun()
            else:
                st.info("No saved visualizations found")
        
        st.markdown("---")
        
        # Data Input Section
        st.header("Data Input")
        
        # File uploader
        uploaded_file = st.file_uploader("Upload your data file", type=["csv", "json"])
        
        if uploaded_file is not None:
            try:
                # Load data
                st.session_state.data = load_file(uploaded_file)
                
                # Analyze data
                st.session_state.analysis = analyze_data(st.session_state.data)
                
                # Success message
                st.success(f"File loaded successfully with {len(st.session_state.data)} rows and {len(st.session_state.analysis['columns'])} columns")
            
            except Exception as e:
                st.error(f"Error: {str(e)}")
        
        # Save current visualization
        if st.session_state.data is not None and st.button("Save Visualization"):
            # Default title
            current_title = "Untitled Visualization"
            
            # Try to get the title from various sources
            if 'session_title' in locals():
                current_title = session_title
            elif 'session_title' in st.session_state:
                current_title = st.session_state.session_title
                
            session_id = save_session(
                st.session_state.user["id"], 
                current_title,
                st.session_state.data,
                st.session_state.analysis,
                st.session_state.charts
            )
            if session_id:
                st.session_state.current_session_id = session_id
                # Refresh user sessions
                st.session_state.user_sessions = load_sessions(st.session_state.user["id"])
                st.success("Visualization saved successfully!")
            else:
                st.error("Failed to save visualization.")
        
        # Chart creation section
        if st.session_state.data is not None:
            st.markdown("---")
            st.header("Chart Generator")
            
            # Chart type selector with more options
            chart_types = available_chart_types()
            chart_type = st.selectbox("Select Chart Type", chart_types)
            
            # Get column names from data
            columns = list(st.session_state.data[0].keys() if isinstance(st.session_state.data, list) else st.session_state.data.columns)
            
            # Column selectors
            x_column = st.selectbox("X-Axis", columns)
            y_column = st.selectbox("Y-Axis", columns, index=min(1, len(columns)-1))
            
            # Chart options
            with st.expander("Chart Options"):
                chart_title = st.text_input("Chart Title", f"{chart_type.capitalize()} of {y_column} by {x_column}")
                use_color = st.checkbox("Use Color Coding", True)
                chart_height = st.slider("Chart Height", 300, 800, 500)
                show_grid = st.checkbox("Show Grid", True)
            
            # Generate chart button
            if st.button("Generate Chart"):
                # Create chart
                try:
                    chart = generate_chart(
                        pd.DataFrame(st.session_state.data), 
                        chart_type, 
                        x_column, 
                        y_column, 
                        chart_title,
                        use_color,
                        chart_height,
                        show_grid
                    )
                    
                    # Add to charts collection
                    st.session_state.charts.append({
                        "type": chart_type,
                        "figure": chart,
                        "title": chart_title,
                        "x": x_column,
                        "y": y_column,
                        "use_color": use_color,
                        "height": chart_height,
                        "show_grid": show_grid
                    })
                    
                    st.success(f"Chart '{chart_title}' created!")
                except Exception as e:
                    st.error(f"Error creating chart: {str(e)}")
            
            # Multiple chart generation section
            st.markdown("---")
            st.subheader("Multiple Chart Generation")
            
            # Bulk chart generation
            if st.button("Generate Recommended Charts"):
                if st.session_state.analysis and 'recommendations' in st.session_state.analysis:
                    recommendations = st.session_state.analysis['recommendations']
                    successful_charts = 0
                    
                    for rec in recommendations:
                        try:
                            chart_type = rec['chart_type']
                            x_col = rec['columns'][0]
                            y_col = rec.get('columns', ['', ''])[1] if len(rec.get('columns', [])) > 1 else ''
                            title = f"{chart_type.capitalize()} of {y_col} by {x_col}" if y_col else f"{chart_type.capitalize()} of {x_col}"
                            
                            chart = generate_chart(
                                pd.DataFrame(st.session_state.data),
                                chart_type,
                                x_col,
                                y_col,
                                title
                            )
                            
                            st.session_state.charts.append({
                                "type": chart_type,
                                "figure": chart,
                                "title": title,
                                "x": x_col,
                                "y": y_col,
                                "use_color": True,
                                "height": 400,
                                "show_grid": True
                            })
                            successful_charts += 1
                        except Exception as e:
                            pass
                    
                    st.success(f"Generated {successful_charts} charts! Scroll down to view your visualizations.")
                else:
                    st.warning("No chart recommendations available. Please upload data first.")
                    
            # Simple multiple chart generator
            st.subheader("Quick Multi-Chart Generator")
            
            # Get columns
            if st.session_state.data is not None:
                columns = list(st.session_state.data[0].keys() if isinstance(st.session_state.data, list) else st.session_state.data.columns)
                
                # Allow user to select multiple columns for X and Y
                x_columns = st.multiselect("X-Axis Columns", columns, default=[columns[0]] if columns else [])
                y_columns = st.multiselect("Y-Axis Columns", columns, default=[columns[min(1, len(columns)-1)]] if len(columns) > 1 else [])
                
                # Select chart types
                chart_types = available_chart_types()
                selected_types = st.multiselect("Chart Types", chart_types, default=["bar"])
                
                if st.button("Create Multiple Charts"):
                    if not x_columns or not y_columns or not selected_types:
                        st.warning("Please select at least one X column, Y column, and chart type")
                    else:
                        created_charts = 0
                        # Create charts for all combinations
                        for chart_type in selected_types:
                            for x_col in x_columns:
                                for y_col in y_columns:
                                    try:
                                        title = f"{chart_type.capitalize()} of {y_col} by {x_col}"
                                        chart = generate_chart(
                                            pd.DataFrame(st.session_state.data),
                                            chart_type,
                                            x_col,
                                            y_col,
                                            title
                                        )
                                        
                                        st.session_state.charts.append({
                                            "type": chart_type,
                                            "figure": chart,
                                            "title": title,
                                            "x": x_col,
                                            "y": y_col,
                                            "use_color": True,
                                            "height": 400,
                                            "show_grid": True
                                        })
                                        created_charts += 1
                                    except Exception as e:
                                        pass  # Skip failed charts silently
                        
                        st.success(f"Successfully created {created_charts} charts! Scroll down to view your visualizations.")

    # Main content area - Visualization Display
    if st.session_state.data is not None:
        # Data and Visualization Unified Dashboard
        st.header("DataViz Pro Dashboard")
        st.markdown("---")
        
        # SECTION 1: DATA
        st.subheader("📊 Data")
        st.dataframe(st.session_state.data, height=300, use_container_width=True)
        st.markdown("---")
        
        # SECTION 2: ANALYSIS
        if st.session_state.analysis:
            st.subheader("🔍 Data Analysis")
            
            # Column statistics section
            st.markdown("### Column Statistics")
            
            # Debug information
            st.write("Analysis Keys:", list(st.session_state.analysis.keys()))
            
            # Use summary instead of column_stats (which doesn't exist in the analyzer output)
            col_stats = st.session_state.analysis.get('summary', {})
            for col, stats in col_stats.items():
                with st.expander(f"Statistics for: {col}", expanded=False):
                    stats_data = {}
                    for k, v in stats.items():
                        if k != 'histogram':  # Skip histogram data
                            stats_data[k] = v
                    st.dataframe(pd.DataFrame([stats_data]), use_container_width=True)
            
            # Correlations section
            if 'correlations' in st.session_state.analysis:
                st.markdown("### Correlations")
                corrs = st.session_state.analysis['correlations']
                if isinstance(corrs, dict):
                    # Convert to DataFrame
                    corr_df = pd.DataFrame([{'column1': k.split('-')[0], 
                                            'column2': k.split('-')[1], 
                                            'correlation': v} 
                                          for k, v in corrs.items()])
                    if not corr_df.empty:
                        st.dataframe(corr_df, use_container_width=True)
                elif isinstance(corrs, list):
                    # Already a list of correlations
                    st.dataframe(pd.DataFrame(corrs), use_container_width=True)
            
            st.markdown("---")
        
        # SECTION 3: VISUALIZATIONS
        st.subheader("📈 Visualizations")
        
        if st.session_state.charts:
            total_charts = len(st.session_state.charts)
            
            # Process charts in pairs for the first row (show 2 charts side by side)
            if total_charts >= 2:
                # Create the first row with 2 columns
                col1, col2 = st.columns(2)
                
                # First chart
                with col1:
                    chart = st.session_state.charts[0]
                    st.markdown(f"### {chart['title']}")
                    st.plotly_chart(chart['figure'], use_container_width=True)
                    if st.button(f"Delete", key=f"delete_0"):
                        st.session_state.charts.pop(0)
                        st.rerun()
                
                # Second chart
                with col2:
                    chart = st.session_state.charts[1]
                    st.markdown(f"### {chart['title']}")
                    st.plotly_chart(chart['figure'], use_container_width=True)
                    if st.button(f"Delete", key=f"delete_1"):
                        st.session_state.charts.pop(1)
                        st.rerun()
                
                # Add separator after the first row
                st.markdown("---")
                
                # Display remaining charts vertically
                if total_charts > 2:
                    st.subheader("Additional Charts")
                    for i in range(2, total_charts):
                        chart = st.session_state.charts[i]
                        st.markdown(f"### {chart['title']}")
                        st.plotly_chart(chart['figure'], use_container_width=True)
                        if st.button(f"Delete Chart", key=f"delete_{i}"):
                            st.session_state.charts.pop(i)
                            st.rerun()
                        st.markdown("---")
            else:
                # If only one chart, display it normally
                for i, chart in enumerate(st.session_state.charts):
                    st.markdown(f"### {chart['title']}")
                    st.plotly_chart(chart['figure'], use_container_width=True)
                    if st.button(f"Delete Chart", key=f"delete_{i}"):
                        st.session_state.charts.pop(i)
                        st.rerun()
                    st.markdown("---")
            
            # Add summary of charts at the bottom
            st.subheader(f"Dashboard Summary")
            st.write(f"Your dashboard currently contains {len(st.session_state.charts)} charts.")
        else:
            st.info("No charts created yet. Use the Chart Generator in the sidebar to create visualizations.")
    else:
        st.info("Upload a data file to get started with analysis and visualization.")