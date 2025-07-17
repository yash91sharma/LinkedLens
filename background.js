// LinkedLens Background Script
// Simple background service worker for the extension

// Default categories for LinkedIn posts
const DEFAULT_CATEGORIES = [
    { name: 'Technology', description: 'Tech news, software development, AI, programming, and digital trends' },
    { name: 'Career', description: 'Job opportunities, career advice, professional development, and workplace tips' },
    { name: 'Business', description: 'Business news, entrepreneurship, company updates, and market insights' },
    { name: 'Industry News', description: 'Industry-specific news, trends, and updates' },
    { name: 'Personal', description: 'Personal stories, achievements, and life updates' },
    { name: 'Education', description: 'Learning resources, courses, certifications, and educational content' },
    { name: 'Networking', description: 'Professional networking, events, and connection opportunities' },
    { name: 'Thought Leadership', description: 'Opinion pieces, insights, and expert commentary' }
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
});
