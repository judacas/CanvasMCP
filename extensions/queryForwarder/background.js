// background.js for queryForwarder extension

/**
 * Background script that handles communication between backend and content script
 * Can receive queries via chrome.runtime.onMessageExternal (from external apps)
 * or via chrome.runtime.onMessage (from extension pages/popups)
 */

// Store active tabs for each Canvas domain
const canvasTabs = new Map();

// Listen for tab updates to track Canvas tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const url = new URL(tab.url);
            if (url.hostname.includes('instructure.com') || url.hostname.includes('canvas')) {
                canvasTabs.set(tabId, {
                    url: tab.url,
                    hostname: url.hostname
                });
                console.log('Canvas tab registered:', tabId, url.hostname);
            }
        } catch (e) {
            // Invalid URL, ignore
        }
    }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
    canvasTabs.delete(tabId);
});

/**
 * Find an active Canvas tab
 * @returns {Promise<number>} Tab ID or null
 */
async function findCanvasTab() {
    // First check our tracked tabs
    for (const [tabId, info] of canvasTabs.entries()) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.url && (tab.url.includes('instructure.com') || tab.url.includes('canvas'))) {
                return tabId;
            }
        } catch (e) {
            // Tab no longer exists, remove from map
            canvasTabs.delete(tabId);
        }
    }
    
    // If no tracked tab, search all tabs
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url && (tab.url.includes('instructure.com') || tab.url.includes('canvas'))) {
                canvasTabs.set(tab.id, {
                    url: tab.url,
                    hostname: new URL(tab.url).hostname
                });
                return tab.id;
            }
        }
    } catch (e) {
        console.error('Error searching for Canvas tabs:', e);
    }
    
    return null;
}

/**
 * Execute a GraphQL query on a Canvas page
 * @param {Object} request - Request object with query, variables, endpoint
 * @returns {Promise<Object>} Query result
 */
async function executeQuery(request) {
    const { query, variables = {}, endpoint = null } = request;
    
    if (!query) {
        throw new Error('Query is required');
    }
    
    // Find an active Canvas tab
    const tabId = await findCanvasTab();
    
    if (!tabId) {
        throw new Error('No active Canvas tab found. Please open a Canvas page first.');
    }
    
    // Inject content script if needed and send message
    try {
        // Try to send message (content script might already be loaded)
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'executeQuery',
            query,
            variables,
            endpoint
        });
        
        if (!response.success) {
            throw new Error(response.error?.message || 'Query execution failed');
        }
        
        return response.data;
    } catch (error) {
        // If message fails, content script might not be loaded
        // Try to inject it
        if (error.message.includes('Could not establish connection')) {
            try {
                // Inject content script
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['canvas-graphql.js', 'content_script.js']
                });
                
                // Wait a bit for script to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try again
                const response = await chrome.tabs.sendMessage(tabId, {
                    action: 'executeQuery',
                    query,
                    variables,
                    endpoint
                });
                
                if (!response.success) {
                    throw new Error(response.error?.message || 'Query execution failed');
                }
                
                return response.data;
            } catch (injectError) {
                throw new Error(`Failed to inject content script: ${injectError.message}`);
            }
        }
        throw error;
    }
}

// Listen for messages from extension pages/popups
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executeGraphQLQuery') {
        executeQuery(request)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            });
        
        // Return true to indicate async response
        return true;
    }
});

// Listen for external messages (from native apps or other extensions)
// This allows backend services to communicate with the extension
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === 'executeGraphQLQuery') {
        executeQuery(request)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            });
        
        // Return true to indicate async response
        return true;
    }
});

// Log that background script is loaded
console.log('QueryForwarder background script loaded and ready');

