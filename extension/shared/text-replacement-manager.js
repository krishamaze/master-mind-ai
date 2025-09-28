export default class TextReplacementManager {
    static getText(element) {
        console.log('📖 TextReplacementManager: Getting text from', element?.tagName);
        
        if (!element) return '';

        if (element.tagName === 'TEXTAREA') {
            const text = element.value || '';
            console.log('📖 TEXTAREA text:', text.substring(0, 50));
            return text;
        } else if (element.contentEditable === 'true') {
            // Try ChatGPT specific structure first
            const paragraph = element.querySelector('p[dir="ltr"]');
            if (paragraph) {
                let text = '';
                paragraph.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent || '';
                    } else if (node.tagName === 'SPAN' && node.getAttribute('data-lexical-text')) {
                        text += node.textContent || '';
                    } else if (node.tagName === 'BR') {
                        text += '\n';
                    }
                });
                console.log('📖 ContentEditable (specific) text:', text.substring(0, 50));
                return text;
            }
            
            // Fallback to general contentEditable
            const text = element.textContent || '';
            console.log('📖 ContentEditable (general) text:', text.substring(0, 50));
            return text;
        }

        const text = element.textContent || element.value || '';
        console.log('📖 Generic text:', text.substring(0, 50));
        return text;
    }

    static async setText(element, text) {
        console.log('✏️ TextReplacementManager: Setting text on', element?.tagName);
        console.log('✏️ New text length:', text?.length);
        
        if (!element || !text) {
            console.warn('❌ Missing element or text');
            return false;
        }

        if (element.tagName === 'TEXTAREA') {
            return this._setTextareaText(element, text);
        } else if (element.contentEditable === 'true') {
            return await this._setContentEditableText(element, text);
        } else {
            return this._setGenericText(element, text);
        }
    }

    static _setTextareaText(element, text) {
        console.log('📝 Setting textarea text');
        try {
            element.focus();
            element.select();
            element.value = text;
            
            // Trigger all necessary events
            this._triggerEvents(element, ['input', 'change']);
            
            // Verify it worked
            const success = element.value === text;
            console.log(success ? '✅ Textarea text set successfully' : '❌ Textarea text set failed');
            return success;
        } catch (error) {
            console.error('❌ Textarea setText error:', error);
            return false;
        }
    }

    static async _setContentEditableText(element, text) {
        console.log('📝 Setting contentEditable text');
        
        // Strategy 1: Direct manipulation (fastest)
        if (await this._tryDirectContentEditableSet(element, text)) {
            return true;
        }
        
        // Strategy 2: Clipboard + verification (most reliable)
        if (await this._tryClipboardContentEditableSet(element, text)) {
            return true;
        }
        
        // Strategy 3: Manual clipboard copy (fallback)
        return await this._fallbackClipboardCopy(text);
    }

    static async _tryDirectContentEditableSet(element, text) {
        console.log('🔄 Trying direct contentEditable replacement');
        
        try {
            element.focus();
            
            // Clear existing content
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Try different direct methods
            const methods = [
                () => {
                    // Method 1: execCommand insertText (works with undo/redo)
                    document.execCommand('insertText', false, text);
                },
                () => {
                    // Method 2: Replace selection content
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(text));
                    }
                },
                () => {
                    // Method 3: Direct DOM manipulation
                    element.textContent = text;
                }
            ];
            
            for (const method of methods) {
                try {
                    method();
                    this._triggerEvents(element, ['input', 'change']);
                    
                    // Small delay for DOM to update
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    if (this._verifyTextSet(element, text)) {
                        console.log('✅ Direct contentEditable method worked');
                        return true;
                    }
                } catch (methodError) {
                    console.log('⚠️ Direct method failed:', methodError.message);
                }
            }
            
            console.log('❌ All direct methods failed');
            return false;
            
        } catch (error) {
            console.error('❌ Direct contentEditable error:', error);
            return false;
        }
    }

    static async _tryClipboardContentEditableSet(element, text) {
        console.log('📋 Trying clipboard + paste for contentEditable');
        
        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(text);
            console.log('✅ Text copied to clipboard');
            
            // Focus and select all
            element.focus();
            document.execCommand('selectAll', false, null);
            
            // Create and dispatch paste event
            const pasteSuccess = await this._dispatchPasteEvent(element, text);
            
            if (pasteSuccess) {
                console.log('✅ Clipboard paste method worked');
                return true;
            }
            
            // Fallback: try execCommand paste
            console.log('🔄 Trying execCommand paste fallback');
            const execSuccess = document.execCommand('paste');
            
            if (execSuccess) {
                // Wait for paste to complete
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (this._verifyTextSet(element, text)) {
                    console.log('✅ execCommand paste worked');
                    return true;
                }
            }
            
            console.log('❌ Clipboard methods failed');
            return false;
            
        } catch (error) {
            console.error('❌ Clipboard contentEditable error:', error);
            return false;
        }
    }

    static async _dispatchPasteEvent(element, text) {
        try {
            // Create clipboard data
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            
            // Create paste event
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            
            // Dispatch event
            const eventResult = element.dispatchEvent(pasteEvent);
            console.log('📋 Paste event dispatched:', eventResult);
            
            // Trigger additional events
            this._triggerEvents(element, ['input', 'change']);
            
            // Small delay for event processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return this._verifyTextSet(element, text);
            
        } catch (error) {
            console.error('❌ Paste event error:', error);
            return false;
        }
    }

    static _setGenericText(element, text) {
        console.log('📝 Setting generic element text');
        
        try {
            element.focus();
            
            if (element.value !== undefined) {
                element.value = text;
            } else {
                element.textContent = text;
            }
            
            this._triggerEvents(element, ['input', 'change']);
            
            const success = this._verifyTextSet(element, text);
            console.log(success ? '✅ Generic text set successfully' : '❌ Generic text set failed');
            return success;
            
        } catch (error) {
            console.error('❌ Generic setText error:', error);
            return false;
        }
    }

    static async _fallbackClipboardCopy(text) {
        console.log('📋 Fallback: Copying to clipboard and notifying user');
        
        try {
            await navigator.clipboard.writeText(text);
            
            // Show user notification
            this._showClipboardNotification();
            
            console.log('✅ Fallback clipboard copy successful');
            return true;
            
        } catch (error) {
            console.error('❌ Fallback clipboard copy failed:', error);
            return false;
        }
    }

    static _showClipboardNotification() {
        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = '📋 Enhanced text copied to clipboard! Press Ctrl+V to paste.';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #2196F3;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    if (style.parentNode) {
                        style.parentNode.removeChild(style);
                    }
                }, 300);
            }
        }, 4000);
    }

    static _triggerEvents(element, eventTypes) {
        eventTypes.forEach(eventType => {
            const event = new Event(eventType, {
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(event);
        });
        
        // Trigger React-specific events
        if (element._valueTracker) {
            element._valueTracker.setValue('');
        }
    }

    static _verifyTextSet(element, expectedText) {
        const currentText = this.getText(element);
        const isSet = currentText.includes(expectedText) || currentText === expectedText;
        console.log('🔍 Text verification:', isSet ? 'PASS' : 'FAIL');
        return isSet;
    }
}
