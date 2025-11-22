/**
 * Shared module for Canvas GraphQL operations
 * Provides CSRF token finding and GraphQL request execution functionality
 */

/**
 * Attempts to find the CSRF token from various sources on the page
 * @returns {string|null} The CSRF token if found, null otherwise
 */
function findCSRFToken() {
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
                        console.log('Found and decoded CSRF token via:', method.name);
                    } catch (e) {
                        console.log('Found CSRF token via:', method.name, '(could not decode, using as-is)');
                    }
                } else {
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

/**
 * Executes a GraphQL query against Canvas API
 * @param {string} query - The GraphQL query string
 * @param {string} endpoint - The GraphQL endpoint URL (default: https://usflearn.instructure.com/api/graphql)
 * @param {Object} variables - Optional GraphQL variables
 * @returns {Promise<Object>} The response data
 */
async function executeGraphQLQuery(query, endpoint = 'https://usflearn.instructure.com/api/graphql', variables = {}) {
    // Get the CSRF token
    let csrfToken = findCSRFToken();
    
    // Ensure token is decoded if it was URL encoded
    if (csrfToken && csrfToken.includes('%')) {
        try {
            csrfToken = decodeURIComponent(csrfToken);
            console.log('Decoded CSRF token');
        } catch (e) {
            console.warn('Could not decode CSRF token, using as-is');
        }
    }

    const requestBody = {
        query: query.trim(),
        ...(Object.keys(variables).length > 0 && { variables })
    };

    // Construct headers
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://usflearn.instructure.com',
        'Referer': window.location.href,
    };

    // Only add CSRF token if we found it
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    console.log('Making GraphQL request to:', endpoint);
    console.log('Request headers:', Object.keys(headers));
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        credentials: 'include' // Important to send cookies
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            errorData = { message: errorText };
        }
        
        const error = new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.data = errorData;
        error.rawResponse = errorText;
        throw error;
    }

    const data = await response.json();
    console.log('GraphQL Response:', data);
    return data;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS
    module.exports = { findCSRFToken, executeGraphQLQuery };
} else if (typeof window !== 'undefined') {
    // Browser/Extension context
    window.CanvasGraphQL = { findCSRFToken, executeGraphQLQuery };
}

