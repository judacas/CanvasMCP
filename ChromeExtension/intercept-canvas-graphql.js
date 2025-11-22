// Script to intercept Canvas's own GraphQL requests to see exact format
// Inject this into the page to monitor Canvas's requests

(function() {
  console.log('🔍 Setting up Canvas GraphQL request interceptor...');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Intercept fetch
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Check if this is a GraphQL request
    if (typeof url === 'string' && url.includes('/api/graphql')) {
      console.log('\n📡 ===== INTERCEPTED CANVAS GRAPHQL REQUEST =====');
      console.log('URL:', url);
      console.log('Method:', options.method || 'GET');
      
      // Log headers
      if (options.headers) {
        console.log('\n📋 Request Headers:');
        if (options.headers instanceof Headers) {
          const headersObj = {};
          options.headers.forEach((value, key) => {
            headersObj[key] = value;
            console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
          });
        } else if (typeof options.headers === 'object') {
          Object.entries(options.headers).forEach(([key, value]) => {
            console.log(`  ${key}: ${typeof value === 'string' ? (value.substring(0, 50) + (value.length > 50 ? '...' : '')) : value}`);
          });
        }
      }
      
      // Log body
      if (options.body) {
        console.log('\n📦 Request Body:');
        if (typeof options.body === 'string') {
          try {
            const parsed = JSON.parse(options.body);
            console.log(JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log(options.body.substring(0, 500));
          }
        } else {
          console.log(options.body);
        }
      }
      
      // Log credentials
      console.log('\n🔐 Credentials:', options.credentials || 'default');
      
      console.log('==========================================\n');
    }
    
    // Call original fetch
    return originalFetch.apply(this, args);
  };
  
  // Also intercept XMLHttpRequest if Canvas uses it
  if (window.XMLHttpRequest) {
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...rest) {
        this._method = method;
        this._url = url;
        return originalOpen.apply(this, [method, url, ...rest]);
      };
      
      xhr.send = function(data) {
        if (this._url && this._url.includes('/api/graphql')) {
          console.log('\n📡 ===== INTERCEPTED CANVAS GRAPHQL REQUEST (XHR) =====');
          console.log('URL:', this._url);
          console.log('Method:', this._method);
          console.log('Body:', data);
          console.log('All Request Headers:', this.getAllResponseHeaders ? 'Check Network tab' : 'N/A');
          console.log('==========================================\n');
        }
        return originalSend.apply(this, [data]);
      };
      
      return xhr;
    };
  }
  
  console.log('✅ Interceptor active! Canvas GraphQL requests will be logged to console.');
  console.log('💡 Tip: Navigate around Canvas or trigger actions that use GraphQL to see requests.');
})();

