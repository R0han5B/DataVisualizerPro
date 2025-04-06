import pandas as pd
import numpy as np

def analyze_data(df):
    """
    Analyze the provided DataFrame to extract useful statistics and patterns
    
    Parameters:
    df (pandas.DataFrame): The data to analyze
    
    Returns:
    dict: Dictionary containing various analysis results
    """
    results = {}
    
    # Get basic info about the dataset
    results['row_count'] = len(df)
    results['column_count'] = len(df.columns)
    results['column_types'] = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    # Analyze numeric columns
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    if numeric_cols:
        # Calculate basic statistics for numeric columns
        results['numeric_summary'] = df[numeric_cols].describe()
        
        # Calculate correlation matrix if there are at least 2 numeric columns
        if len(numeric_cols) > 1:
            results['correlation'] = df[numeric_cols].corr().round(2)
        
        # Identify potential outliers using IQR method
        outliers = {}
        for col in numeric_cols:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outlier_count = len(df[(df[col] < lower_bound) | (df[col] > upper_bound)])
            if outlier_count > 0:
                outliers[col] = outlier_count
        
        if outliers:
            results['potential_outliers'] = outliers
    
    # Analyze categorical columns (non-numeric)
    cat_cols = [col for col in df.columns if col not in numeric_cols]
    if cat_cols:
        cat_summaries = {}
        for col in cat_cols:
            # Get value counts for categorical data
            # Limit to top 10 categories to avoid overwhelming output
            value_counts = df[col].value_counts().head(10)
            cat_summaries[col] = {
                'unique_values': df[col].nunique(),
                'top_values': value_counts.to_dict()
            }
        results['categorical_summary'] = cat_summaries

    # Check for missing values
    missing_vals = df.isnull().sum()
    if missing_vals.sum() > 0:
        missing_cols = {col: count for col, count in missing_vals.items() if count > 0}
        results['missing_values'] = missing_cols
    
    # Check data distribution for numeric columns
    if numeric_cols:
        distribution = {}
        for col in numeric_cols:
            skewness = df[col].skew()
            kurtosis = df[col].kurtosis()
            distribution[col] = {
                'skewness': round(skewness, 2),
                'kurtosis': round(kurtosis, 2),
                'is_normal': abs(skewness) < 0.5 and abs(kurtosis) < 0.5
            }
        results['distribution'] = distribution
    
    return results
