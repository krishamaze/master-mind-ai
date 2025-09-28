(async () => {
    try {
        console.log('🚀 Loading ChatGPT content script...');
        
        const [
            { default: DOMObserver },
            { getPlatformConfig },
            { default: FloatingEnhanceButton },
            { default: TextReplacementManager },
            { default: EnhancementUI },
            { getRunId },
            { getSettings }
        ] = await Promise.all([
            import(chrome.runtime.getURL('shared/dom-observer.js')),
            import(chrome.runtime.getURL('shared/platform-config.js')),
            import(chrome.runtime.getURL('shared/floating-enhance-button.js')),
            import(chrome.runtime.getURL('shared/text-replacement-manager.js')),
            import(chrome.runtime.getURL('shared/enhancement-ui.js')),
            import(chrome.runtime.getURL('shared/thread-context.js')),
            import(chrome.runtime.getURL('config.js'))
        ]);
        
        console.log('✅ All modules loaded successfully');
        
        const { platform, selectors } = getPlatformConfig('chatgpt');
        const observer = new DOMObserver(selectors);
        const ui = new EnhancementUI();
        const button = new FloatingEnhanceButton(() => handleEnhance());
        
        console.log('🔍 Platform config loaded:', platform);
        console.log('🔍 Input selectors:', selectors);
        
        async function handleEnhance() {
            console.log('🚀 Enhancement process started');
            
            // Step 1: Get target element
            const el = button.target;
            if (!el) {
                console.warn('❌ No target element found');
                ui.showError('No input field found');
                return;
            }
            console.log('✅ Target element found:', el.tagName, el.className);
            
            // Step 2: Extract text from input field
            const prompt = TextReplacementManager.getText(el);
            if (!prompt.trim()) {
                console.warn('❌ No text found in input field');
                ui.showError('No text to enhance');
                return;
            }
            console.log('📝 Text extracted from input field:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
            
            // Step 3: Show loading state
            ui.showLoading();
            console.log('⏳ Loading state shown');
            
            // Step 4: Prepare message for background script
            const message = { 
                type: 'enhance', 
                prompt: prompt.trim() 
            };
            
            try {
                // Step 5: Get settings and validate mandatory fields
                const { appId, userId } = await getSettings();
                console.log('⚙️ Settings loaded:');
                console.log('  - userId:', userId ? `"${userId}"` : 'NOT SET');
                console.log('  - appId:', appId ? `"${appId}"` : 'NOT SET');
                
                // Validate mandatory user_id
                if (!userId) {
                    console.error('❌ MANDATORY FIELD MISSING: user_id not configured');
                    ui.hide();
                    ui.showError('User ID is required. Please configure it in the extension popup.');
                    return;
                }
                
                // Validate mandatory app_id
                if (!appId) {
                    console.error('❌ MANDATORY FIELD MISSING: app_id not configured');
                    ui.hide();
                    ui.showError('App ID is required. Please configure it in the extension popup.');
                    return;
                }
                
                // Add mandatory fields to message
                message.user_id = userId;
                message.app_id = appId;
                console.log('✅ Mandatory fields added to message');
                console.log('  - user_id:', message.user_id);
                console.log('  - app_id:', message.app_id);
                
                // Note: run_id is NOT added for enhancement (we want broader app-wide context)
                console.log('ℹ️ run_id excluded for broader context search');
                
            } catch (settingsError) {
                console.error('❌ Failed to load settings:', settingsError);
                ui.hide();
                ui.showError('Failed to load extension settings. Please try again.');
                return;
            }
            
            console.log('📨 Sending message to background script:', {
                type: message.type,
                prompt: message.prompt.substring(0, 50) + '...',
                user_id: message.user_id,
                app_id: message.app_id
            });
            
            // Step 6: Send message to background script
            return new Promise(resolve => {
                chrome.runtime.sendMessage(message, response => {
                    console.log('📥 Response received from background script');
                    console.log('📋 Response details:', response);
                    
                    // Hide loading state
                    ui.hide();
                    
                    // Step 7: Handle response
                    if (!response) {
                        console.error('❌ No response received from background script');
                        ui.showError('No response from background script. Please try again.');
                        return resolve();
                    }
                    
                    if (!response.success) {
                        console.error('❌ Enhancement failed:', response.error);
                        ui.showError(`Enhancement failed: ${response.error || 'Unknown error'}`);
                        return resolve();
                    }
                    
                    // Step 8: Extract enhanced prompt from response
                    const enhanced = 
                        response?.data?.enhanced_prompt ??
                        response?.data?.enhancedprompt ??
                        response?.enhanced_prompt ??
                        response?.enhancedprompt;
                    
                    if (!enhanced) {
                        console.error('❌ No enhanced prompt in response data');
                        console.error('📋 Available response keys:', Object.keys(response.data || {}));
                        ui.showError('No enhanced prompt received. Please try again.');
                        return resolve();
                    }
                    
                    console.log('✅ Enhanced prompt received:');
                    console.log('  - Original length:', prompt.length, 'chars');
                    console.log('  - Enhanced length:', enhanced.length, 'chars');
                    console.log('  - Enhanced preview:', enhanced.substring(0, 150) + (enhanced.length > 150 ? '...' : ''));
                    
                    // Step 9: Replace text in input field
                    try {
                        TextReplacementManager.setText(el, enhanced);
                        console.log('✅ Text successfully replaced in input field');
                        
                        // Optional: Show brief success feedback
                        setTimeout(() => {
                            console.log('🎉 Enhancement process completed successfully');
                        }, 100);
                        
                    } catch (replaceError) {
                        console.error('❌ Failed to replace text in input field:', replaceError);
                        ui.showError('Failed to replace text in input field.');
                    }
                    
                    resolve();
                });
            });
        }
        
        // Step 10: Set up input field detection and button attachment
        observer.subscribe('input-detection', elements => {
            console.log('📝 Input elements detected:', elements.length);
            console.log('📝 Element details:', elements.map(el => ({
                tag: el.tagName,
                type: el.type,
                className: el.className,
                id: el.id
            })));
            
            elements.forEach((el, index) => {
                if (!el.dataset.mmEnhanceBound) {
                    el.dataset.mmEnhanceBound = 'true';
                    button.attach(el);
                    console.log(`🎯 Enhance button attached to element ${index + 1}:`, {
                        tag: el.tagName,
                        type: el.type,
                        className: el.className
                    });
                } else {
                    console.log(`🔄 Element ${index + 1} already has enhance button bound`);
                }
            });
        });
        
        // Step 11: Start observing for input fields
        observer.start();
        console.log('👀 DOM Observer started - watching for input fields');
        console.log('🔍 Observer will detect elements matching:', selectors);
        
        // Step 12: Log successful initialization
        console.log('🎉 ChatGPT content script initialized successfully');
        console.log('📋 Script features:');
        console.log('  ✅ DOM observation for input fields');
        console.log('  ✅ Floating enhance button attachment');
        console.log('  ✅ Mandatory field validation (user_id, app_id)');
        console.log('  ✅ Background script communication');
        console.log('  ✅ Text replacement in input fields');
        console.log('  ✅ Comprehensive error handling');
        console.log('  ✅ App-wide context search (no run_id)');
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR in ChatGPT content script initialization:', error);
        console.error('📋 Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // Try to show error to user if possible
        try {
            const ui = new EnhancementUI();
            ui.showError('Extension failed to initialize. Please reload the page.');
        } catch (uiError) {
            console.error('❌ Could not show error UI:', uiError);
        }
    }
})();
