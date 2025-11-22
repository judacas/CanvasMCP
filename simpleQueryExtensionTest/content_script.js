// content_script.js

/**
 * Executes a GraphQL introspection query to usflearn.instructure.com/api/graphql.
 * This script is intended to run as a content script on usflearn.instructure.com.
 * It automatically uses the browser's cookies and attempts to find the X-CSRF-Token
 * from a meta tag in the document.
 */

/**
 * Creates and manages a UI panel to display results
 */
function createResultPanel() {
    // Remove existing panel if it exists
    const existing = document.getElementById('canvas-graphql-result-panel');
    if (existing) {
        existing.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'canvas-graphql-result-panel';
    panel.innerHTML = `
        <div class="canvas-graphql-header">
            <h3>Canvas GraphQL Query</h3>
            <button class="canvas-graphql-close" id="canvas-graphql-close-btn">×</button>
        </div>
        <div class="canvas-graphql-content" id="canvas-graphql-content">
            <div class="canvas-graphql-query-form">
                <label for="canvas-graphql-query-input" class="canvas-graphql-label">Enter your GraphQL query:</label>
                <textarea id="canvas-graphql-query-input" class="canvas-graphql-textarea" placeholder="query { ... }"></textarea>
                <button id="canvas-graphql-submit-btn" class="canvas-graphql-submit-btn">Submit Query</button>
            </div>
            <div id="canvas-graphql-results" style="display: none;"></div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #canvas-graphql-result-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 600px;
            max-height: 80vh;
            background: white;
            border: 2px solid #2d3b45;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
        }
        .canvas-graphql-header {
            background: #2d3b45;
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 6px 6px 0 0;
        }
        .canvas-graphql-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        .canvas-graphql-close {
            background: transparent;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .canvas-graphql-close:hover {
            background: rgba(255,255,255,0.2);
        }
        .canvas-graphql-content {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
            font-size: 13px;
            line-height: 1.5;
        }
        .canvas-graphql-status {
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .canvas-graphql-status.info {
            background: #e3f2fd;
            color: #1976d2;
            border-left: 4px solid #1976d2;
        }
        .canvas-graphql-status.success {
            background: #e8f5e9;
            color: #388e3c;
            border-left: 4px solid #388e3c;
        }
        .canvas-graphql-status.error {
            background: #ffebee;
            color: #c62828;
            border-left: 4px solid #c62828;
        }
        .canvas-graphql-status.warning {
            background: #fff3e0;
            color: #f57c00;
            border-left: 4px solid #f57c00;
        }
        .canvas-graphql-section {
            margin-bottom: 16px;
        }
        .canvas-graphql-section-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #2d3b45;
            font-size: 14px;
        }
        .canvas-graphql-code {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 300px;
            overflow-y: auto;
        }
        .canvas-graphql-data {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 12px;
            max-height: 400px;
            overflow-y: auto;
        }
        .canvas-graphql-data pre {
            margin: 0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .canvas-graphql-query-form {
            margin-bottom: 16px;
        }
        .canvas-graphql-label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #2d3b45;
            font-size: 14px;
        }
        .canvas-graphql-textarea {
            width: 100%;
            min-height: 150px;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: vertical;
            box-sizing: border-box;
            margin-bottom: 12px;
        }
        .canvas-graphql-textarea:focus {
            outline: none;
            border-color: #2d3b45;
            box-shadow: 0 0 0 2px rgba(45, 59, 69, 0.1);
        }
        .canvas-graphql-submit-btn {
            background: #2d3b45;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            width: 100%;
        }
        .canvas-graphql-submit-btn:hover {
            background: #1a2329;
        }
        .canvas-graphql-submit-btn:active {
            background: #0f1417;
        }
        .canvas-graphql-submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Close button functionality
    document.getElementById('canvas-graphql-close-btn').addEventListener('click', () => {
        panel.remove();
    });

    // Submit button functionality
    const submitBtn = document.getElementById('canvas-graphql-submit-btn');
    const queryInput = document.getElementById('canvas-graphql-query-input');
    
    submitBtn.addEventListener('click', () => {
        const query = queryInput.value.trim();
        if (!query) {
            alert('Please enter a GraphQL query');
            return;
        }
        // Show results area and hide form
        document.getElementById('canvas-graphql-results').style.display = 'block';
        document.querySelector('.canvas-graphql-query-form').style.display = 'none';
        // Clear previous results
        document.getElementById('canvas-graphql-results').innerHTML = '';
        // Execute the query
        sendGraphQLRequest(query, panel);
    });

    // Allow Ctrl+Enter to submit
    queryInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            submitBtn.click();
        }
    });

    return panel;
}

function updatePanel(panel, content) {
    const contentDiv = document.getElementById('canvas-graphql-content');
    if (contentDiv) {
        contentDiv.innerHTML = content;
    }
}

function addStatus(panel, message, type = 'info') {
    const resultsDiv = document.getElementById('canvas-graphql-results');
    if (resultsDiv) {
        const statusDiv = document.createElement('div');
        statusDiv.className = `canvas-graphql-status ${type}`;
        statusDiv.textContent = message;
        resultsDiv.appendChild(statusDiv);
        // Auto-scroll to bottom
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }
}

function addSection(panel, title, content, isCode = false) {
    const resultsDiv = document.getElementById('canvas-graphql-results');
    if (resultsDiv) {
        const section = document.createElement('div');
        section.className = 'canvas-graphql-section';
        section.innerHTML = `
            <div class="canvas-graphql-section-title">${title}</div>
            <div class="${isCode ? 'canvas-graphql-code' : 'canvas-graphql-data'}">${content}</div>
        `;
        resultsDiv.appendChild(section);
        // Auto-scroll to bottom
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }
}

/**
 * Attempts to find the CSRF token from various sources on the page
 */
function findCSRFToken(panel) {
    // Try multiple common ways Canvas stores CSRF tokens
    const methods = [
        {
            name: 'meta[name="csrf-token"]',
            fn: () => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta ? meta.content : null;
            }
        },
        {
            name: 'meta[name="csrf_token"]',
            fn: () => {
                const meta = document.querySelector('meta[name="csrf_token"]');
                return meta ? meta.content : null;
            }
        },
        {
            name: '[data-csrf-token]',
            fn: () => {
                const element = document.querySelector('[data-csrf-token]');
                return element ? element.getAttribute('data-csrf-token') : null;
            }
        },
        {
            name: 'window.ENV.CSRF_TOKEN',
            fn: () => {
                if (window.ENV && window.ENV.CSRF_TOKEN) {
                    return window.ENV.CSRF_TOKEN;
                }
                return null;
            }
        },
        {
            name: 'cookies',
            fn: () => {
                const cookies = document.cookie.split(';');
                for (let cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === '_csrf_token' || name === 'csrf_token') {
                        return value;
                    }
                }
                return null;
            }
        }
    ];

    for (let method of methods) {
        try {
            let token = method.fn();
            if (token) {
                // Decode URL-encoded tokens (Canvas sometimes stores them encoded)
                if (token.includes('%')) {
                    try {
                        token = decodeURIComponent(token);
                        if (panel) {
                            addStatus(panel, `✓ Found and decoded CSRF token via: ${method.name}`, 'success');
                        }
                        console.log('Found and decoded CSRF token via:', method.name);
                    } catch (e) {
                        if (panel) {
                            addStatus(panel, `✓ Found CSRF token via: ${method.name} (could not decode, using as-is)`, 'success');
                        }
                        console.log('Found CSRF token via:', method.name, '(could not decode, using as-is)');
                    }
                } else {
                    if (panel) {
                        addStatus(panel, `✓ Found CSRF token via: ${method.name}`, 'success');
                    }
                    console.log('Found CSRF token via:', method.name);
                }
                return token;
            }
        } catch (e) {
            console.debug('CSRF token method failed:', e);
        }
    }

    return null;
}

async function sendGraphQLRequest(customQuery = null, panel = null) {
    const graphqlEndpoint = 'https://usflearn.instructure.com/api/graphql';
    
    // Create the result panel if not provided
    if (!panel) {
        panel = createResultPanel();
    }
    
    // Use custom query or default introspection query
    const useCustomQuery = customQuery !== null;
    if (useCustomQuery) {
        addStatus(panel, 'Starting custom GraphQL query...', 'info');
    } else {
        addStatus(panel, 'Starting GraphQL introspection query...', 'info');
    }

    // 1. Get the X-CSRF-Token from various sources
    addStatus(panel, 'Searching for CSRF token...', 'info');
    let csrfToken = findCSRFToken(panel);

    // Ensure token is decoded if it was URL encoded
    if (csrfToken && csrfToken.includes('%')) {
        try {
            csrfToken = decodeURIComponent(csrfToken);
            console.log('Decoded CSRF token');
        } catch (e) {
            console.warn('Could not decode CSRF token, using as-is');
        }
    }

    if (!csrfToken) {
        addStatus(panel, '⚠ X-CSRF-Token not found. Attempting request without it (may fail).', 'warning');
        console.warn('X-CSRF-Token not found. Attempting request without it (may fail).');
        const metaTags = Array.from(document.querySelectorAll('meta')).map(m => ({
            name: m.getAttribute('name'),
            content: m.getAttribute('content')?.substring(0, 20) + '...'
        }));
        addSection(panel, 'Available Meta Tags', JSON.stringify(metaTags, null, 2), true);
        console.log('Available meta tags:', metaTags);
    } else {
        addStatus(panel, `✓ CSRF Token found: ${csrfToken.substring(0, 30)}...`, 'success');
        console.log('CSRF Token found:', csrfToken.substring(0, 30) + '...');
    }

    // 2. Use custom query or default introspection query
    let graphqlQuery;
    if (useCustomQuery) {
        graphqlQuery = customQuery;
    } else {
        // Default introspection query
        graphqlQuery = `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              ...FullType
            }
            directives {
              name
              description
              locations
              args {
                ...InputValue
              }
            }
          }
        }

        fragment FullType on __Type {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            args {
              ...InputValue
            }
            type {
              ...TypeRef
            }
            isDeprecated
            deprecationReason
          }
          inputFields {
            ...InputValue
          }
          interfaces {
            ...TypeRef
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            ...TypeRef
          }
        }

        fragment InputValue on __InputValue {
          name
          description
          type { ...TypeRef }
          defaultValue
        }

        fragment TypeRef on __Type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
    `;
    }

    const requestBody = {
        query: graphqlQuery.trim(), // Remove leading/trailing whitespace
        // variables: {} // Add variables here if your GraphQL query uses them
    };

    // 3. Construct and send the fetch request.
    //    - method: 'POST' for GraphQL mutations/queries.
    //    - headers: 'Content-Type' and optionally 'X-CSRF-Token'.
    //      The 'Cookie' header will be sent automatically by the browser for same-origin requests.
    //    - credentials: 'include' ensures cookies are sent, though often default for same-origin.
    try {
        const headers = {
            'Content-Type': 'application/json',
            // The browser will automatically add the 'Cookie' header for usflearn.instructure.com
            // as this content script runs in its context.
            'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest', // Often expected by Canvas
            'Origin': 'https://usflearn.instructure.com',
            'Referer': window.location.href, // Use current page as referer
        };

        // Only add CSRF token if we found it
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        addStatus(panel, 'Making GraphQL request...', 'info');
        addSection(panel, 'Request URL', graphqlEndpoint, true);
        addSection(panel, 'Request Headers', JSON.stringify(headers, null, 2), true);
        console.log('Making GraphQL request with headers:', Object.keys(headers));

        const response = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            credentials: 'include' // Important to send cookies
        });

        // Log request details for debugging
        console.log('Request URL:', graphqlEndpoint);
        console.log('Request method: POST');
        console.log('Request headers:', headers);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        if (!response.ok) {
            const errorText = await response.text();
            addStatus(panel, `✗ Request failed: ${response.status} ${response.statusText}`, 'error');
            addSection(panel, 'Error Response', errorText, true);
            console.error(`GraphQL request failed with status: ${response.status} ${response.statusText}`);
            console.error('Error response:', errorText);
            
            // Try to parse error for more details
            try {
                const errorData = JSON.parse(errorText);
                addSection(panel, 'Parsed Error Data', JSON.stringify(errorData, null, 2), true);
                console.error('Parsed error data:', errorData);
                
                // Check if it's a CSRF token issue
                if (response.status === 403 || response.status === 422) {
                    const troubleshooting = [
                        '1. CSRF token may be invalid or expired',
                        '2. CSRF token may need to be decoded (check if it contains %2F or similar)',
                        '3. Request format may be incorrect',
                        '4. Query syntax may be invalid',
                        '',
                        '💡 Try:',
                        '- Refresh the page to get a new CSRF token',
                        '- Check Network tab in DevTools to see how Canvas makes requests',
                        '- Verify the GraphQL query syntax is correct'
                    ].join('\n');
                    addSection(panel, 'Troubleshooting Tips', troubleshooting, false);
                    console.error('\n⚠️ Possible issues:');
                    console.error('1. CSRF token may be invalid or expired');
                    console.error('2. CSRF token may need to be decoded (check if it contains %2F or similar)');
                    console.error('3. Request format may be incorrect');
                    console.error('4. Query syntax may be invalid');
                    console.error('\n💡 Try:');
                    console.error('- Refresh the page to get a new CSRF token');
                    console.error('- Check Network tab in DevTools to see how Canvas makes requests');
                    console.error('- Verify the GraphQL query syntax is correct');
                }
            } catch (e) {
                // Error is not JSON, that's fine
            }
            return;
        }

        const data = await response.json();
        addStatus(panel, '✓ Request successful!', 'success');
        addSection(panel, 'Response Data', JSON.stringify(data, null, 2), true);
        
        // Display schema summary if available
        if (data.data && data.data.__schema) {
            const schema = data.data.__schema;
            const summary = {
                queryType: schema.queryType?.name || 'N/A',
                mutationType: schema.mutationType?.name || 'N/A',
                subscriptionType: schema.subscriptionType?.name || 'N/A',
                totalTypes: schema.types?.length || 0,
                typeNames: schema.types?.slice(0, 20).map(t => t.name).filter(Boolean) || []
            };
            addSection(panel, 'Schema Summary', JSON.stringify(summary, null, 2), false);
        }
        
        // Add "New Query" button
        const resultsDiv = document.getElementById('canvas-graphql-results');
        if (resultsDiv) {
            const newQueryBtn = document.createElement('button');
            newQueryBtn.className = 'canvas-graphql-submit-btn';
            newQueryBtn.textContent = 'New Query';
            newQueryBtn.style.marginTop = '16px';
            newQueryBtn.addEventListener('click', () => {
                // Show form and hide results
                document.querySelector('.canvas-graphql-query-form').style.display = 'block';
                document.getElementById('canvas-graphql-results').style.display = 'none';
                document.getElementById('canvas-graphql-results').innerHTML = '';
                // Clear the textarea
                document.getElementById('canvas-graphql-query-input').value = '';
            });
            resultsDiv.appendChild(newQueryBtn);
        }
        
        console.log('GraphQL Response:', data);
        // You can now process the 'data' object here.
        // For example, if you wanted to display schema types:
        // console.log('Schema Types:', data.data.__schema.types.map(type => type.name));

    } catch (error) {
        addStatus(panel, `✗ Error: ${error.message}`, 'error');
        addSection(panel, 'Error Details', error.stack || String(error), true);
        console.error('Error making GraphQL request:', error);
    }
}

// Create the panel when the page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for Canvas to fully initialize
        setTimeout(() => {
            createResultPanel();
        }, 1000);
    });
} else {
    // DOM is already ready, but wait a bit for Canvas to initialize
    setTimeout(() => {
        createResultPanel();
    }, 1000);
}
