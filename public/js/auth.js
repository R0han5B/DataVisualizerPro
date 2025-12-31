document.addEventListener('DOMContentLoaded', function() {
  // Login form handling
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Store token and redirect
          localStorage.setItem('token', data.token);
          window.location.href = '/dashboard';
        } else {
          // Show error message
          showError(data.message || 'Login failed');
        }
      } catch (error) {
        showError('An error occurred. Please try again.');
        console.error(error);
      }
    });
  }
  
  // Register form handling
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Validate passwords match
      if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Registration successful, redirect to login
          window.location.href = '/login?registered=true';
        } else {
          // Show error message
          showError(data.message || 'Registration failed');
        }
      } catch (error) {
        showError('An error occurred. Please try again.');
        console.error(error);
      }
    });
  }
  
  // Helper to show error messages
  function showError(message) {
    let errorElement = document.querySelector('.error-message');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      const formElement = document.querySelector('form');
      formElement.parentNode.insertBefore(errorElement, formElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
  
  // Check for registration success message
  if (window.location.search.includes('registered=true')) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.textContent = 'Registration successful! Please log in.';
    successMsg.style.color = 'green';
    successMsg.style.marginBottom = '1rem';
    
    const formElement = document.querySelector('form');
    formElement.parentNode.insertBefore(successMsg, formElement);
  }
});