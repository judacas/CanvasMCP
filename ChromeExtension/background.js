// Background script to inject content script and handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'interceptGraphQL') {
    // Inject interceptor to monitor Canvas's GraphQL requests
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        // Read the interceptor script
        const response = await fetch(chrome.runtime.getURL('intercept-canvas-graphql.js'));
        const scriptContent = await response.text();
        
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: new Function(scriptContent)
        });

        sendResponse({ success: true, message: 'Interceptor injected. Check console for Canvas GraphQL requests.' });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'diagnoseCSRF') {
    // Diagnostic action to find CSRF token
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: diagnoseCSRFToken
        });

        if (results && results[0]) {
          sendResponse({ success: true, findings: results[0].result });
        } else {
          sendResponse({ success: false, error: 'No diagnostic results' });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'fetchGraphQL') {
    // Handle async response properly
    (async () => {
      try {
        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        // Check if we're on a Canvas page (but not GraphiQL page - we need the actual Canvas page for cookies)
        const tabUrl = tabs[0].url;
        if (!tabUrl || (!tabUrl.includes('instructure.com') && !tabUrl.includes('canvas'))) {
          sendResponse({ 
            success: false, 
            error: 'Please navigate to a Canvas LMS page first (e.g., https://usflearn.instructure.com). Do not use the GraphiQL page.',
            data: null
          });
          return;
        }
        
        if (tabUrl.includes('graphiql')) {
          sendResponse({ 
            success: false, 
            error: 'Please navigate to the main Canvas page (e.g., https://usflearn.instructure.com), not the GraphiQL page. The extension needs to access cookies from the main Canvas page.',
            data: null
          });
          return;
        }

        // Inject script into MAIN world to access page's cookies and fetch
        let results;
        try {
          results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            world: 'MAIN', // Inject into main world to access page context and cookies
            func: makeGraphQLRequest,
            args: [request.url, request.query]
          });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: `Failed to execute script: ${error.message || 'Unknown error'}. Make sure you are on a Canvas page and the extension has proper permissions.`,
            data: null
          });
          return;
        }

        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message,
            data: null
          });
          return;
        }

        if (!results || !results[0]) {
          sendResponse({ 
            success: false, 
            error: 'No response from content script',
            data: null
          });
          return;
        }

        // The result might be a promise, so we need to handle it
        const result = results[0].result;
        
        if (result && typeof result.then === 'function') {
          // It's a promise, wait for it
          try {
            const resolvedResult = await result;
            sendResponse(resolvedResult);
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error.message || 'Promise rejection',
              data: null
            });
          }
        } else {
          // It's already resolved
          sendResponse(result || { 
            success: false, 
            error: 'Empty response',
            data: null
          });
        }
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error',
          data: null
        });
      }
    })();
    
    return true; // Keep the message channel open for async response
  }
});

// Comprehensive CSRF token finder - checks multiple sources
function findCSRFToken() {
  const methods = [
    // Method 1: Standard meta tag
    () => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute('content') : null;
    },
    // Method 2: Alternative meta tag name
    () => {
      const meta = document.querySelector('meta[name="csrf_token"]');
      return meta ? meta.getAttribute('content') : null;
    },
    // Method 3: window.ENV.CSRF_TOKEN (Canvas often uses this)
    () => {
      if (window.ENV && window.ENV.CSRF_TOKEN) {
        return window.ENV.CSRF_TOKEN;
      }
      return null;
    },
    // Method 4: window.ENV.csrf_token (lowercase variant)
    () => {
      if (window.ENV && window.ENV.csrf_token) {
        return window.ENV.csrf_token;
      }
      return null;
    },
    // Method 5: jQuery ajaxSetup headers (Canvas uses jQuery)
    () => {
      if (window.$ && window.$.ajaxSetup) {
        try {
          const settings = window.$.ajaxSetup();
          if (settings && settings.headers && settings.headers['X-CSRF-Token']) {
            return settings.headers['X-CSRF-Token'];
          }
        } catch (e) {
          // ajaxSetup might not return settings, try to get default settings
        }
      }
      // Also check if jQuery has a global CSRF token set
      if (window.$ && window.$.ajaxSettings && window.$.ajaxSettings.headers) {
        const token = window.$.ajaxSettings.headers['X-CSRF-Token'];
        if (token) return token;
      }
      return null;
    },
    // Method 6: Check cookies (though less common for CSRF in Canvas)
    () => {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === '_csrf_token' || name === 'csrf_token' || name === 'csrf-token') {
          return decodeURIComponent(value);
        }
      }
      return null;
    },
    // Method 7: Data attributes on body or html
    () => {
      const body = document.body;
      const html = document.documentElement;
      for (let el of [body, html]) {
        if (el) {
          const token = el.getAttribute('data-csrf-token') || 
                       el.getAttribute('data-csrf_token') ||
                       el.getAttribute('csrf-token');
          if (token) return token;
        }
      }
      return null;
    },
    // Method 8: Check if Canvas exposes it via a global function
    () => {
      if (window.getCSRFToken && typeof window.getCSRFToken === 'function') {
        try {
          return window.getCSRFToken();
        } catch (e) {}
      }
      return null;
    },
    // Method 9: Look for it in the page source (last resort)
    () => {
      // This is a fallback - try to extract from script tags
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        const content = script.textContent || script.innerHTML;
        // Look for common patterns like: CSRF_TOKEN: "value" or csrf_token: "value"
        const patterns = [
          /CSRF_TOKEN["\s:=]+["']([^"']+)["']/i,
          /csrf_token["\s:=]+["']([^"']+)["']/i,
          /X-CSRF-Token["\s:]+["']([^"']+)["']/i
        ];
        for (let pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1] && match[1].length > 10) {
            return match[1];
          }
        }
      }
      return null;
    }
  ];

  // Try each method in order
  for (let i = 0; i < methods.length; i++) {
    try {
      let token = methods[i]();
      if (token && token.length > 10) { // Basic validation - CSRF tokens are usually longer
        // Decode URL-encoded tokens (Canvas sometimes stores them encoded)
        // Check if it's URL encoded (contains %)
        if (token.includes('%')) {
          try {
            const decoded = decodeURIComponent(token);
            // Only use decoded if it looks valid (not just random characters)
            if (decoded.length > 10 && /^[a-zA-Z0-9+/=_-]+$/.test(decoded)) {
              token = decoded;
              console.log(`Found and decoded CSRF token using method ${i + 1}`);
            } else {
              console.log(`Found CSRF token using method ${i + 1} (keeping encoded)`);
            }
          } catch (e) {
            // If decoding fails, use original
            console.log(`Found CSRF token using method ${i + 1} (decode failed, using as-is)`);
          }
        } else {
          console.log(`Found CSRF token using method ${i + 1}`);
        }
        return token;
      }
    } catch (e) {
      console.debug(`CSRF token method ${i + 1} failed:`, e);
    }
  }

  console.warn('Could not find CSRF token using any method');
  return null;
}

// Diagnostic function to find CSRF token
function diagnoseCSRFToken() {
  const findings = {
    metaTags: [],
    cookies: [],
    windowObjects: {},
    dataAttributes: [],
    ajaxSetup: null,
    foundToken: null,
    method: null
  };
  
  // Check all meta tags
  const allMetaTags = document.querySelectorAll('meta');
  allMetaTags.forEach(meta => {
    const name = meta.getAttribute('name');
    const content = meta.getAttribute('content');
    findings.metaTags.push({ name, hasContent: !!content });
    
    if (name && (name.toLowerCase().includes('csrf') || name.toLowerCase().includes('token'))) {
      findings.foundToken = content;
      findings.method = `meta tag: ${name}`;
    }
  });
  
  // Check cookies
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    findings.cookies.push({ name, hasValue: !!value });
    
    if (name && (name.toLowerCase().includes('csrf') || name.toLowerCase().includes('token'))) {
      findings.foundToken = decodeURIComponent(value);
      findings.method = `cookie: ${name}`;
    }
  });
  
  // Check window.ENV
  if (window.ENV) {
    findings.windowObjects.ENV = Object.keys(window.ENV);
    if (window.ENV.CSRF_TOKEN) {
      findings.foundToken = window.ENV.CSRF_TOKEN;
      findings.method = 'window.ENV.CSRF_TOKEN';
    } else if (window.ENV.csrf_token) {
      findings.foundToken = window.ENV.csrf_token;
      findings.method = 'window.ENV.csrf_token';
    }
  }
  
  // Check jQuery ajaxSetup
  if (window.$ && window.$.ajaxSettings) {
    if (window.$.ajaxSettings.headers && window.$.ajaxSettings.headers['X-CSRF-Token']) {
      findings.foundToken = window.$.ajaxSettings.headers['X-CSRF-Token'];
      findings.method = 'jQuery ajaxSettings.headers';
      findings.ajaxSetup = true;
    }
  }
  
  // Use the comprehensive finder
  const token = findCSRFToken();
  if (token && !findings.foundToken) {
    findings.foundToken = token;
    findings.method = 'comprehensive finder';
  }
  
  return findings;
}

// Function to be injected into the page context (has access to cookies)
function makeGraphQLRequest(url, query) {
  console.log('Making GraphQL request to:', url);
  console.log('Query:', query);
  
  // Use comprehensive CSRF token finder
  let csrfToken = findCSRFToken();
  
  if (csrfToken) {
    // Ensure token is properly decoded (Canvas sometimes provides URL-encoded tokens)
    if (csrfToken.includes('%')) {
      try {
        csrfToken = decodeURIComponent(csrfToken);
        console.log('Decoded CSRF token');
      } catch (e) {
        console.warn('Could not decode CSRF token, using as-is');
      }
    }
    console.log('Found CSRF token:', csrfToken.substring(0, 20) + '...');
  } else {
    console.warn('⚠️ No CSRF token found - request may fail');
    console.log('Available meta tags:', Array.from(document.querySelectorAll('meta')).map(m => ({
      name: m.getAttribute('name'),
      hasContent: !!m.getAttribute('content')
    })));
    if (window.ENV) {
      console.log('window.ENV keys:', Object.keys(window.ENV));
    }
  }

  // Build headers similar to what Canvas expects
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest', // Canvas often expects this
    'Origin': window.location.origin,
    'Referer': window.location.href,
  };

  // Add CSRF token if available (Canvas requires this for POST requests)
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  } else {
    console.warn('⚠️ Making request without CSRF token - this may fail with 403 Forbidden');
  }

  // Return the promise directly - executeScript will handle it
  console.log('Sending POST request with headers:', headers);
  return fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ query }),
    credentials: 'include', // This will use the page's cookies
  })
    .then(async response => {
      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Read response as text first (can only read once)
      const text = await response.text();
      console.log('Response text (first 500 chars):', text.substring(0, 500));
      
      // Log request details for debugging
      console.log('Request URL:', url);
      console.log('Request query:', query);
      console.log('Request headers:', headers);
      console.log('Request body:', JSON.stringify({ query }));
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // If JSON parsing fails, return the text
        console.error('Failed to parse JSON:', e);
        return {
          success: false,
          error: `Failed to parse JSON. Status: ${response.status} ${response.statusText}. Response: ${text.substring(0, 500)}`,
          data: null,
          status: response.status,
          statusText: response.statusText,
          rawResponse: text.substring(0, 1000)
        };
      }
      
      // Log GraphQL errors if present
      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
      }

      // Return both the response status and data
      console.log('Parsed response data:', data);
      return { 
        success: response.ok, 
        data: data,
        status: response.status,
        statusText: response.statusText
      };
    })
    .catch(error => {
      console.error('Fetch error:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        data: null
      };
    });
}

