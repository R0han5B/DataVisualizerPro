import pandas as pd
import json
import io
import streamlit as st

def load_file(uploaded_file):
    """
    Load data from an uploaded CSV or JSON file into a pandas DataFrame
    
    Parameters:
    uploaded_file (UploadedFile): The file uploaded via Streamlit's file_uploader
    
    Returns:
    pandas.DataFrame: The loaded data
    """
    # Get file type from name
    file_type = uploaded_file.name.split('.')[-1].lower()
    
    # Process based on file type
    if file_type == 'csv':
        try:
            # Try to infer encoding and delimiter
            return pd.read_csv(uploaded_file, encoding='utf-8')
        except UnicodeDecodeError:
            # If utf-8 fails, try other common encodings
            try:
                return pd.read_csv(uploaded_file, encoding='latin1')
            except Exception as e:
                raise Exception(f"Failed to parse CSV file: {str(e)}")
        except Exception as e:
            # Handle other CSV parsing errors
            raise Exception(f"Error loading CSV file: {str(e)}")
    
    elif file_type == 'json':
        try:
            # Load JSON data
            json_data = json.load(uploaded_file)
            
            # Handle different JSON structures
            if isinstance(json_data, list):
                # JSON is a list of objects/records
                return pd.json_normalize(json_data)
            elif isinstance(json_data, dict):
                # Check if it's a nested structure with a data array
                if 'data' in json_data and isinstance(json_data['data'], list):
                    return pd.json_normalize(json_data['data'])
                # Otherwise try to convert the dict directly
                else:
                    return pd.DataFrame([json_data])
            else:
                raise Exception("Unsupported JSON structure. Please provide a JSON array of objects.")
        except Exception as e:
            raise Exception(f"Error loading JSON file: {str(e)}")
    
    else:
        raise Exception(f"Unsupported file type: {file_type}. Please upload a CSV or JSON file.")
