// Example usage of LLM Helper Functions in LinkedLens Extension

/**
 * Examples of how to use the LLMHelper class for making LLM calls
 */

// Example 1: Basic LLM call
async function exampleBasicCall() {
    try {
        const systemPrompt = "You are a helpful assistant that analyzes web content.";
        const userPrompt = "Analyze this text and provide a brief summary.";
        
        const response = await LLMHelper.callLLM(systemPrompt, userPrompt);
        console.log('LLM Response:', response);
    } catch (error) {
        console.error('Error calling LLM:', error);
    }
}

// Example 2: Content categorization
async function exampleCategorizeContent(content) {
    try {
        const systemPrompt = `You are a content categorization assistant. 
        Analyze the provided content and categorize it into one of these categories:
        - Technology
        - Business
        - Science
        - Entertainment
        - Sports
        - Politics
        - Health
        - Other
        
        Respond with just the category name.`;
        
        const userPrompt = `Please categorize this content: ${content}`;
        
        const category = await LLMHelper.callLLM(systemPrompt, userPrompt);
        return category.trim();
    } catch (error) {
        console.error('Error categorizing content:', error);
        return 'Other';
    }
}

// Example 3: Content analysis for LinkedIn posts
async function exampleAnalyzeLinkedInPost(postContent) {
    try {
        const systemPrompt = `You are a professional LinkedIn content analyst. 
        Analyze the provided LinkedIn post and provide insights including:
        1. Main topic/theme
        2. Professional relevance score (1-10)
        3. Key insights or takeaways
        4. Suggested engagement level (High/Medium/Low)
        
        Format your response as JSON.`;
        
        const userPrompt = `Analyze this LinkedIn post: ${postContent}`;
        
        const analysis = await LLMHelper.callLLM(systemPrompt, userPrompt);
        return JSON.parse(analysis);
    } catch (error) {
        console.error('Error analyzing LinkedIn post:', error);
        return null;
    }
}

// Example 4: Check if LLM is configured before making calls
async function exampleWithConfigCheck() {
    const isConfigured = await LLMHelper.isConfigured();
    
    if (!isConfigured) {
        console.log('LLM is not configured. Please set up your LLM provider first.');
        return;
    }
    
    try {
        const response = await LLMHelper.callLLM(
            "You are a helpful assistant.",
            "Hello! How are you?"
        );
        console.log('Response:', response);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 5: Test connection
async function exampleTestConnection() {
    try {
        const isWorking = await LLMHelper.testConnection();
        console.log('LLM connection test:', isWorking ? 'SUCCESS' : 'FAILED');
    } catch (error) {
        console.error('Connection test error:', error);
    }
}

// Example 6: Content script usage
function exampleContentScriptUsage() {
    // This would be used in content.js
    
    // Get page content
    const pageTitle = document.title;
    const pageContent = document.body.innerText.substring(0, 1000); // First 1000 chars
    
    // Analyze the content
    LLMHelper.callLLM(
        "You are a web content analyzer. Provide a brief summary of the webpage content.",
        `Title: ${pageTitle}\nContent: ${pageContent}`
    ).then(summary => {
        console.log('Page summary:', summary);
        // You could display this in a popup or send to background script
    }).catch(error => {
        console.error('Error analyzing page:', error);
    });
}

// Example 7: Background script usage
function exampleBackgroundScriptUsage() {
    // This would be used in background.js
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'analyzeContent') {
            LLMHelper.callLLM(
                request.systemPrompt || "You are a helpful assistant.",
                request.userPrompt
            ).then(response => {
                sendResponse({ success: true, data: response });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            
            // Return true to indicate async response
            return true;
        }
    });
}

// Export examples for use in other files
if (typeof window !== 'undefined') {
    window.LLMExamples = {
        exampleBasicCall,
        exampleCategorizeContent,
        exampleAnalyzeLinkedInPost,
        exampleWithConfigCheck,
        exampleTestConnection,
        exampleContentScriptUsage,
        exampleBackgroundScriptUsage
    };
}
