// content_script.js

/**
 * Executes a GraphQL introspection query to usflearn.instructure.com/api/graphql.
 * This script is intended to run as a content script on usflearn.instructure.com.
 * It automatically uses the browser's cookies and attempts to find the X-CSRF-Token
 * from a meta tag in the document.
 */

// Shared module is loaded via manifest.json content_scripts array
// It will be available as window.CanvasGraphQL after a short delay

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
 * Uses shared module but maintains original UI behavior
 */
function findCSRFToken(panel) {
    // Use shared module function
    const token = window.CanvasGraphQL ? window.CanvasGraphQL.findCSRFToken() : null;
    
    // Maintain original UI behavior by showing status messages
    if (token && panel) {
        addStatus(panel, `✓ Found CSRF token`, 'success');
    }
    
    return token;
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

    // 3. Use shared module to execute query, but maintain original UI behavior
    try {
        // Show request details in UI
        addStatus(panel, 'Making GraphQL request...', 'info');
        addSection(panel, 'Request URL', graphqlEndpoint, true);
        
        // Get CSRF token for display
        const csrfTokenForDisplay = findCSRFToken();
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://usflearn.instructure.com',
            'Referer': window.location.href,
            ...(csrfTokenForDisplay && { 'X-CSRF-Token': csrfTokenForDisplay })
        };
        addSection(panel, 'Request Headers', JSON.stringify(headers, null, 2), true);
        console.log('Making GraphQL request with headers:', Object.keys(headers));

        // Use shared module to execute query
        let data;
        if (window.CanvasGraphQL && window.CanvasGraphQL.executeGraphQLQuery) {
            data = await window.CanvasGraphQL.executeGraphQLQuery(graphqlQuery, graphqlEndpoint);
        } else {
            // Fallback to original implementation if shared module not loaded
            throw new Error('Shared Canvas GraphQL module not loaded');
        }

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

    } catch (error) {
        addStatus(panel, `✗ Error: ${error.message}`, 'error');
        
        // Handle error response details
        if (error.status) {
            addStatus(panel, `✗ Request failed: ${error.status} ${error.statusText}`, 'error');
            if (error.rawResponse) {
                addSection(panel, 'Error Response', error.rawResponse, true);
            }
            if (error.data) {
                addSection(panel, 'Parsed Error Data', JSON.stringify(error.data, null, 2), true);
            }
            
            // Check if it's a CSRF token issue
            if (error.status === 403 || error.status === 422) {
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
            }
        } else {
            addSection(panel, 'Error Details', error.stack || String(error), true);
        }
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
