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

// Native Messaging connection
let nativePort = null;

// Connect to native host
function connectNativeHost() {
    // Debug: Check what's available
    console.log('Checking native messaging availability...');
    console.log('chrome.runtime exists:', !!chrome.runtime);
    console.log('chrome.runtime.connectNative exists:', !!(chrome.runtime && chrome.runtime.connectNative));
    console.log('Available chrome.runtime methods:', chrome.runtime ? Object.keys(chrome.runtime) : 'N/A');
    
    // Check if native messaging is available
    if (!chrome.runtime) {
        console.error('ERROR: chrome.runtime is not available!');
        return;
    }
    
    if (typeof chrome.runtime.connectNative !== 'function') {
        console.error('ERROR: chrome.runtime.connectNative is not a function!');
        console.error('This might mean:');
        console.error('1. Chrome version is too old (needs Chrome 26+)');
        console.error('2. Native host is not properly registered');
        console.error('3. Extension ID mismatch in native host manifest');
        console.error('4. Chrome needs to be restarted after installing native host');
        console.error('');
        console.error('Try:');
        console.error('1. Restart Chrome completely');
        console.error('2. Verify native host manifest exists and is correct');
        console.error('3. Check that Extension ID matches in manifest');
        // Don't retry if the API doesn't exist
        return;
    }
    
    try {
        nativePort = chrome.runtime.connectNative('com.canvasmcp.queryforwarder');
        
        nativePort.onMessage.addListener((message) => {
            console.log('Received message from native host:', message);
            
            // Handle messages from native host
            if (message.type === 'query') {
                // Native host is requesting a query execution
                executeQuery({
                    query: message.query,
                    variables: message.variables || {},
                    endpoint: message.endpoint
                })
                .then(result => {
                    // Send result back to native host
                    if (nativePort) {
                        nativePort.postMessage({
                            id: message.id,
                            type: 'response',
                            success: true,
                            data: result
                        });
                    }
                })
                .catch(error => {
                    // Send error back to native host
                    if (nativePort) {
                        nativePort.postMessage({
                            id: message.id,
                            type: 'response',
                            success: false,
                            error: {
                                message: error.message,
                                stack: error.stack
                            }
                        });
                    }
                });
            } else if (message.type === 'ready') {
                console.log('Native host ready:', message.message);
            }
        });
        
        nativePort.onDisconnect.addListener(() => {
            console.log('Native host disconnected');
            if (chrome.runtime.lastError) {
                console.error('Disconnect error:', chrome.runtime.lastError.message);
            }
            nativePort = null;
            // Try to reconnect after a delay
            setTimeout(connectNativeHost, 5000);
        });
        
        // Send connection confirmation
        nativePort.postMessage({
            type: 'connected',
            message: 'Extension connected to native host'
        });
        
        console.log('Connected to native host');
    } catch (error) {
        console.error('Failed to connect to native host:', error);
        // Retry after delay
        setTimeout(connectNativeHost, 5000);
    }
}

// Connect on startup
connectNativeHost();

// Log that background script is loaded
console.log('QueryForwarder background script loaded and ready');

