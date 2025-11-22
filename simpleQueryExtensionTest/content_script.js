// content_script.js

/**
 * Executes a GraphQL introspection query to usflearn.instructure.com/api/graphql.
 * This script is intended to run as a content script on usflearn.instructure.com.
 * It automatically uses the browser's cookies and attempts to find the X-CSRF-Token
 * from a meta tag in the document.
 */

/**
 * Attempts to find the CSRF token from various sources on the page
 */
function findCSRFToken() {
    // Try multiple common ways Canvas stores CSRF tokens
    const methods = [
        () => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.content : null;
        },
        () => {
            const meta = document.querySelector('meta[name="csrf_token"]');
            return meta ? meta.content : null;
        },
        () => {
            // Sometimes in data attributes
            const element = document.querySelector('[data-csrf-token]');
            return element ? element.getAttribute('data-csrf-token') : null;
        },
        () => {
            // Check if Canvas exposes it via window object
            if (window.ENV && window.ENV.CSRF_TOKEN) {
                return window.ENV.CSRF_TOKEN;
            }
            return null;
        },
        () => {
            // Check cookies (though this might not work in content scripts)
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === '_csrf_token' || name === 'csrf_token') {
                    return value;
                }
            }
            return null;
        }
    ];

    for (let method of methods) {
        try {
            let token = method();
            if (token) {
                // Decode URL-encoded tokens (Canvas sometimes stores them encoded)
                if (token.includes('%')) {
                    try {
                        token = decodeURIComponent(token);
                        console.log('Found and decoded CSRF token via:', method.name || 'unknown method');
                    } catch (e) {
                        console.log('Found CSRF token via:', method.name || 'unknown method', '(could not decode, using as-is)');
                    }
                } else {
                    console.log('Found CSRF token via:', method.name || 'unknown method');
                }
                return token;
            }
        } catch (e) {
            console.debug('CSRF token method failed:', e);
        }
    }

    return null;
}

async function sendGraphQLIntrospectionRequest() {
    const graphqlEndpoint = 'https://usflearn.instructure.com/api/graphql';

    // 1. Get the X-CSRF-Token from various sources
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

    if (!csrfToken) {
        console.warn('X-CSRF-Token not found. Attempting request without it (may fail).');
        console.log('Available meta tags:', Array.from(document.querySelectorAll('meta')).map(m => ({
            name: m.getAttribute('name'),
            content: m.getAttribute('content')?.substring(0, 20) + '...'
        })));
    } else {
        console.log('CSRF Token found:', csrfToken.substring(0, 30) + '...');
    }

    // 2. Define the GraphQL introspection query.
    //    This query is taken directly from the previous interaction's response body.
    const introspectionQuery = `
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

    const requestBody = {
        query: introspectionQuery.trim(), // Remove leading/trailing whitespace
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
            console.error(`GraphQL request failed with status: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            
            // Try to parse error for more details
            try {
                const errorData = JSON.parse(errorText);
                console.error('Parsed error data:', errorData);
                
                // Check if it's a CSRF token issue
                if (response.status === 403 || response.status === 422) {
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
        console.log('GraphQL Response:', data);
        // You can now process the 'data' object here.
        // For example, if you wanted to display schema types:
        // console.log('Schema Types:', data.data.__schema.types.map(type => type.name));

    } catch (error) {
        console.error('Error making GraphQL request:', error);
    }
}

// Execute the function when the page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for Canvas to fully initialize
        setTimeout(sendGraphQLIntrospectionRequest, 1000);
    });
} else {
    // DOM is already ready, but wait a bit for Canvas to initialize
    setTimeout(sendGraphQLIntrospectionRequest, 1000);
}
