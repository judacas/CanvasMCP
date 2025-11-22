// Diagnostic script to find CSRF token on Canvas pages
// This should be injected into the page context (MAIN world) to access all page data

(function() {
  console.log('=== CSRF Token Diagnostic Tool ===');
  
  const findings = {
    metaTags: [],
    cookies: [],
    windowObjects: [],
    dataAttributes: [],
    ajaxSetup: null,
    networkRequests: []
  };
  
  // 1. Check all meta tags
  console.log('\n1. Checking meta tags...');
  const allMetaTags = document.querySelectorAll('meta');
  allMetaTags.forEach(meta => {
    const name = meta.getAttribute('name');
    const content = meta.getAttribute('content');
    findings.metaTags.push({ name, content: content ? content.substring(0, 50) + '...' : null });
    
    if (name && (name.toLowerCase().includes('csrf') || name.toLowerCase().includes('token'))) {
      console.log(`  ✓ Found meta tag: name="${name}", content="${content ? content.substring(0, 50) + '...' : 'null'}"`);
    }
  });
  
  // 2. Check cookies
  console.log('\n2. Checking cookies...');
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    findings.cookies.push({ name, value: value ? value.substring(0, 50) + '...' : null });
    
    if (name && (name.toLowerCase().includes('csrf') || name.toLowerCase().includes('token'))) {
      console.log(`  ✓ Found cookie: ${name}=${value ? value.substring(0, 50) + '...' : 'null'}`);
    }
  });
  
  // 3. Check window objects (Canvas often uses window.ENV)
  console.log('\n3. Checking window objects...');
  if (window.ENV) {
    console.log('  ✓ Found window.ENV object');
    findings.windowObjects.push('ENV');
    
    if (window.ENV.CSRF_TOKEN) {
      console.log(`  ✓ Found window.ENV.CSRF_TOKEN: ${window.ENV.CSRF_TOKEN.substring(0, 50)}...`);
    }
    if (window.ENV.csrf_token) {
      console.log(`  ✓ Found window.ENV.csrf_token: ${window.ENV.csrf_token.substring(0, 50)}...`);
    }
    if (window.ENV._csrf_token) {
      console.log(`  ✓ Found window.ENV._csrf_token: ${window.ENV._csrf_token.substring(0, 50)}...`);
    }
    
    // Log all ENV properties that might be related
    Object.keys(window.ENV).forEach(key => {
      if (key.toLowerCase().includes('csrf') || key.toLowerCase().includes('token')) {
        console.log(`  ✓ Found window.ENV.${key}`);
      }
    });
  }
  
  // Check jQuery ajaxSetup (Canvas uses jQuery)
  if (window.$ && window.$.ajaxSetup) {
    const ajaxSettings = window.$.ajaxSetup();
    if (ajaxSettings && ajaxSettings.headers) {
      console.log('  ✓ Found jQuery ajaxSetup');
      findings.ajaxSetup = ajaxSettings.headers;
      if (ajaxSettings.headers['X-CSRF-Token']) {
        console.log(`  ✓ Found X-CSRF-Token in ajaxSetup: ${ajaxSettings.headers['X-CSRF-Token'].substring(0, 50)}...`);
      }
    }
  }
  
  // 4. Check data attributes on body/html
  console.log('\n4. Checking data attributes...');
  const body = document.body;
  const html = document.documentElement;
  [body, html].forEach(el => {
    if (el) {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.toLowerCase().includes('csrf') || attr.name.toLowerCase().includes('token')) {
          console.log(`  ✓ Found attribute on ${el.tagName}: ${attr.name}="${attr.value.substring(0, 50)}..."`);
          findings.dataAttributes.push({ element: el.tagName, name: attr.name, value: attr.value.substring(0, 50) + '...' });
        }
      });
    }
  });
  
  // 5. Intercept fetch to see what headers Canvas uses
  console.log('\n5. Setting up fetch interceptor to monitor GraphQL requests...');
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    if (typeof url === 'string' && url.includes('/api/graphql')) {
      console.log('\n  📡 Intercepted GraphQL request to:', url);
      console.log('  Headers:', options.headers);
      
      findings.networkRequests.push({
        url,
        method: options.method || 'GET',
        headers: options.headers
      });
      
      // Check if headers is a Headers object
      if (options.headers instanceof Headers) {
        const headersObj = {};
        options.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
        console.log('  Headers object:', headersObj);
        
        if (headersObj['X-CSRF-Token']) {
          console.log(`  ✓ Found X-CSRF-Token in request: ${headersObj['X-CSRF-Token'].substring(0, 50)}...`);
        }
      } else if (options.headers && typeof options.headers === 'object') {
        if (options.headers['X-CSRF-Token']) {
          console.log(`  ✓ Found X-CSRF-Token in request: ${options.headers['X-CSRF-Token'].substring(0, 50)}...`);
        }
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // 6. Try to find it in the page source by searching for common patterns
  console.log('\n6. Searching page source for CSRF patterns...');
  const pageText = document.documentElement.innerHTML;
  const csrfPatterns = [
    /csrf[_-]?token["\s:=]+([a-zA-Z0-9+/=]{20,})/gi,
    /X-CSRF-Token["\s:]+([a-zA-Z0-9+/=]{20,})/gi,
    /"csrf_token":\s*"([^"]+)"/gi,
    /'csrf_token':\s*'([^']+)'/gi
  ];
  
  csrfPatterns.forEach((pattern, i) => {
    const matches = pageText.match(pattern);
    if (matches) {
      console.log(`  ✓ Found potential CSRF token with pattern ${i + 1}: ${matches[0].substring(0, 100)}...`);
    }
  });
  
  // 7. Check if Canvas has a global function to get CSRF token
  console.log('\n7. Checking for Canvas-specific CSRF token functions...');
  const canvasFunctions = [
    'getCSRFToken',
    'getCsrfToken',
    'csrfToken',
    'getAuthenticityToken'
  ];
  
  canvasFunctions.forEach(funcName => {
    if (window[funcName] && typeof window[funcName] === 'function') {
      try {
        const token = window[funcName]();
        console.log(`  ✓ Found function ${funcName}(): ${token ? token.substring(0, 50) + '...' : 'null'}`);
      } catch (e) {
        console.log(`  ✗ Function ${funcName} exists but threw error:`, e);
      }
    }
  });
  
  console.log('\n=== Diagnostic Complete ===');
  console.log('Full findings object:', findings);
  
  return findings;
})();

