// content_script.js for queryForwarder extension

/**
 * Content script that executes GraphQL queries on behalf of a backend
 * Uses shared Canvas GraphQL module to execute queries with browser cookies
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executeQuery') {
        handleQueryExecution(request.query, request.variables, request.endpoint)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: {
                        message: error.message,
                        status: error.status,
                        statusText: error.statusText,
                        data: error.data,
                        rawResponse: error.rawResponse
                    }
                });
            });
        
        // Return true to indicate we will send a response asynchronously
        return true;
    }
});

/**
 * Handles GraphQL query execution
 * @param {string} query - The GraphQL query string
 * @param {Object} variables - Optional GraphQL variables
 * @param {string} endpoint - Optional GraphQL endpoint (defaults to Canvas endpoint)
 */
async function handleQueryExecution(query, variables = {}, endpoint = null) {
    const defaultEndpoint = 'https://usflearn.instructure.com/api/graphql';
    const graphqlEndpoint = endpoint || defaultEndpoint;
    
    // Wait for shared module to be available
    let maxWait = 50; // 5 seconds max wait
    while (!window.CanvasGraphQL && maxWait > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        maxWait--;
    }
    
    if (!window.CanvasGraphQL) {
        throw new Error('Canvas GraphQL shared module not loaded. Please refresh the page.');
    }
    
    // Execute the query using shared module
    const result = await window.CanvasGraphQL.executeGraphQLQuery(query, graphqlEndpoint, variables);
    return result;
}

// Log that content script is loaded
console.log('QueryForwarder content script loaded and ready to execute queries');

