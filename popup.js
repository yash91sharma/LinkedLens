// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const llmProviderSelect = document.getElementById('llm-provider');
const providerConfigs = document.querySelectorAll('.provider-config');
const llmForm = document.getElementById('llm-form');
const testLLMBtn = document.getElementById('test-llm-btn');
const addCategoryBtn = document.getElementById('add-category-btn');
const categoriesList = document.getElementById('categories-list');
const saveCategoriesBtn = document.getElementById('save-categories-btn');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const resetStatsBtn = document.getElementById('reset-stats-btn');
const postsProcessedEl = document.getElementById('posts-processed');
const llmCallsEl = document.getElementById('llm-calls');
const inputTokensEl = document.getElementById('input-tokens');
const outputTokensEl = document.getElementById('output-tokens');

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupLLMProviderSwitch();
    setupLLMForm();
    setupTestButton();
    setupCategories();
    setupStatus();
    loadSavedData();
    checkLinkedInStatus();
});

// Tab functionality
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update tab buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// LLM Provider switching
function setupLLMProviderSwitch() {
    llmProviderSelect.addEventListener('change', () => {
        const selectedProvider = llmProviderSelect.value;
        
        providerConfigs.forEach(config => {
            config.classList.add('hidden');
        });
        
        const targetConfig = document.getElementById(`${selectedProvider}-config`);
        if (targetConfig) {
            targetConfig.classList.remove('hidden');
        }
    });
}

// LLM Form submission
function setupLLMForm() {
    llmForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(llmForm);
        const llmConfig = {
            provider: formData.get('provider'),
            config: {}
        };
        
        // Get provider-specific configuration
        switch (llmConfig.provider) {
            case 'ollama':
                llmConfig.config = {
                    url: formData.get('ollamaUrl') || 'http://localhost:11434',
                    model: formData.get('ollamaModel')
                };
                break;
            case 'gemini':
                llmConfig.config = {
                    apiKey: formData.get('geminiApiKey'),
                    model: formData.get('geminiModel')
                };
                break;
            case 'openai':
                llmConfig.config = {
                    apiKey: formData.get('openaiApiKey'),
                    model: formData.get('openaiModel'),
                    organization: formData.get('openaiOrg')
                };
                break;
        }
        
        // Save to chrome storage
        try {
            await chrome.storage.sync.set({ llmConfig });
            showSuccessMessage('LLM configuration saved successfully!');
        } catch (error) {
            console.error('Error saving LLM config:', error);
            alert('Error saving configuration. Please try again.');
        }
    });
}

// Test LLM connection
function setupTestButton() {
    testLLMBtn.addEventListener('click', async () => {
        testLLMBtn.disabled = true;
        testLLMBtn.textContent = 'Testing...';
        
        try {
            // First save the current form data
            const formData = new FormData(llmForm);
            const llmConfig = {
                provider: formData.get('provider'),
                config: {}
            };
            
            // Get provider-specific configuration
            switch (llmConfig.provider) {
                case 'ollama':
                    llmConfig.config = {
                        url: formData.get('ollamaUrl') || 'http://localhost:11434',
                        model: formData.get('ollamaModel')
                    };
                    break;
                case 'gemini':
                    llmConfig.config = {
                        apiKey: formData.get('geminiApiKey'),
                        model: formData.get('geminiModel')
                    };
                    break;
                case 'openai':
                    llmConfig.config = {
                        apiKey: formData.get('openaiApiKey'),
                        model: formData.get('openaiModel'),
                        organization: formData.get('openaiOrg')
                    };
                    break;
            }
            
            // Temporarily save config for testing
            await chrome.storage.sync.set({ llmConfig });
            
            // Test the connection
            const success = await LLMHelper.testConnection();
            
            if (success) {
                showSuccessMessage('LLM connection test successful!');
            } else {
                throw new Error('Connection test failed');
            }
        } catch (error) {
            console.error('LLM test failed:', error);
            alert(`Connection test failed: ${error.message}`);
        } finally {
            testLLMBtn.disabled = false;
            testLLMBtn.textContent = 'Test Connection';
        }
    });
}

// Categories functionality
function setupCategories() {
    addCategoryBtn.addEventListener('click', () => {
        addCategory();
    });

    saveCategoriesBtn.addEventListener('click', () => {
        saveCategories();
    });
}

// Status tab functionality
function setupStatus() {
    refreshStatsBtn.addEventListener('click', () => {
        loadStatistics();
    });

    resetStatsBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
            await resetStatistics();
        }
    });
    
    // Load initial statistics
    loadStatistics();
}

function addCategory(name = '', description = '') {
    const categoryId = Date.now().toString();
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.setAttribute('data-id', categoryId);
    
    categoryItem.innerHTML = `
        <button class="remove-category" data-category-id="${categoryId}">×</button>
        <input type="text" placeholder="Category Name" value="${name}" class="category-name">
        <textarea placeholder="Category Description" class="category-description">${description}</textarea>
    `;
    
    categoriesList.appendChild(categoryItem);
    
    // Focus on the name input if it's a new category
    if (!name) {
        categoryItem.querySelector('.category-name').focus();
    }
}

function removeCategory(categoryId) {
    const categoryItem = document.querySelector(`[data-id="${categoryId}"]`);
    if (categoryItem) {
        categoryItem.remove();
    }
}

async function saveCategories() {
    const categoryItems = document.querySelectorAll('.category-item');
    const categories = [];
    
    categoryItems.forEach(item => {
        const name = item.querySelector('.category-name').value.trim();
        const description = item.querySelector('.category-description').value.trim();
        
        if (name) {
            categories.push({
                id: item.getAttribute('data-id'),
                name,
                description
            });
        }
    });
    
    try {
        await chrome.storage.sync.set({ categories });
        showSuccessMessage('Categories saved successfully!');
    } catch (error) {
        console.error('Error saving categories:', error);
        alert('Error saving categories. Please try again.');
    }
}

// Load saved data
async function loadSavedData() {
    try {
        const result = await chrome.storage.sync.get(['llmConfig', 'categories']);
        
        // Load LLM configuration
        if (result.llmConfig) {
            const { provider, config } = result.llmConfig;
            llmProviderSelect.value = provider;
            
            // Trigger provider switch
            llmProviderSelect.dispatchEvent(new Event('change'));
            
            // Fill in the configuration values
            switch (provider) {
                case 'ollama':
                    if (config.url) document.getElementById('ollama-url').value = config.url;
                    if (config.model) document.getElementById('ollama-model').value = config.model;
                    break;
                case 'gemini':
                    if (config.apiKey) document.getElementById('gemini-api-key').value = config.apiKey;
                    if (config.model) document.getElementById('gemini-model').value = config.model;
                    break;
                case 'openai':
                    if (config.apiKey) document.getElementById('openai-api-key').value = config.apiKey;
                    if (config.model) document.getElementById('openai-model').value = config.model;
                    if (config.organization) document.getElementById('openai-org').value = config.organization;
                    break;
            }
        }
        
        // Load categories
        if (result.categories && result.categories.length > 0) {
            result.categories.forEach(category => {
                addCategory(category.name, category.description);
            });
        } else {
            // Add default categories for LinkedIn
            addDefaultCategories();
        }
        
        // Load statistics
        loadStatistics();
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

function showEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = 'No categories added yet. Click "Add Category" to get started.';
    categoriesList.appendChild(emptyState);
}

function addDefaultCategories() {
    // Add common LinkedIn post categories
    const defaultCategories = [
        { name: 'Technology', description: 'Tech news, software development, AI, programming, and digital trends' },
        { name: 'Career', description: 'Job opportunities, career advice, professional development, and workplace tips' },
        { name: 'Business', description: 'Business news, entrepreneurship, company updates, and market insights' },
        { name: 'Industry News', description: 'Industry-specific news, trends, and updates' },
        { name: 'Personal', description: 'Personal stories, achievements, and life updates' },
        { name: 'Education', description: 'Learning resources, courses, certifications, and educational content' },
        { name: 'Networking', description: 'Professional networking, events, and connection opportunities' },
        { name: 'Thought Leadership', description: 'Opinion pieces, insights, and expert commentary' }
    ];

    defaultCategories.forEach(category => {
        addCategory(category.name, category.description);
    });
}

function showSuccessMessage(message) {
    // Remove existing success messages
    const existingMessages = document.querySelectorAll('.success-message');
    existingMessages.forEach(msg => msg.remove());
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message show';
    successDiv.textContent = message;
    
    // Insert at the top of the active tab
    const activeTab = document.querySelector('.tab-content.active');
    activeTab.insertBefore(successDiv, activeTab.firstChild);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.classList.remove('show');
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

// Check if we're on LinkedIn and show status
async function checkLinkedInStatus() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url && tab.url.includes('linkedin.com')) {
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = 'Active on LinkedIn';
        } else {
            statusIndicator.className = 'status-indicator inactive';
            statusText.textContent = 'Not on LinkedIn';
        }
    } catch (error) {
        console.error('Error checking LinkedIn status:', error);
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Status unknown';
    }
}

// Load and display statistics
async function loadStatistics() {
    try {
        const result = await chrome.storage.sync.get(['linkedlensStats']);
        const stats = result.linkedlensStats || { postsProcessed: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
        
        postsProcessedEl.textContent = stats.postsProcessed || 0;
        llmCallsEl.textContent = stats.llmCalls || 0;
        inputTokensEl.textContent = stats.inputTokens || 0;
        outputTokensEl.textContent = stats.outputTokens || 0;
    } catch (error) {
        console.error('Error loading statistics:', error);
        postsProcessedEl.textContent = 'Error';
        llmCallsEl.textContent = 'Error';
        inputTokensEl.textContent = 'Error';
        outputTokensEl.textContent = 'Error';
    }
}

// Reset all statistics
async function resetStatistics() {
    try {
        const resetStats = { postsProcessed: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
        await chrome.storage.sync.set({ linkedlensStats: resetStats });
        
        postsProcessedEl.textContent = '0';
        llmCallsEl.textContent = '0';
        inputTokensEl.textContent = '0';
        outputTokensEl.textContent = '0';
        
        showSuccessMessage('Statistics reset successfully!');
    } catch (error) {
        console.error('Error resetting statistics:', error);
        alert('Error resetting statistics. Please try again.');
    }
}

// Listen for storage changes to update statistics in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.linkedlensStats) {
        loadStatistics();
    }
});
