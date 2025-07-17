// LinkedLens Background Script
// Simple background service worker for the extension

// Default categories for LinkedIn posts
const DEFAULT_CATEGORIES = [
    { name: 'Career', description: 'Posts about job opportunities, career growth, collaboration etc.' },
    { name: 'Life Update', description: 'Posts about authors life update like new job, break, life event, achievement, project update etc.' },
    { name: 'Self Promotiom', description: 'Posts that are primarily self-promotional, often lacking actionable information or genuine updates. These are typically boastful, focused on personal branding, and intended mainly to boost engagement or profile visibility, rather than sharing meaningful achievements, events, or useful insights.' },
    { name: 'Marketing', description: 'Marketing or selling of about a product, company, course etc.' },
];

// Initialize default categories if none exist
async function initializeDefaultCategories() {
    try {
        const result = await chrome.storage.sync.get(['categories']);
        if (!result.categories || result.categories.length === 0) {
            const categoriesWithIds = DEFAULT_CATEGORIES.map((category, index) => ({
                id: `default-${index}`,
                name: category.name,
                description: category.description
            }));
            
            await chrome.storage.sync.set({ categories: categoriesWithIds });
            console.log('LinkedLens: Default categories initialized');
        }
    } catch (error) {
        console.error('Error initializing default categories:', error);
    }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('LinkedLens extension installed');
    await initializeDefaultCategories();
});

// Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup, no additional action needed
    console.log('LinkedLens icon clicked');
});

// Listen for tab updates to potentially refresh content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com')) {
        console.log('LinkedIn page loaded, content script should be active');
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'initializeDefaultCategories') {
        initializeDefaultCategories().then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            console.error('Error initializing default categories:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'callOllama') {
        const { config, systemPrompt, userPrompt } = request;
        const url = `${config.url}/api/chat`;
        
        const requestBody = {
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            stream: false
        };

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data: data.message.content });
        })
        .catch(error => {
            console.error('Error calling Ollama from background script:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true; // Indicates that the response is sent asynchronously
    }
});
