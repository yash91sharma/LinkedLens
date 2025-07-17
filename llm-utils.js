// LLM Utilities for LinkedLens Extension
// This file contains helper functions for making calls to different LLM providers

class LLMHelper {
    /**
     * Make a call to the currently configured LLM provider
     * @param {string} systemPrompt - The system prompt to use
     * @param {string} userPrompt - The user prompt/message
     * @returns {Promise<string>} - The LLM response
     */
    static async callLLM(systemPrompt, userPrompt) {
        try {
            const result = await chrome.storage.sync.get(['llmConfig']);
            if (!result.llmConfig) {
                throw new Error('No LLM configuration found. Please configure an LLM provider first.');
            }

            const { provider, config } = result.llmConfig;
            
            // Track LLM call
            await this.trackLLMCall();

            let response;
            switch (provider) {
                case 'ollama':
                    response = await this.callOllama(config, systemPrompt, userPrompt);
                    break;
                case 'gemini':
                    response = await this.callGemini(config, systemPrompt, userPrompt);
                    break;
                case 'openai':
                    response = await this.callOpenAI(config, systemPrompt, userPrompt);
                    break;
                default:
                    throw new Error(`Unsupported LLM provider: ${provider}`);
            }
            
            return response;
        } catch (error) {
            console.error('Error calling LLM:', error);
            throw error;
        }
    }

    /**
     * Make a call to Ollama
     * @param {Object} config - Ollama configuration
     * @param {string} systemPrompt - The system prompt
     * @param {string} userPrompt - The user prompt
     * @returns {Promise<string>} - The response
     */
    static async callOllama(config, systemPrompt, userPrompt) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: 'callOllama',
                    config,
                    systemPrompt,
                    userPrompt
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                    }
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error));
                    }
                }
            );
        });
    }

    /**
     * Make a call to Gemini API
     * @param {Object} config - Gemini configuration
     * @param {string} systemPrompt - The system prompt
     * @param {string} userPrompt - The user prompt
     * @returns {Promise<string>} - The response
     */
    static async callGemini(config, systemPrompt, userPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        
        // Gemini combines system and user prompts
        const combinedPrompt = `${systemPrompt}\n\nUser: ${userPrompt}`;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: combinedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH", 
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    /**
     * Make a call to OpenAI API
     * @param {Object} config - OpenAI configuration
     * @param {string} systemPrompt - The system prompt
     * @param {string} userPrompt - The user prompt
     * @returns {Promise<string>} - The response
     */
    static async callOpenAI(config, systemPrompt, userPrompt) {
        const url = 'https://api.openai.com/v1/chat/completions';
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        // Add organization header if provided
        if (config.organization) {
            headers['OpenAI-Organization'] = config.organization;
        }

        const requestBody = {
            model: config.model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user", 
                    content: userPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2048
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Track token usage if available
        if (data.usage) {
            await this.trackTokenUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0);
        }
        
        return data.choices?.[0]?.message?.content || '';
    }

    /**
     * Test the current LLM configuration
     * @returns {Promise<boolean>} - Whether the test was successful
     */
    static async testConnection() {
        try {
            const response = await this.callLLM(
                "You are a helpful assistant. Respond briefly.",
                "Hello, please respond with 'Connection test successful' to confirm the API is working."
            );
            return response.toLowerCase().includes('connection test successful') || response.length > 0;
        } catch (error) {
            console.error('LLM connection test failed:', error);
            return false;
        }
    }

    /**
     * Get the current LLM configuration
     * @returns {Promise<Object|null>} - The current LLM configuration or null if not set
     */
    static async getLLMConfig() {
        try {
            const result = await chrome.storage.sync.get(['llmConfig']);
            return result.llmConfig || null;
        } catch (error) {
            console.error('Error getting LLM config:', error);
            return null;
        }
    }

    /**
     * Check if LLM is configured and ready to use
     * @returns {Promise<boolean>} - Whether LLM is configured
     */
    static async isConfigured() {
        const config = await this.getLLMConfig();
        if (!config) return false;

        const { provider, config: providerConfig } = config;
        
        switch (provider) {
            case 'ollama':
                return !!(providerConfig.url && providerConfig.model);
            case 'gemini':
                return !!(providerConfig.apiKey && providerConfig.model);
            case 'openai':
                return !!(providerConfig.apiKey && providerConfig.model);
            default:
                return false;
        }
    }

    /**
     * Track an LLM call in statistics
     */
    static async trackLLMCall() {
        try {
            const result = await chrome.storage.sync.get(['linkedlensStats']);
            const stats = result.linkedlensStats || { postsProcessed: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
            
            stats.llmCalls = (stats.llmCalls || 0) + 1;
            
            await chrome.storage.sync.set({ linkedlensStats: stats });
        } catch (error) {
            console.error('Error tracking LLM call:', error);
        }
    }

    /**
     * Track token usage in statistics
     * @param {number} inputTokens - Number of input tokens used
     * @param {number} outputTokens - Number of output tokens used
     */
    static async trackTokenUsage(inputTokens, outputTokens) {
        try {
            const result = await chrome.storage.sync.get(['linkedlensStats']);
            const stats = result.linkedlensStats || { postsProcessed: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
            
            stats.inputTokens = (stats.inputTokens || 0) + inputTokens;
            stats.outputTokens = (stats.outputTokens || 0) + outputTokens;
            
            await chrome.storage.sync.set({ linkedlensStats: stats });
        } catch (error) {
            console.error('Error tracking token usage:', error);
        }
    }

    /**
     * Track a processed post in statistics
     */
    static async trackProcessedPost() {
        try {
            const result = await chrome.storage.sync.get(['linkedlensStats']);
            const stats = result.linkedlensStats || { postsProcessed: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
            
            stats.postsProcessed = (stats.postsProcessed || 0) + 1;
            
            await chrome.storage.sync.set({ linkedlensStats: stats });
        } catch (error) {
            console.error('Error tracking processed post:', error);
        }
    }
}

// Make LLMHelper available globally
if (typeof window !== 'undefined') {
    window.LLMHelper = LLMHelper;
}

// For Chrome extension environment
if (typeof globalThis !== 'undefined') {
    globalThis.LLMHelper = LLMHelper;
}
