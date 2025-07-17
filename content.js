// LinkedLens Content Script for LinkedIn Post Processing
// This script runs on LinkedIn pages and processes posts with LLM categorization

class LinkedLensProcessor {
    constructor() {
        this.processedPosts = new Set();
        this.processingQueue = [];
        this.isProcessing = false;
        this.categories = [];
        this.llmConfig = null;
        this.postIdCounter = 0;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        // Only run on LinkedIn feed pages
        if (!this.isLinkedInFeed()) {
            return;
        }

        console.log('LinkedLens: Initializing on LinkedIn feed');
        
        // Load saved configuration
        await this.loadConfiguration();
        
        // Start observing for new posts
        this.startObservingPosts();
        
        // Process existing posts after a short delay to let the page load
        setTimeout(() => {
            this.processExistingPosts();
        }, 2000);
        
        // Start the processing queue
        this.startProcessingQueue();
    }

    isLinkedInFeed() {
        // Check if we're on a LinkedIn feed page
        const url = window.location.href;
        const feedPaths = ['/feed/', '/feed', '/'];
        return feedPaths.some(path => url.includes('linkedin.com' + path)) || 
               url.match(/^https:\/\/www\.linkedin\.com\/?(\?.*)?$/);
    }

    async loadConfiguration() {
        try {
            const result = await chrome.storage.sync.get(['llmConfig', 'categories']);
            this.llmConfig = result.llmConfig || null;
            this.categories = result.categories || [];
            
            // If no categories found, try to initialize default ones
            if (this.categories.length === 0) {
                await this.initializeDefaultCategories();
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    }

    async initializeDefaultCategories() {
        try {
            // Request background script to initialize default categories
            await chrome.runtime.sendMessage({ action: 'initializeDefaultCategories' });
            
            // Reload configuration after initialization
            const result = await chrome.storage.sync.get(['categories']);
            this.categories = result.categories || [];
            
            if (this.categories.length > 0) {
                console.log('LinkedLens: Default categories initialized from content script');
            }
        } catch (error) {
            console.error('Error initializing default categories:', error);
        }
    }

    startObservingPosts() {
        // Create a MutationObserver to watch for new posts
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.findAndProcessNewPosts(node);
                        }
                    });
                }
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    processExistingPosts() {
        // Process posts that are already on the page
        this.findAndProcessNewPosts(document.body);
    }

    findAndProcessNewPosts(rootElement) {
        // LinkedIn post selectors (updated for current LinkedIn structure)
        const postSelectors = [
            '.feed-shared-update-v2',
            '[data-urn*="activity"]',
            '.feed-shared-update-v2__description-wrapper',
            '.feed-shared-update-v2__content',
            '.feed-shared-update-v2__container',
            '.feed-shared-update-v2__description'
        ];

        // Find posts using various selectors
        const allPosts = new Set();
        
        postSelectors.forEach(selector => {
            const posts = rootElement.querySelectorAll(selector);
            posts.forEach(post => {
                // Find the main post container
                const postContainer = post.closest('.feed-shared-update-v2') || post;
                if (postContainer) {
                    allPosts.add(postContainer);
                }
            });
        });

        // Process each unique post
        allPosts.forEach(post => this.processPost(post));
    }

    processPost(postElement) {
        // Generate unique ID for the post
        const postId = this.generatePostId(postElement);
        
        // Skip if already processed
        if (this.processedPosts.has(postId)) {
            return;
        }

        // Mark as processed to avoid duplicate processing
        this.processedPosts.add(postId);

        // Add initial "not processed" tag
        this.addPostTag(postElement, 'not-processed', 'Not Processed');

        // Add to processing queue
        this.processingQueue.push({
            id: postId,
            element: postElement,
            timestamp: Date.now()
        });
    }

    generatePostId(postElement) {
        // Try to get a unique identifier from the post
        const dataId = postElement.getAttribute('data-activity-id') || 
                     postElement.getAttribute('data-urn') ||
                     postElement.closest('[data-activity-id]')?.getAttribute('data-activity-id') ||
                     postElement.closest('[data-urn]')?.getAttribute('data-urn');
        
        if (dataId) {
            return dataId;
        }

        // Fallback: generate ID based on content and position
        const textContent = postElement.textContent?.substring(0, 100) || '';
        const hash = this.simpleHash(textContent);
        return `post-${hash}-${this.postIdCounter++}`;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    addPostTag(postElement, className, text) {
        // Remove existing LinkedLens tags
        const existingTags = postElement.querySelectorAll('.linkedlens-tag');
        existingTags.forEach(tag => tag.remove());

        // Create new tag
        const tag = document.createElement('div');
        tag.className = `linkedlens-tag ${className}`;
        tag.textContent = text;
        tag.title = `LinkedLens: ${text}`;
        
        // Add CSS styles
        tag.style.cssText = `
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            background: ${this.getTagColor(className)} !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 12px !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            z-index: 1000 !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            cursor: default !important;
            user-select: none !important;
            white-space: nowrap !important;
            max-width: 120px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        `;

        // Make sure the post element can contain the absolutely positioned tag
        const computedStyle = getComputedStyle(postElement);
        if (computedStyle.position === 'static') {
            postElement.style.position = 'relative';
        }

        // Add tag to post
        postElement.appendChild(tag);
    }

    getTagColor(className) {
        const colors = {
            'not-processed': '#64748b',     // Gray
            'processing': '#f59e0b',        // Orange
            'error': '#ef4444',             // Red
            'uncategorized': '#8b5cf6',     // Purple
            'default': '#0ea5e9'            // Blue
        };
        
        // Generate different colors for different categories
        if (className.startsWith('category-')) {
            const categoryColors = [
                '#0ea5e9',  // Blue
                '#10b981',  // Green
                '#f59e0b',  // Orange
                '#ef4444',  // Red
                '#8b5cf6',  // Purple
                '#ec4899',  // Pink
                '#06b6d4',  // Cyan
                '#84cc16'   // Lime
            ];
            
            // Use a simple hash to assign consistent colors to categories
            const categoryId = className.replace('category-', '');
            const hash = this.simpleHash(categoryId);
            return categoryColors[hash % categoryColors.length];
        }
        
        return colors[className] || colors.default;
    }

    async startProcessingQueue() {
        setInterval(async () => {
            if (this.isProcessing || this.processingQueue.length === 0) {
                return;
            }

            // Skip processing if not on LinkedIn feed
            if (!this.isLinkedInFeed()) {
                return;
            }

            this.isProcessing = true;
            
            try {
                const post = this.processingQueue.shift();
                if (post && post.element && document.contains(post.element)) {
                    await this.processPostWithLLM(post);
                }
            } catch (error) {
                console.error('LinkedLens: Error processing post:', error);
            } finally {
                this.isProcessing = false;
            }
        }, 3000); // Process every 3 seconds to avoid rate limiting
    }

    async processPostWithLLM(post) {
        const { element, id } = post;

        // Update tag to "processing"
        this.addPostTag(element, 'processing', 'Processing...');

        try {
            // Check if LLM is configured
            if (!this.llmConfig) {
                await this.loadConfiguration();
            }

            if (!this.llmConfig) {
                console.warn('LinkedLens: LLM not configured');
                throw new Error('LLM not configured');
            }

            if (this.categories.length === 0) {
                console.warn('LinkedLens: No categories configured, attempting to initialize...');
                await this.initializeDefaultCategories();
                
                if (this.categories.length === 0) {
                    console.warn('LinkedLens: Still no categories after initialization');
                    throw new Error('No categories configured');
                }
            }

            // Extract post content
            const postContent = this.extractPostContent(element);
            
            if (!postContent.trim()) {
                console.warn('LinkedLens: No content found in post');
                throw new Error('No content found in post');
            }

            console.log(`LinkedLens: Processing post ${id} with content length: ${postContent.length}`);

            // Create system prompt with categories
            const systemPrompt = this.createSystemPrompt();
            
            // Create user prompt with post content
            const userPrompt = `Please categorize this LinkedIn post:\n\n${postContent}`;

            // Call LLM with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('LLM call timeout')), 30000);
            });

            const llmPromise = LLMHelper.callLLM(systemPrompt, userPrompt);
            const response = await Promise.race([llmPromise, timeoutPromise]);
            
            console.log(`LinkedLens: LLM response for post ${id}:`, response);

            // Find matching category
            const category = this.findMatchingCategory(response);
            
            if (category) {
                console.log(`LinkedLens: Categorized post ${id} as: ${category.name}`);
                this.addPostTag(element, `category-${category.id}`, category.name);
                
                // Track successful post processing
                await LLMHelper.trackProcessedPost();
            } else {
                console.log(`LinkedLens: Could not categorize post ${id}, marking as uncategorized`);
                this.addPostTag(element, 'uncategorized', 'Uncategorized');
                
                // Track successful post processing (even if uncategorized)
                await LLMHelper.trackProcessedPost();
            }

        } catch (error) {
            console.error(`LinkedLens: Error processing post ${id}:`, error);
            this.addPostTag(element, 'error', 'Error');
        }
    }

    extractPostContent(element) {
        // Try to find the main content area of the post
        const contentSelectors = [
            '.feed-shared-update-v2__description .feed-shared-text',
            '.feed-shared-update-v2__description',
            '.feed-shared-text',
            '.feed-shared-update-v2__commentary',
            '.feed-shared-text__text-view',
            '.feed-shared-update-v2__description-wrapper',
            '.feed-shared-update-v2__content',
            '.feed-shared-update-v2__container .feed-shared-text'
        ];

        let content = '';
        
        for (const selector of contentSelectors) {
            const contentElement = element.querySelector(selector);
            if (contentElement) {
                content = contentElement.textContent?.trim() || '';
                if (content.length > 20) { // Ensure we have substantial content
                    break;
                }
            }
        }

        // If no content found, try to get text from the entire post but filter out UI elements
        if (!content) {
            const tempElement = element.cloneNode(true);
            
            // Remove known UI elements
            const uiSelectors = [
                '.feed-shared-update-v2__social-actions',
                '.feed-shared-update-v2__actions',
                '.feed-shared-update-v2__likes',
                '.feed-shared-update-v2__comments',
                '.feed-shared-update-v2__shares',
                '.linkedlens-tag',
                'button',
                '.feed-shared-update-v2__actor',
                '.feed-shared-update-v2__header'
            ];
            
            uiSelectors.forEach(selector => {
                const elements = tempElement.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });
            
            content = tempElement.textContent?.trim() || '';
        }

        // Clean up the content
        content = content.replace(/\s+/g, ' ').trim();
        
        // Limit to reasonable length for LLM processing
        return content.substring(0, 1500);
    }

    createSystemPrompt() {
        const categoryList = this.categories.map(cat => 
            `- ${cat.name}: ${cat.description}`
        ).join('\n');

        return `You are a LinkedIn post categorizer. Your task is to categorize LinkedIn posts into one of the following categories:

${categoryList}

Rules:
1. Respond with only the category name (e.g., "${this.categories[0]?.name || 'Technology'}")
2. Choose the category that best fits the post content
3. If no category fits well, respond with "Uncategorized"
4. Be concise and accurate in your categorization`;
    }

    findMatchingCategory(response) {
        const normalizedResponse = response.toLowerCase().trim();
        
        // Try exact match first
        for (const category of this.categories) {
            if (normalizedResponse === category.name.toLowerCase()) {
                return category;
            }
        }

        // Try partial match
        for (const category of this.categories) {
            if (normalizedResponse.includes(category.name.toLowerCase())) {
                return category;
            }
        }

        return null;
    }
}

// Initialize the processor when the script loads
const linkedLensProcessor = new LinkedLensProcessor();

// Listen for storage changes to update configuration
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.llmConfig || changes.categories)) {
        linkedLensProcessor.loadConfiguration();
    }
});
