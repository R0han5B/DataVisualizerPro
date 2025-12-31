/**
 * Analyze data to extract useful statistics and patterns
 * @param {Array} data - Array of data objects
 * @returns {Object} - Analysis results
 */
const analyzeData = (data) => {
  if (!data || data.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0,
      columns: [],
      summary: {},
      insights: []
    };
  }
  
  const columns = Object.keys(data[0]);
  const columnTypes = {};
  const summary = {};
  const insights = [];
  
  // Identify column types and basic statistics
  columns.forEach(column => {
    const values = data.map(row => row[column]);
    const nonEmptyValues = values.filter(val => val !== null && val !== undefined && val !== '');
    
    // Skip empty columns
    if (nonEmptyValues.length === 0) {
      columnTypes[column] = 'empty';
      summary[column] = { type: 'empty' };
      return;
    }
    
    // Check for numeric values
    const numericValues = nonEmptyValues.filter(val => !isNaN(val));
    const isNumeric = numericValues.length > 0 && numericValues.length === nonEmptyValues.length;
    
    // Check for date values
    const dateValues = nonEmptyValues.filter(val => {
      if (typeof val !== 'string') return false;
      return !isNaN(Date.parse(val));
    });
    const isDate = dateValues.length > 0 && dateValues.length === nonEmptyValues.length;
    
    // Determine column type
    let type = 'categorical';
    if (isNumeric) {
      type = 'numeric';
    } else if (isDate) {
      type = 'date';
    }
    
    columnTypes[column] = type;
    
    // Calculate summary statistics based on type
    summary[column] = { type };
    
    if (type === 'numeric') {
      // Numeric summary statistics
      const numValues = numericValues.map(val => Number(val));
      summary[column].min = Math.min(...numValues);
      summary[column].max = Math.max(...numValues);
      summary[column].mean = numValues.reduce((sum, val) => sum + val, 0) / numValues.length;
      
      // Calculate median
      const sorted = [...numValues].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      summary[column].median = sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
      
      // Count unique values
      const uniqueValues = new Set(numValues);
      summary[column].uniqueCount = uniqueValues.size;
      
      // Add insights for numeric columns
      if (numValues.length > 5) {
        const std = calculateStandardDeviation(numValues);
        summary[column].std = std;
        
        // Check for outliers using IQR method
        const q1 = sorted[Math.floor(sorted.length / 4)];
        const q3 = sorted[Math.floor(3 * sorted.length / 4)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outliers = numValues.filter(val => val < lowerBound || val > upperBound);
        
        if (outliers.length > 0) {
          insights.push({
            type: 'outliers',
            column,
            message: `Found ${outliers.length} outliers in column "${column}"`,
            count: outliers.length
          });
        }
      }
    } else if (type === 'categorical') {
      // Categorical summary statistics
      const valueCounts = {};
      nonEmptyValues.forEach(val => {
        valueCounts[val] = (valueCounts[val] || 0) + 1;
      });
      
      const uniqueValues = Object.keys(valueCounts);
      summary[column].uniqueCount = uniqueValues.length;
      summary[column].topValues = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
      
      // Add insights for categorical columns
      if (uniqueValues.length === 1) {
        insights.push({
          type: 'constant',
          column,
          message: `Column "${column}" has only one value: "${uniqueValues[0]}"`,
          value: uniqueValues[0]
        });
      } else if (uniqueValues.length <= 5 && uniqueValues.length > 1) {
        insights.push({
          type: 'categorical',
          column,
          message: `Column "${column}" has ${uniqueValues.length} unique values, suitable for grouping`,
          uniqueCount: uniqueValues.length
        });
      }
    } else if (type === 'date') {
      // Date summary statistics
      const dates = dateValues.map(val => new Date(val));
      summary[column].min = new Date(Math.min(...dates));
      summary[column].max = new Date(Math.max(...dates));
      
      // Check if dates are sequential
      const sortedDates = [...dates].sort((a, b) => a - b);
      let isSequential = true;
      let hasGaps = false;
      
      for (let i = 1; i < sortedDates.length; i++) {
        const diff = sortedDates[i] - sortedDates[i - 1];
        if (diff === 0) {
          isSequential = false;
          break;
        }
        
        // Check for large gaps (more than 2x median difference)
        if (i > 1) {
          const prevDiff = sortedDates[i - 1] - sortedDates[i - 2];
          if (diff > 2 * prevDiff) {
            hasGaps = true;
          }
        }
      }
      
      if (isSequential) {
        insights.push({
          type: 'time_series',
          column,
          message: `Column "${column}" contains sequential dates, suitable for time series analysis`,
          hasGaps
        });
      }
    }
  });
  
  // Correlation analysis for numeric columns
  const numericColumns = columns.filter(col => columnTypes[col] === 'numeric');
  if (numericColumns.length >= 2) {
    const correlations = [];
    
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        
        const values1 = data.map(row => Number(row[col1]));
        const values2 = data.map(row => Number(row[col2]));
        
        const correlation = calculateCorrelation(values1, values2);
        
        if (!isNaN(correlation) && Math.abs(correlation) > 0.7) {
          correlations.push({
            columns: [col1, col2],
            correlation: correlation,
            message: `Strong ${correlation > 0 ? 'positive' : 'negative'} correlation (${correlation.toFixed(2)}) between "${col1}" and "${col2}"`
          });
        }
      }
    }
    
    if (correlations.length > 0) {
      insights.push({
        type: 'correlation',
        correlations,
        message: `Found ${correlations.length} strong correlations between columns`
      });
    }
  }
  
  // Recommend visualization types based on data
  const recommendations = recommendVisualizations(data, columnTypes);
  
  return {
    rowCount: data.length,
    columnCount: columns.length,
    columns: columns.map(name => ({
      name,
      type: columnTypes[name]
    })),
    summary,
    insights,
    recommendations
  };
};

/**
 * Calculate standard deviation of values
 * @param {Array} values - Array of numeric values
 * @returns {number} - Standard deviation
 */
const calculateStandardDeviation = (values) => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {Array} x - First array of values
 * @param {Array} y - Second array of values
 * @returns {number} - Correlation coefficient
 */
const calculateCorrelation = (x, y) => {
  const n = x.length;
  
  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate sum of products of deviations
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    const xDev = x[i] - meanX;
    const yDev = y[i] - meanY;
    sumXY += xDev * yDev;
    sumX2 += xDev * xDev;
    sumY2 += yDev * yDev;
  }
  
  // Calculate correlation
  if (sumX2 === 0 || sumY2 === 0) return 0;
  return sumXY / Math.sqrt(sumX2 * sumY2);
};

/**
 * Recommend appropriate visualization types based on data
 * @param {Array} data - Array of data objects
 * @param {Object} columnTypes - Object mapping column names to types
 * @returns {Array} - Array of visualization recommendations
 */
const recommendVisualizations = (data, columnTypes) => {
  const recommendations = [];
  const columns = Object.keys(columnTypes);
  
  // Get categorical and numeric columns
  const categoricalColumns = columns.filter(col => columnTypes[col] === 'categorical');
  const numericColumns = columns.filter(col => columnTypes[col] === 'numeric');
  const dateColumns = columns.filter(col => columnTypes[col] === 'date');
  
  // Bar chart for categorical vs. numeric data
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    recommendations.push({
      type: 'bar',
      suitability: 'high',
      message: 'Bar chart to compare numeric values across categories',
      suggested: {
        x: categoricalColumns[0],
        y: numericColumns[0]
      }
    });
  }
  
  // Pie chart for categorical data with few categories
  const fewCategoriesColumn = categoricalColumns.find(col => {
    const uniqueValues = new Set(data.map(row => row[col]));
    return uniqueValues.size <= 7;
  });
  
  if (fewCategoriesColumn && numericColumns.length > 0) {
    recommendations.push({
      type: 'pie',
      suitability: 'medium',
      message: 'Pie chart to show distribution of a categorical variable',
      suggested: {
        x: fewCategoriesColumn,
        y: numericColumns[0]
      }
    });
  }
  
  // Line chart for time series data
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    recommendations.push({
      type: 'line',
      suitability: 'high',
      message: 'Line chart to show trends over time',
      suggested: {
        x: dateColumns[0],
        y: numericColumns[0]
      }
    });
  }
  
  // Scatter plot for numeric vs. numeric
  if (numericColumns.length >= 2) {
    recommendations.push({
      type: 'scatter',
      suitability: 'high',
      message: 'Scatter plot to explore relationship between two numeric variables',
      suggested: {
        x: numericColumns[0],
        y: numericColumns[1]
      }
    });
  }
  
  // Histogram for numeric data distribution
  if (numericColumns.length > 0) {
    recommendations.push({
      type: 'histogram',
      suitability: 'high',
      message: 'Histogram to show distribution of a numeric variable',
      suggested: {
        x: numericColumns[0]
      }
    });
  }
  
  // Box plot for numeric data distribution by category
  if (numericColumns.length > 0 && categoricalColumns.length > 0) {
    recommendations.push({
      type: 'boxplot',
      suitability: 'medium',
      message: 'Box plot to show distribution statistics grouped by category',
      suggested: {
        x: categoricalColumns[0],
        y: numericColumns[0]
      }
    });
  }
  
  // Heatmap for correlation matrix
  if (numericColumns.length >= 3) {
    recommendations.push({
      type: 'heatmap',
      suitability: 'medium',
      message: 'Heatmap to visualize correlation matrix between multiple numeric variables',
      suggested: {
        columns: numericColumns.slice(0, 5) // Limit to first 5 numeric columns
      }
    });
  }
  
  return recommendations;
};

module.exports = {
  analyzeData
};