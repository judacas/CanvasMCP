document.addEventListener('DOMContentLoaded', async () => {
  const canvasUrlInput = document.getElementById('canvasUrl');
  const fetchBtn = document.getElementById('fetchBtn');
  const diagnoseBtn = document.getElementById('diagnoseBtn');
  const resultDiv = document.getElementById('result');

  // Try to auto-detect Canvas URL from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url) {
      const url = new URL(tab.url);
      // Check if it's a Canvas instance (but not GraphiQL page)
      if ((url.hostname.includes('instructure.com') || url.hostname.includes('canvas')) && 
          !url.pathname.includes('graphiql')) {
        canvasUrlInput.value = `${url.protocol}//${url.hostname}`;
      }
    }
  } catch (error) {
    console.error('Error detecting Canvas URL:', error);
  }

  diagnoseBtn.addEventListener('click', async () => {
    diagnoseBtn.disabled = true;
    showResult('Running CSRF token diagnostic...', false, true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'diagnoseCSRF'
      });
      
      if (response && response.success) {
        const findings = response.findings;
        let output = '=== CSRF Token Diagnostic Results ===\n\n';
        
        if (findings.foundToken) {
          output += `✅ CSRF Token Found!\n`;
          output += `Method: ${findings.method}\n`;
          output += `Token (first 30 chars): ${findings.foundToken.substring(0, 30)}...\n\n`;
        } else {
          output += `❌ CSRF Token NOT Found\n\n`;
        }
        
        output += `Meta Tags Checked: ${findings.metaTags.length}\n`;
        if (findings.metaTags.length > 0) {
          output += `  Relevant meta tags:\n`;
          findings.metaTags.forEach(tag => {
            if (tag.name && (tag.name.toLowerCase().includes('csrf') || tag.name.toLowerCase().includes('token'))) {
              output += `    - ${tag.name}\n`;
            }
          });
        }
        
        output += `\nCookies Checked: ${findings.cookies.length}\n`;
        if (findings.cookies.length > 0) {
          output += `  Relevant cookies:\n`;
          findings.cookies.forEach(cookie => {
            if (cookie.name && (cookie.name.toLowerCase().includes('csrf') || cookie.name.toLowerCase().includes('token'))) {
              output += `    - ${cookie.name}\n`;
            }
          });
        }
        
        if (findings.windowObjects.ENV) {
          output += `\nwindow.ENV object found with keys:\n`;
          output += `  ${findings.windowObjects.ENV.join(', ')}\n`;
        }
        
        if (findings.ajaxSetup) {
          output += `\njQuery ajaxSetup found\n`;
        }
        
        output += `\n=== End Diagnostic ===\n\n`;
        output += `💡 Tip: Open browser DevTools (F12) → Network tab → Filter by "graphql" → Make a request → Check Request Headers to see what Canvas sends.`;
        
        showResult(output, !findings.foundToken);
      } else {
        showResult(`Error: ${response?.error || 'Unknown error'}`, true);
      }
    } catch (error) {
      showResult(`Error: ${error.message}`, true);
    } finally {
      diagnoseBtn.disabled = false;
    }
  });

  fetchBtn.addEventListener('click', async () => {
    const canvasUrl = canvasUrlInput.value.trim();
    
    if (!canvasUrl) {
      // Try to get from current tab
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url) {
          const url = new URL(tab.url);
          const baseUrl = `${url.protocol}//${url.hostname}`;
          await makeGraphQLRequest(baseUrl);
        } else {
          showResult('Error: Please enter a Canvas instance URL', true);
        }
      } catch (error) {
        showResult('Error: Could not detect Canvas URL. Please enter it manually.', true);
      }
    } else {
      await makeGraphQLRequest(canvasUrl);
    }
  });

  async function makeGraphQLRequest(baseUrl) {
    fetchBtn.disabled = true;
    showResult('Loading...', false, true);

    // Construct GraphQL endpoint URL
    const graphqlUrl = `${baseUrl}/api/graphql`;

    // Use the query that works in GraphiQL
    const query = `query MyQuery {
      allCourses {
        name
      }
    }`;

    try {
      showResult('Making request...', false, true);
      
      // Use background script to make the request (better cookie handling)
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: 'fetchGraphQL',
          url: graphqlUrl,
          query: query.trim()
        });
      } catch (error) {
        showResult(`Error sending message to background script: ${error.message}\n\nMake sure the extension is properly installed and reloaded.`, true);
        fetchBtn.disabled = false;
        return;
      }

      // Check if we got a response
      if (!response) {
        showResult('Error: No response from extension. This might mean:\n1. You are not on a Canvas page\n2. The extension service worker is not running\n3. Try reloading the extension in chrome://extensions/', true);
        fetchBtn.disabled = false;
        return;
      }

      if (response.success) {
        // Check if we got an error in the GraphQL response
        if (response.data && response.data.errors) {
          showResult(`GraphQL Error:\n\n${JSON.stringify(response.data, null, 2)}`, true);
        } else {
          // Success!
          showResult(JSON.stringify(response.data, null, 2), false);
        }
      } else {
        // Request failed
        const errorMsg = response.error || 'Unknown error';
        const statusInfo = response.status ? `\nStatus: ${response.status} ${response.statusText || ''}` : '';
        showResult(`Error: ${errorMsg}${statusInfo}\n\nResponse: ${JSON.stringify(response, null, 2)}`, true);
      }
    } catch (error) {
      showResult(`Error: ${error.message}\n\nMake sure you are on a Canvas page (e.g., https://usflearn.instructure.com) and logged in.`, true);
    } finally {
      fetchBtn.disabled = false;
    }
  }

  function showResult(message, isError = false, isLoading = false) {
    resultDiv.textContent = message;
    resultDiv.className = isLoading ? 'loading' : (isError ? 'error' : 'success');
  }
});

