document.addEventListener('DOMContentLoaded', function() {
  // State management
  const state = {
    currentChatId: null,
    data: [],
    chartInstances: {},
    selectedChartType: null,
    selectedChartId: null,
    columns: []
  };
  
  // Available chart types with configurations
  const chartTypes = {
    bar: { type: 'bar', requiresNumericY: true },
    line: { type: 'line', requiresNumericY: true },
    pie: { type: 'pie', requiresNumericY: true },
    doughnut: { type: 'doughnut', requiresNumericY: true },
    radar: { type: 'radar', requiresNumericY: true },
    polarArea: { type: 'polarArea', requiresNumericY: true },
    scatter: { type: 'scatter', requiresNumericX: true, requiresNumericY: true },
    bubble: { type: 'bubble', requiresNumericX: true, requiresNumericY: true, requiresNumericZ: true },
    area: { 
      type: 'line', 
      requiresNumericY: true,
      customOptions: { fill: true }
    },
    histogram: { 
      type: 'bar', 
      requiresNumericX: true,
      customOptions: { 
        barPercentage: 1.0,
        categoryPercentage: 1.0
      }
    },
    boxplot: { type: 'boxplot', requiresNumericY: true, plugin: 'chartjs-chart-box-and-violin-plot' },
    violin: { type: 'violin', requiresNumericY: true, plugin: 'chartjs-chart-box-and-violin-plot' },
    heatmap: { type: 'heatmap', requiresNumericZ: true, plugin: 'chartjs-chart-matrix' }
  };
  
  // DOM elements
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const generateDashboardBtn = document.getElementById('generateDashboardBtn');
  const saveDashboardBtn = document.getElementById('saveDashboardBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const chartContainer = document.getElementById('chartContainer');
  const dataTable = document.getElementById('dataTable');
  const configPanel = document.getElementById('chartConfigPanel');
  
  // Chart type selection
  const chartTypeElements = document.querySelectorAll('.chart-type');
  chartTypeElements.forEach(element => {
    element.addEventListener('click', () => {
      const type = element.dataset.type;
      state.selectedChartType = type;
      
      // Highlight selected chart type
      chartTypeElements.forEach(el => el.classList.remove('selected'));
      element.classList.add('selected');
      
      // Show configuration panel
      openConfigPanel(type);
    });
  });
  
  // Handle file upload
  uploadBtn.addEventListener('click', async () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      showNotification('Please select a file to upload', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('dataFile', file);
    
    try {
      const response = await fetch('/api/data/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        state.currentChatId = result.chatId;
        state.data = result.data;
        
        // Extract column names
        if (state.data.length > 0) {
          state.columns = Object.keys(state.data[0]);
        }
        
        // Display data preview
        renderDataPreview(state.data);
        
        showNotification('Data uploaded successfully', 'success');
      } else {
        showNotification(result.message || 'Failed to upload data', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('An error occurred during upload', 'error');
    }
  });
  
  // Create a new chat/visualization session
  newChatBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/chats/new', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        state.currentChatId = result.chatId;
        state.data = [];
        state.chartInstances = {};
        
        // Clear UI
        renderDataPreview([]);
        chartContainer.innerHTML = '';
        
        // Add to chat history in UI
        const chatList = document.getElementById('chatHistory');
        const newChatItem = document.createElement('li');
        newChatItem.className = 'chat-item';
        newChatItem.dataset.id = result.chatId;
        newChatItem.innerHTML = `
          <span>${result.title}</span>
          <small>${new Date().toLocaleDateString()}</small>
        `;
        chatList.prepend(newChatItem);
        
        showNotification('New visualization created', 'success');
      } else {
        showNotification(result.message || 'Failed to create new visualization', 'error');
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      showNotification('An error occurred', 'error');
    }
  });
  
  // Load chat data when clicking on chat history item
  document.getElementById('chatHistory').addEventListener('click', async (e) => {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem) {
      const chatId = chatItem.dataset.id;
      
      try {
        const response = await fetch(`/api/chats/${chatId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const result = await response.json();
        
        if (response.ok) {
          state.currentChatId = chatId;
          state.data = result.data;
          
          // Extract column names
          if (state.data.length > 0) {
            state.columns = Object.keys(state.data[0]);
          }
          
          // Display data preview
          renderDataPreview(state.data);
          
          // Render saved charts if any
          if (result.chartConfigs && result.chartConfigs.length > 0) {
            renderSavedCharts(result.chartConfigs);
          } else {
            chartContainer.innerHTML = '';
          }
          
          // Highlight selected chat
          document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
          });
          chatItem.classList.add('active');
          
          showNotification('Visualization loaded', 'success');
        } else {
          showNotification(result.message || 'Failed to load visualization', 'error');
        }
      } catch (error) {
        console.error('Error loading chat:', error);
        showNotification('An error occurred', 'error');
      }
    }
  });
  
  // Generate dashboard with multiple charts
  generateDashboardBtn.addEventListener('click', () => {
    if (!state.data || state.data.length === 0) {
      showNotification('Please upload data first', 'error');
      return;
    }
    
    // Clear existing charts
    chartContainer.innerHTML = '';
    state.chartInstances = {};
    
    // Generate recommended charts based on data
    const recommendedCharts = recommendCharts(state.data);
    
    recommendedCharts.forEach(config => {
      createChart(config);
    });
    
    showNotification('Dashboard generated', 'success');
  });
  
  // Save dashboard configuration
  saveDashboardBtn.addEventListener('click', async () => {
    if (!state.currentChatId) {
      showNotification('No active visualization to save', 'error');
      return;
    }
    
    // Collect all chart configurations
    const chartConfigs = [];
    for (const id in state.chartInstances) {
      const instance = state.chartInstances[id];
      chartConfigs.push({
        id,
        type: instance.config.type,
        data: instance.config.data,
        options: instance.config.options,
        title: instance.config.options.plugins.title.text
      });
    }
    
    try {
      const response = await fetch(`/api/chats/${state.currentChatId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chartConfigs,
          data: state.data
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showNotification('Visualization saved successfully', 'success');
      } else {
        showNotification(result.message || 'Failed to save visualization', 'error');
      }
    } catch (error) {
      console.error('Error saving dashboard:', error);
      showNotification('An error occurred', 'error');
    }
  });
  
  // Logout functionality
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  });
  
  // Configure panel close button
  document.querySelector('.chart-config-panel .close-btn').addEventListener('click', () => {
    configPanel.classList.remove('open');
  });
  
  // Apply chart configuration
  document.getElementById('applyConfigBtn').addEventListener('click', () => {
    if (!state.selectedChartType || !state.data || state.data.length === 0) {
      showNotification('Please select a chart type and upload data', 'error');
      return;
    }
    
    const chartTitle = document.getElementById('chartTitle').value;
    const xAxis = document.getElementById('xAxisSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const chartHeight = document.getElementById('chartHeight').value;
    const showLegend = document.getElementById('showLegend').checked;
    const showGrid = document.getElementById('showGrid').checked;
    
    // Create chart configuration
    const config = {
      type: state.selectedChartType,
      x: xAxis,
      y: yAxis,
      title: chartTitle,
      height: parseInt(chartHeight),
      showLegend,
      showGrid
    };
    
    createChart(config);
    configPanel.classList.remove('open');
  });
  
  // Render data preview table
  function renderDataPreview(data) {
    if (!data || data.length === 0) {
      dataTable.innerHTML = '<p>No data available</p>';
      return;
    }
    
    const columns = Object.keys(data[0]);
    const previewData = data.slice(0, 5); // Show first 5 rows
    
    let tableHtml = '<table><thead><tr>';
    columns.forEach(col => {
      tableHtml += `<th>${col}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    previewData.forEach(row => {
      tableHtml += '<tr>';
      columns.forEach(col => {
        tableHtml += `<td>${row[col]}</td>`;
      });
      tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table>';
    tableHtml += `<p><small>Showing 5 of ${data.length} rows</small></p>`;
    
    dataTable.innerHTML = tableHtml;
    
    // Update column selectors in config panel
    updateColumnSelectors(columns);
  }
  
  // Update column selectors in config panel
  function updateColumnSelectors(columns) {
    const xAxisSelect = document.getElementById('xAxisSelect');
    const yAxisSelect = document.getElementById('yAxisSelect');
    
    xAxisSelect.innerHTML = '';
    yAxisSelect.innerHTML = '';
    
    columns.forEach(col => {
      xAxisSelect.innerHTML += `<option value="${col}">${col}</option>`;
      yAxisSelect.innerHTML += `<option value="${col}">${col}</option>`;
    });
  }
  
  // Open configuration panel for a chart type
  function openConfigPanel(chartType) {
    if (!state.data || state.data.length === 0) {
      showNotification('Please upload data first', 'error');
      return;
    }
    
    const chartInfo = chartTypes[chartType] || { type: chartType };
    
    // Set default values
    document.getElementById('chartTitle').value = `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`;
    document.getElementById('chartHeight').value = 400;
    document.getElementById('heightValue').textContent = '400px';
    document.getElementById('showLegend').checked = true;
    document.getElementById('showGrid').checked = true;
    
    // Show/hide specific options based on chart type
    const gridOption = document.querySelector('.form-group:has(#showGrid)');
    if (chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea') {
      gridOption.style.display = 'none';
    } else {
      gridOption.style.display = 'flex';
    }
    
    // Open panel
    configPanel.classList.add('open');
    
    // Update height display when slider changes
    document.getElementById('chartHeight').addEventListener('input', function() {
      document.getElementById('heightValue').textContent = this.value + 'px';
    });
  }
  
  // Create and render a chart
  function createChart(config) {
    const chartId = 'chart_' + Date.now();
    
    // Create chart container
    const chartBox = document.createElement('div');
    chartBox.className = 'chart-box';
    chartBox.id = chartId + '_container';
    
    // Create chart header
    const chartHeader = document.createElement('div');
    chartHeader.className = 'chart-box-header';
    chartHeader.innerHTML = `
      <h3>${config.title || 'Chart'}</h3>
      <div class="chart-box-actions">
        <button class="edit-chart" title="Edit"><i>✏️</i></button>
        <button class="delete-chart" title="Delete"><i>🗑️</i></button>
      </div>
    `;
    
    // Create chart canvas
    const chartBody = document.createElement('div');
    chartBody.className = 'chart-box-body';
    const canvas = document.createElement('canvas');
    canvas.id = chartId;
    chartBody.appendChild(canvas);
    
    // Assemble chart box
    chartBox.appendChild(chartHeader);
    chartBox.appendChild(chartBody);
    chartContainer.appendChild(chartBox);
    
    // Get chart type configuration
    const chartTypeConfig = chartTypes[config.type] || { type: config.type };
    
    // Prepare data for the chart
    const chartData = prepareChartData(state.data, config, chartTypeConfig);
    
    // Create chart options
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: config.title || 'Chart',
          font: {
            size: 16
          }
        },
        legend: {
          display: config.showLegend !== false
        }
      },
      scales: {}
    };
    
    // Add scales for cartesian charts
    if (!['pie', 'doughnut', 'polarArea', 'radar'].includes(config.type)) {
      chartOptions.scales = {
        x: {
          grid: {
            display: config.showGrid !== false
          }
        },
        y: {
          grid: {
            display: config.showGrid !== false
          },
          beginAtZero: true
        }
      };
    }
    
    // Apply custom options if any
    if (chartTypeConfig.customOptions) {
      Object.assign(chartOptions, chartTypeConfig.customOptions);
    }
    
    // Set chart height
    chartBody.style.height = (config.height || 400) + 'px';
    
    // Create the chart
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: chartTypeConfig.type,
      data: chartData,
      options: chartOptions
    });
    
    // Store chart instance
    state.chartInstances[chartId] = chart;
    
    // Add event listeners for chart actions
    chartBox.querySelector('.edit-chart').addEventListener('click', () => {
      state.selectedChartId = chartId;
      openEditPanel(chartId);
    });
    
    chartBox.querySelector('.delete-chart').addEventListener('click', () => {
      deleteChart(chartId);
    });
    
    return chartId;
  }
  
  // Prepare chart data based on configuration
  function prepareChartData(data, config, chartTypeConfig) {
    if (!data || data.length === 0) return { labels: [], datasets: [] };
    
    // Get x and y values
    const xValues = data.map(item => item[config.x]);
    const yValues = data.map(item => {
      const value = item[config.y];
      return isNaN(value) ? 0 : Number(value);
    });
    
    // Prepare chart data structure
    const chartData = {
      labels: xValues,
      datasets: []
    };
    
    // Create dataset based on chart type
    if (config.type === 'pie' || config.type === 'doughnut' || config.type === 'polarArea') {
      // Generate colors
      const backgroundColors = generateColors(xValues.length);
      
      chartData.datasets.push({
        data: yValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
        borderWidth: 1
      });
    } else if (config.type === 'scatter' || config.type === 'bubble') {
      // For scatter/bubble charts, create point data
      const pointData = data.map(item => ({
        x: Number(item[config.x]),
        y: Number(item[config.y])
      }));
      
      chartData.datasets.push({
        label: config.y,
        data: pointData,
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      });
      
      // Remove labels for scatter/bubble
      delete chartData.labels;
    } else {
      // For other charts (bar, line, etc.)
      chartData.datasets.push({
        label: config.y,
        data: yValues,
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        fill: config.type === 'area' // For area charts
      });
    }
    
    return chartData;
  }
  
  // Delete a chart
  function deleteChart(chartId) {
    const chart = state.chartInstances[chartId];
    if (chart) {
      chart.destroy();
      delete state.chartInstances[chartId];
      
      const chartContainer = document.getElementById(chartId + '_container');
      if (chartContainer) {
        chartContainer.remove();
      }
    }
  }
  
  // Open edit panel for existing chart
  function openEditPanel(chartId) {
    const chart = state.chartInstances[chartId];
    if (!chart) return;
    
    state.selectedChartType = chart.config.type;
    
    // Set current values in form
    document.getElementById('chartTitle').value = chart.options.plugins.title.text;
    document.getElementById('chartHeight').value = chart.canvas.parentNode.style.height.replace('px', '');
    document.getElementById('heightValue').textContent = chart.canvas.parentNode.style.height;
    document.getElementById('showLegend').checked = chart.options.plugins.legend.display;
    
    // Set grid display if applicable
    if (chart.options.scales && chart.options.scales.y) {
      document.getElementById('showGrid').checked = chart.options.scales.y.grid.display;
    }
    
    // Open panel
    configPanel.classList.add('open');
    
    // Update apply button for editing
    const applyBtn = document.getElementById('applyConfigBtn');
    applyBtn.textContent = 'Update Chart';
    
    // Update handler for the apply button
    applyBtn.onclick = () => {
      updateChart(chartId);
      configPanel.classList.remove('open');
      
      // Reset to default handler
      applyBtn.textContent = 'Apply';
      applyBtn.onclick = document.getElementById('applyConfigBtn').onclick;
    };
  }
  
  // Update an existing chart
  function updateChart(chartId) {
    const chart = state.chartInstances[chartId];
    if (!chart) return;
    
    const chartTitle = document.getElementById('chartTitle').value;
    const chartHeight = document.getElementById('chartHeight').value;
    const showLegend = document.getElementById('showLegend').checked;
    const showGrid = document.getElementById('showGrid').checked;
    
    // Update chart title
    chart.options.plugins.title.text = chartTitle;
    
    // Update legend display
    chart.options.plugins.legend.display = showLegend;
    
    // Update grid display if applicable
    if (chart.options.scales && chart.options.scales.y) {
      chart.options.scales.x.grid.display = showGrid;
      chart.options.scales.y.grid.display = showGrid;
    }
    
    // Update chart height
    chart.canvas.parentNode.style.height = chartHeight + 'px';
    
    // Update chart header title
    const chartContainer = document.getElementById(chartId + '_container');
    if (chartContainer) {
      const header = chartContainer.querySelector('.chart-box-header h3');
      if (header) {
        header.textContent = chartTitle;
      }
    }
    
    // Update chart
    chart.update();
  }
  
  // Render saved charts from database
  function renderSavedCharts(chartConfigs) {
    // Clear existing charts
    chartContainer.innerHTML = '';
    state.chartInstances = {};
    
    chartConfigs.forEach(config => {
      createChart({
        type: config.type,
        x: config.x,
        y: config.y,
        title: config.title,
        height: config.height,
        showLegend: config.showLegend,
        showGrid: config.showGrid
      });
    });
  }
  
  // Recommend charts based on data
  function recommendCharts(data) {
    if (!data || data.length === 0) return [];
    
    const columns = Object.keys(data[0]);
    const numericColumns = [];
    const categoricalColumns = [];
    
    // Identify column types
    columns.forEach(col => {
      // Check if column has numeric values
      const hasNumericValues = data.some(row => !isNaN(row[col]));
      const uniqueValues = new Set(data.map(row => row[col])).size;
      
      if (hasNumericValues && uniqueValues > 5) {
        numericColumns.push(col);
      } else {
        categoricalColumns.push(col);
      }
    });
    
    const recommendedCharts = [];
    
    // If we have both categorical and numeric columns
    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      // Bar chart for first categorical and numeric column
      recommendedCharts.push({
        type: 'bar',
        x: categoricalColumns[0],
        y: numericColumns[0],
        title: `${numericColumns[0]} by ${categoricalColumns[0]}`,
        height: 400,
        showLegend: true,
        showGrid: true
      });
      
      // Pie chart
      recommendedCharts.push({
        type: 'pie',
        x: categoricalColumns[0],
        y: numericColumns[0],
        title: `Distribution of ${numericColumns[0]}`,
        height: 400,
        showLegend: true
      });
      
      // Line chart if we have date-like or sequential data
      const dateColumn = columns.find(col => {
        const sample = data[0][col];
        return typeof sample === 'string' && (
          sample.includes('-') || sample.includes('/') || !isNaN(new Date(sample).getTime())
        );
      });
      
      if (dateColumn) {
        recommendedCharts.push({
          type: 'line',
          x: dateColumn,
          y: numericColumns[0],
          title: `${numericColumns[0]} over Time`,
          height: 400,
          showLegend: true,
          showGrid: true
        });
      }
    }
    
    // If we have multiple numeric columns, add a scatter plot
    if (numericColumns.length >= 2) {
      recommendedCharts.push({
        type: 'scatter',
        x: numericColumns[0],
        y: numericColumns[1],
        title: `${numericColumns[1]} vs ${numericColumns[0]}`,
        height: 400,
        showLegend: true,
        showGrid: true
      });
    }
    
    // Add a histogram for numeric data
    if (numericColumns.length > 0) {
      recommendedCharts.push({
        type: 'histogram',
        x: numericColumns[0],
        y: numericColumns[0],
        title: `Distribution of ${numericColumns[0]}`,
        height: 400,
        showLegend: true,
        showGrid: true
      });
    }
    
    return recommendedCharts;
  }
  
  // Generate colors for charts
  function generateColors(count) {
    const colors = [];
    const baseHues = [0, 60, 120, 180, 240, 300]; // Red, yellow, green, cyan, blue, magenta
    
    for (let i = 0; i < count; i++) {
      const hue = baseHues[i % baseHues.length];
      const lightness = 50 + (i % 3) * 10; // Vary lightness
      colors.push(`hsla(${hue}, 70%, ${lightness}%, 0.7)`);
    }
    
    return colors;
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'notification';
      document.body.appendChild(notification);
    }
    
    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
});