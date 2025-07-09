// Background script for LinkedLens Chrome Extension

// Import LLM utilities
importScripts('llm-utils.js');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedLens extension installed');
});

// Function to get LLM configuration
async function getLLMConfig() {
    try {
        const result = await chrome.storage.sync.get(['llmConfig']);
        return result.llmConfig || null;
    } catch (error) {
        console.error('Error getting LLM config:', error);
        return null;
    }
}

// Function to get categories
async function getCategories() {
    try {
        const result = await chrome.storage.sync.get(['categories']);
        return result.categories || [];
    } catch (error) {
        console.error('Error getting categories:', error);
        return [];
    }
}

// Function to make LLM API call
async function makeAPICall(prompt, context = '') {
    const llmConfig = await getLLMConfig();
    
    if (!llmConfig) {
        throw new Error('LLM configuration not found. Please configure in the popup.');
    }
    
    const { provider, config } = llmConfig;
    
    switch (provider) {
        case 'ollama':
            return await callOllama(prompt, context, config);
        case 'gemini':
            return await callGemini(prompt, context, config);
        case 'openai':
            return await callOpenAI(prompt, context, config);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

// Ollama API call
async function callOllama(prompt, context, config) {
    const { url, model } = config;
    
    if (!model) {
        throw new Error('Ollama model not configured');
    }
    
    const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: context ? `Context: ${context}\n\nPrompt: ${prompt}` : prompt,
            stream: false
        })
    });
    
    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
}

// Gemini API call
async function callGemini(prompt, context, config) {
    const { apiKey, model } = config;
    
    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: context ? `Context: ${context}\n\nPrompt: ${prompt}` : prompt
                }]
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// OpenAI API call
async function callOpenAI(prompt, context, config) {
    const { apiKey, model, organization } = config;
    
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    
    if (organization) {
        headers['OpenAI-Organization'] = organization;
    }
    
    const messages = [
        {
            role: 'user',
            content: context ? `Context: ${context}\n\nPrompt: ${prompt}` : prompt
        }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}
