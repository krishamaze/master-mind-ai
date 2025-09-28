import { ENVIRONMENTS, getSettings, setSettings } from './config.js';
import { apiClient } from './api.js';

// === DOM ELEMENTS ===
const popupRootEl = document.getElementById('popup-root');
const envEl = document.getElementById('environment');
const assignmentEl = document.getElementById('assignment-select');
const assignmentLoadingEl = document.getElementById('assignment-loading');
const userIdEl = document.getElementById('userId');
const statusEl = document.getElementById('status');
const connectionEl = document.getElementById('connection');
const submitBtn = document.getElementById('submit');
const newAssignmentContainer = document.getElementById('new-assignment-container');
const newAssignmentInput = document.getElementById('new-assignment-name');
const newAssignmentFeedback = document.getElementById('new-assignment-feedback');
const globalErrorAnnouncer = document.getElementById('global-error-announcer');
const userIdSavedIcon = document.getElementById('userId-saved');
const userIdEditIcon = document.getElementById('userId-edit');

// === CONSTANTS ===
const ADD_NEW_ASSIGNMENT_OPTION = 'NEW';
const CACHE_VERSION = '1.0';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// === STATE MANAGEMENT ===
let isSubmitting = false;
let statusTimeoutId = null;

const state = {
    userIdLocked: false,     // User ID saved and locked
    appIdLocked: false,      // App ID selected and locked
    setupComplete: false,    // Both user ID and app ID saved permanently
    currentUserId: '',       // Current user ID value
    currentAppId: ''         // Current app ID value
};

// === CACHE MANAGEMENT ===
class CacheManager {
    static getKey(userId, type = 'apps') {
        return `mastermind_${type}_${userId}_v${CACHE_VERSION}`;
    }

    static async get(userId, type = 'apps') {
        try {
            const key = this.getKey(userId, type);
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();
            
            // Check if cache is expired (24 hours)
            if (data.timestamp && (now - data.timestamp) > (24 * 60 * 60 * 1000)) {
                this.clear(userId, type);
                return null;
            }

            console.log(`📦 CACHE: Retrieved ${type} for ${userId}:`, data.value);
            return data.value;
        } catch (error) {
            console.error('🚨 CACHE: Error reading cache:', error);
            this.clear(userId, type);
            return null;
        }
    }

    static async set(userId, value, type = 'apps') {
        try {
            const key = this.getKey(userId, type);
            const data = {
                value,
                timestamp: Date.now(),
                version: CACHE_VERSION
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`💾 CACHE: Saved ${type} for ${userId}:`, value);
        } catch (error) {
            console.error('🚨 CACHE: Error writing cache:', error);
            // Clear space and try again
            this.clearOldCaches();
            try {
                const key = this.getKey(userId, type);
                const data = { value, timestamp: Date.now(), version: CACHE_VERSION };
                localStorage.setItem(key, JSON.stringify(data));
            } catch (retryError) {
                console.error('🚨 CACHE: Retry failed:', retryError);
            }
        }
    }

    static clear(userId, type = 'apps') {
        try {
            const key = this.getKey(userId, type);
            localStorage.removeItem(key);
            console.log(`🗑️ CACHE: Cleared ${type} for ${userId}`);
        } catch (error) {
            console.error('🚨 CACHE: Error clearing cache:', error);
        }
    }

    static clearOldCaches() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('mastermind_') && !key.includes(`_v${CACHE_VERSION}`)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`🗑️ CACHE: Cleared ${keysToRemove.length} old cache entries`);
        } catch (error) {
            console.error('🚨 CACHE: Error clearing old caches:', error);
        }
    }
}

// === PERSISTENT STATE MANAGEMENT ===
class StateManager {
    static async save(userId, appId) {
        try {
            await setSettings({ 
                environment: envEl?.value || 'production', 
                userId: userId || '', 
                appId: appId || ''
            });
            console.log('💾 STATE: Saved setup state:', { userId, appId });
        } catch (error) {
            console.error('🚨 STATE: Error saving:', error);
            throw new Error('Failed to save setup state');
        }
    }

    static async clear() {
        try {
            await setSettings({ 
                environment: envEl?.value || 'production', 
                userId: '', 
                appId: '' 
            });
            console.log('🗑️ STATE: Cleared setup state');
        } catch (error) {
            console.error('🚨 STATE: Error clearing:', error);
        }
    }

    static async load() {
        try {
            const settings = await getSettings();
            console.log('📥 STATE: Loaded settings:', settings);
            return settings;
        } catch (error) {
            console.error('🚨 STATE: Error loading:', error);
            return { environment: 'production', userId: '', appId: '' };
        }
    }
}

// === VALIDATION UTILITIES ===
class Validator {
    static validateUserId(userId) {
        const normalized = (userId || '').trim();
        
        if (normalized.length === 0) {
            return { valid: false, message: 'User ID is required.', normalized };
        }
        if (normalized.length < 3) {
            return { valid: false, message: 'User ID must be at least 3 characters.', normalized };
        }
        if (normalized.length > 50) {
            return { valid: false, message: 'User ID must be less than 50 characters.', normalized };
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
            return { valid: false, message: 'User ID can only contain letters, numbers, hyphens, and underscores.', normalized };
        }
        
        return { valid: true, message: '', normalized };
    }

    static validateAssignmentName(name) {
        const normalized = (name || '').trim();
        
        if (normalized.length === 0) {
            return { valid: false, message: 'App ID is required.', normalized };
        }
        if (normalized.length < 3) {
            return { valid: false, message: 'App ID must be at least 3 characters.', normalized };
        }
        if (normalized.length > 50) {
            return { valid: false, message: 'App ID must be less than 50 characters.', normalized };
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
            return { valid: false, message: 'App ID can only contain letters, numbers, hyphens, and underscores.', normalized };
        }
        
        return { valid: true, message: '', normalized };
    }
}

// === ERROR HANDLING ===
class ErrorHandler {
    static getFriendlyMessage(error, fallback = 'An unexpected error occurred') {
        if (!error) return fallback;
        
        if (error.response) {
            switch (error.response.status) {
                case 400: return 'Invalid request. Please check your input.';
                case 401: return 'Authentication failed. Please check your credentials.';
                case 403: return 'Access denied. Please check your permissions.';
                case 404: return 'Service not found. Please check your environment settings.';
                case 429: return 'Too many requests. Please wait a moment and try again.';
                case 500: return 'Server error. Please try again in a moment.';
                case 502:
                case 503:
                case 504: return 'Service temporarily unavailable. Please try again.';
            }
        }
        
        if (typeof error === 'string') {
            if (error.toLowerCase().includes('network')) return 'Network error. Please check your connection.';
            if (error.toLowerCase().includes('timeout')) return 'Request timed out. Please try again.';
            if (error.toLowerCase().includes('fetch')) return 'Unable to connect. Please check your network.';
        }
        
        if (error.message) {
            if (error.message.includes('Failed to fetch')) return 'Unable to connect to the server. Please check your network connection.';
            if (error.message.includes('NetworkError')) return 'Network error. Please check your connection.';
        }
        
        return fallback;
    }
}

// === UI MANAGEMENT ===
function setError(message) {
    if (globalErrorAnnouncer) {
        globalErrorAnnouncer.textContent = message || '';
        globalErrorAnnouncer.hidden = !message;
        globalErrorAnnouncer.setAttribute('aria-live', 'assertive');
    }
}

function setStatus(message, isError = false, options = {}) {
    if (!statusEl) return;
    
    // Clear existing timeout
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }
    
    statusEl.textContent = message || '';
    statusEl.classList.toggle('error', isError);
    statusEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    
    // Auto-clear non-persistent, non-error messages
    if (!options.persist && message && !isError) {
        statusTimeoutId = setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
            }
            statusTimeoutId = null;
        }, 5000);
    }
}

function updateConnection() {
    if (!connectionEl || !envEl) return;
    
    try {
        const environment = envEl.value || 'production';
        const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
        connectionEl.textContent = baseUrl;
    } catch (error) {
        console.error('🚨 UI: Error updating connection:', error);
        connectionEl.textContent = 'Connection error';
    }
}

function updateUserIdIcons() {
    if (!userIdSavedIcon || !userIdEditIcon) return;
    
    try {
        if (state.userIdLocked) {
            // User ID is locked - show edit icon ✏️
            userIdSavedIcon.hidden = true;
            userIdEditIcon.hidden = false;
            userIdEditIcon.setAttribute('title', 'Edit User ID');
            userIdEditIcon.setAttribute('aria-label', 'Edit User ID');
            // Remove aria-hidden to fix accessibility
            userIdSavedIcon.removeAttribute('aria-hidden');
            userIdEditIcon.removeAttribute('aria-hidden');
        } else {
            // User ID is editable - show save icon ✅
            userIdSavedIcon.hidden = false;
            userIdEditIcon.hidden = true;
            userIdSavedIcon.setAttribute('title', 'Save User ID');
            userIdSavedIcon.setAttribute('aria-label', 'Save User ID');
            // Remove aria-hidden to fix accessibility
            userIdSavedIcon.removeAttribute('aria-hidden');
            userIdEditIcon.removeAttribute('aria-hidden');
        }
    } catch (error) {
        console.error('🚨 UI: Error updating user ID icons:', error);
    }
}

function updateSubmitButton() {
    if (!submitBtn) return;
    
    try {
        const { valid } = Validator.validateUserId(userIdEl?.value);
        
        if (isSubmitting) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            submitBtn.setAttribute('aria-busy', 'true');
            return;
        }
        
        submitBtn.setAttribute('aria-busy', 'false');
        
        if (state.setupComplete) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Setup Complete';
            submitBtn.setAttribute('title', 'Setup is complete');
            return;
        }
        
        if (!state.userIdLocked) {
            submitBtn.disabled = !valid;
            submitBtn.textContent = 'Save User ID';
            submitBtn.setAttribute('title', valid ? 'Save User ID and load apps' : 'Enter a valid User ID');
            return;
        }
        
        // User ID locked, working on app selection
        const selection = getAppSelectionState();
        submitBtn.disabled = !selection.ready;
        submitBtn.textContent = 'Complete Setup';
        submitBtn.setAttribute('title', selection.ready ? 'Complete setup and save configuration' : 'Select an App ID first');
        
    } catch (error) {
        console.error('🚨 UI: Error updating submit button:', error);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Error';
    }
}

function toggleAssignmentLoading(isLoading) {
    if (assignmentLoadingEl) {
        assignmentLoadingEl.hidden = !isLoading;
        assignmentLoadingEl.setAttribute('aria-busy', isLoading.toString());
    }
    if (assignmentEl) {
        assignmentEl.setAttribute('aria-busy', isLoading.toString());
    }
}

// === APP MANAGEMENT ===
function getAppSelectionState() {
    if (!assignmentEl || assignmentEl.disabled) {
        return { ready: false, isNew: false, appId: null };
    }

    const selectedValue = assignmentEl.value;
    if (!selectedValue) {
        return { ready: false, isNew: false, appId: null };
    }

    const isNew = selectedValue === ADD_NEW_ASSIGNMENT_OPTION;
    if (isNew) {
        const newName = newAssignmentInput?.value?.trim() ?? '';
        const { valid, normalized } = Validator.validateAssignmentName(newName);
        return { ready: valid, isNew: true, appId: normalized };
    }

    return { ready: true, isNew: false, appId: selectedValue };
}

function clearAppSelections() {
    try {
        if (assignmentEl) {
            assignmentEl.innerHTML = '';
            assignmentEl.disabled = true;
            assignmentEl.setAttribute('aria-describedby', '');
        }
        hideNewAssignmentInput();
        state.appIdLocked = false;
        state.currentAppId = '';
        updateSubmitButton();
    } catch (error) {
        console.error('🚨 APP: Error clearing selections:', error);
    }
}

function populateAssignmentOptions(appIds, preferredAppId = '') {
    if (!assignmentEl) return;

    try {
        console.log(`📝 APP: Populating options with appIds:`, appIds, 'preferred:', preferredAppId);
        
        // Clear existing options
        assignmentEl.innerHTML = '';

        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select an App ID';
        placeholderOption.disabled = true;
        assignmentEl.appendChild(placeholderOption);

        // Add app options
        appIds.forEach(appId => {
            const option = document.createElement('option');
            option.value = appId;
            option.textContent = appId;
            assignmentEl.appendChild(option);
        });

        // Add "Add New" option
        const newOption = document.createElement('option');
        newOption.value = ADD_NEW_ASSIGNMENT_OPTION;
        newOption.textContent = 'Add New App ID';
        assignmentEl.appendChild(newOption);

        // Handle selection
        if (preferredAppId && appIds.includes(preferredAppId)) {
            assignmentEl.value = preferredAppId;
            state.appIdLocked = true;
            state.currentAppId = preferredAppId;
            assignmentEl.disabled = true;
            assignmentEl.setAttribute('title', `Locked to ${preferredAppId}. Click edit to change.`);
            console.log(`📝 APP: Locked to preferred app:`, preferredAppId);
        } else {
            assignmentEl.selectedIndex = 0; // Select placeholder
            assignmentEl.disabled = false;
            state.appIdLocked = false;
            state.currentAppId = '';
            assignmentEl.setAttribute('title', 'Select an App ID to continue');
            console.log(`📝 APP: No preferred app, showing dropdown`);
        }

        assignmentEl.setAttribute('aria-describedby', 'assignment-help');
        
        // 🔧 CRITICAL FIX: Always hide new assignment input first
        console.log(`📝 APP: Hiding new assignment input`);
        hideNewAssignmentInput();
        
        // Then handle the change (which might show it if needed)
        handleAssignmentChange();
        
    } catch (error) {
        console.error('🚨 APP: Error populating options:', error);
        setError('Failed to load app options');
    }
}

function ensureOptionExists(appId) {
    if (!assignmentEl || !appId) return;
    
    try {
        const existingOption = Array.from(assignmentEl.options).find(opt => opt.value === appId);
        if (existingOption) return;

        // Add the new option before "Add New App ID"
        const newOption = document.createElement('option');
        newOption.value = appId;
        newOption.textContent = appId;
        
        const addNewOption = Array.from(assignmentEl.options).find(opt => opt.value === ADD_NEW_ASSIGNMENT_OPTION);
        if (addNewOption) {
            assignmentEl.insertBefore(newOption, addNewOption);
        } else {
            assignmentEl.appendChild(newOption);
        }
        
        console.log('✅ APP: Added new option:', appId);
    } catch (error) {
        console.error('🚨 APP: Error ensuring option exists:', error);
    }
}

function showNewAssignmentInput() {
    if (newAssignmentContainer) {
        console.log(`📝 APP: Showing new assignment input`);
        newAssignmentContainer.hidden = false;
        newAssignmentContainer.setAttribute('aria-expanded', 'true');
        if (newAssignmentInput) {
            newAssignmentInput.focus();
            newAssignmentInput.setAttribute('aria-describedby', 'new-assignment-feedback');
        }
    }
}

function hideNewAssignmentInput() {
    if (newAssignmentContainer) {
        console.log(`📝 APP: Hiding new assignment input`);
        newAssignmentContainer.hidden = true;
        newAssignmentContainer.setAttribute('aria-expanded', 'false');
        if (newAssignmentInput) {
            newAssignmentInput.value = '';
            newAssignmentInput.setAttribute('aria-describedby', '');
        }
        clearAssignmentNameFeedback();
    }
}

function setAssignmentNameFeedback(message, isError = true) {
    if (newAssignmentFeedback) {
        newAssignmentFeedback.textContent = message || '';
        newAssignmentFeedback.hidden = !message;
        newAssignmentFeedback.classList.toggle('error', isError);
        newAssignmentFeedback.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    }
}

function clearAssignmentNameFeedback() {
    setAssignmentNameFeedback('');
}

function handleAssignmentChange() {
    try {
        console.log(`📝 APP: Handling assignment change, current value:`, assignmentEl?.value);
        console.log(`📝 APP: Setup complete:`, state.setupComplete, 'Dropdown disabled:', assignmentEl?.disabled);
        
        setError('');
        state.appIdLocked = false;
        
        // 🔧 CRITICAL FIX: Only show new input if "Add New" is selected AND setup is not complete AND dropdown is not disabled
        const shouldShowNewInput = assignmentEl?.value === ADD_NEW_ASSIGNMENT_OPTION && 
                                  !state.setupComplete && 
                                  !assignmentEl.disabled;
        
        if (shouldShowNewInput) {
            console.log('📝 APP: Showing new assignment input (Add New selected)');
            showNewAssignmentInput();
        } else {
            console.log('📝 APP: Hiding new assignment input (not Add New or setup complete)');
            hideNewAssignmentInput();
        }
        
        updateSubmitButton();
    } catch (error) {
        console.error('🚨 APP: Error handling selection change:', error);
    }
}

// === DATA LOADING ===
async function loadAppIds(userId, preferredAppId = '', forceRefresh = false) {
    console.log(`🔍 LOADER: Loading app_ids for ${userId} (forceRefresh: ${forceRefresh})`);
    
    if (!userId?.trim()) {
        console.log("🔍 LOADER: No userId provided");
        clearAppSelections();
        return;
    }

    const normalizedUserId = userId.trim();

    // Try cache first (unless force refresh)
    if (!forceRefresh) {
        try {
            const cachedApps = await CacheManager.get(normalizedUserId, 'apps');
            if (cachedApps && Array.isArray(cachedApps) && cachedApps.length > 0) {
                console.log(`📦 LOADER: Using cached app_ids:`, cachedApps);
                populateAssignmentOptions(cachedApps, preferredAppId);
                setStatus('App IDs loaded from cache.', false);
                updateSubmitButton();
                return;
            }
        } catch (error) {
            console.error('🚨 LOADER: Cache error:', error);
        }
        console.log(`📦 LOADER: No cache found, fetching from server`);
    } else {
        console.log(`🔄 LOADER: Force refresh requested`);
        setStatus('Refreshing app list...', false);
    }

    // Fetch from server with retry logic
    toggleAssignmentLoading(true);
    
    let lastError = null;
    let appIds = [];
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const environment = envEl?.value || 'production';
            const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
            
            if (attempt === 1) {
                setStatus(forceRefresh ? 'Refreshing app list...' : 'Loading app IDs...', false);
            } else {
                setStatus(`Retrying... (${attempt}/${MAX_RETRIES})`, false);
            }
            
            console.log(`🔍 LOADER: Attempt ${attempt} to ${baseUrl}`);
            
            const response = await apiClient.fetchUserAppIds(baseUrl, normalizedUserId);
            console.log(`🔍 LOADER: Raw response:`, response);

            // Extract and validate app IDs
            const rawAppIds = Array.isArray(response) ? response : 
                              Array.isArray(response?.app_ids) ? response.app_ids : [];

            const seen = new Set();
            appIds = rawAppIds
                .filter(item => typeof item === 'string')
                .map(item => item.trim())
                .filter(item => item.length >= 3 && !seen.has(item) && (seen.add(item) || true))
                .sort();

            console.log(`🔍 LOADER: Processed app_ids:`, appIds);
            
            // Cache successful result
            await CacheManager.set(normalizedUserId, appIds, 'apps');
            break;
            
        } catch (error) {
            lastError = error;
            console.error(`❌ LOADER: Attempt ${attempt} failed:`, error);
            
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            }
        }
    }

    toggleAssignmentLoading(false);

    if (lastError && appIds.length === 0) {
        const message = ErrorHandler.getFriendlyMessage(lastError, 'Unable to load App IDs. Please try again.');
        setError(message);
        clearAppSelections();
    } else {
        populateAssignmentOptions(appIds, preferredAppId);
        setError('');
        
        const statusMessage = forceRefresh ? 
            (appIds.length ? 'App list refreshed.' : 'No App IDs found after refresh.') :
            (appIds.length ? 'App IDs loaded. Select one to continue.' : 'No App IDs found. Create a new one to continue.');
        
        setStatus(statusMessage, false, { persist: !appIds.length });
    }

    updateSubmitButton();
}

// === USER ACTIONS ===
async function saveUserId() {
    try {
        const { valid, normalized, message } = Validator.validateUserId(userIdEl?.value);
        if (!valid) {
            setError(message);
            updateSubmitButton();
            return;
        }

        // Lock user ID
        state.userIdLocked = true;
        state.currentUserId = normalized;
        userIdEl.value = normalized;
        userIdEl.readOnly = true;
        userIdEl.setAttribute('aria-readonly', 'true');
        updateUserIdIcons();
        
        // Load apps from server (force refresh)
        await loadAppIds(normalized, '', true);
        updateSubmitButton();
        
        console.log('✅ USER: User ID saved and locked:', normalized);
        
    } catch (error) {
        console.error('🚨 USER: Error saving user ID:', error);
        setError(ErrorHandler.getFriendlyMessage(error, 'Failed to save User ID'));
    }
}

async function unlockUserId() {
    try {
        const confirmed = window.confirm('This will clear your current setup and start over. Continue?');
        if (!confirmed) return;

        // Reset all state
        state.userIdLocked = false;
        state.appIdLocked = false;
        state.setupComplete = false;
        state.currentUserId = '';
        state.currentAppId = '';
        
        // Reset UI
        userIdEl.readOnly = false;
        userIdEl.setAttribute('aria-readonly', 'false');
        userIdEl.focus();
        userIdEl.select();
        updateUserIdIcons();
        clearAppSelections();
        
        // Clear caches and saved state
        if (userIdEl.value.trim()) {
            CacheManager.clear(userIdEl.value.trim(), 'apps');
        }
        await StateManager.clear();
        
        setError('');
        setStatus('User ID unlocked. Enter User ID and click save.', false, { persist: true });
        updateSubmitButton();
        
        console.log('🔓 USER: User ID unlocked, state cleared');
        
    } catch (error) {
        console.error('🚨 USER: Error unlocking user ID:', error);
        setError(ErrorHandler.getFriendlyMessage(error, 'Failed to unlock User ID'));
    }
}

async function completeSetup() {
    if (isSubmitting) return;
    
    try {
        isSubmitting = true;
        setError('');
        updateSubmitButton();
        
        const { valid, message, normalized: normalizedUserId } = Validator.validateUserId(userIdEl?.value);
        if (!valid) {
            setError(message);
            return;
        }
        
        const selection = getAppSelectionState();
        if (!selection.ready) {
            setError('Please select an App ID');
            return;
        }
        
        const environment = envEl?.value || 'production';
        const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;
        let appIdToSave = selection.appId;
        
        if (selection.isNew) {
            // Create new assignment
            const { valid: nameValid, message: nameMessage, normalized: normalizedName } = 
                Validator.validateAssignmentName(newAssignmentInput?.value);
                
            if (!nameValid) {
                setAssignmentNameFeedback(nameMessage);
                throw new Error(nameMessage);
            }
            
            setStatus('Creating new App ID...', false);
            appIdToSave = normalizedName;
            
            await apiClient.createAssignment(baseUrl, { 
                user_id: normalizedUserId, 
                app_id: appIdToSave 
            });
            
            // Add to dropdown and clear cache
            ensureOptionExists(appIdToSave);
            CacheManager.clear(normalizedUserId, 'apps');
            
            setStatus('App ID created successfully.', false);
        }
        
        // Save final state
        await StateManager.save(normalizedUserId, appIdToSave);
        
        // Lock everything
        assignmentEl.value = appIdToSave;
        assignmentEl.disabled = true;
        state.appIdLocked = true;
        state.setupComplete = true;
        state.currentAppId = appIdToSave;
        hideNewAssignmentInput();
        
        setStatus('Setup completed successfully!', false, { persist: true });
        console.log('✅ SETUP: Complete - User:', normalizedUserId, 'App:', appIdToSave);
        
    } catch (error) {
        console.error('🚨 SETUP: Error completing setup:', error);
        const message = ErrorHandler.getFriendlyMessage(error, 'Unable to complete setup. Please try again.');
        setError(message);
    } finally {
        isSubmitting = false;
        updateSubmitButton();
    }
}

// === MAIN SUBMIT HANDLER ===
async function handleSubmit() {
    try {
        if (!submitBtn || submitBtn.disabled || isSubmitting) {
            return;
        }
        
        if (!state.userIdLocked) {
            // Step 1: Save User ID
            await saveUserId();
        } else {
            // Step 2: Complete Setup
            await completeSetup();
        }
    } catch (error) {
        console.error('🚨 SUBMIT: Error in main handler:', error);
        setError(ErrorHandler.getFriendlyMessage(error, 'Operation failed. Please try again.'));
    }
}

// === INITIALIZATION ===
async function init() {
    try {
        console.log('🚀 INIT: Starting initialization');
        popupRootEl?.setAttribute('aria-busy', 'true');
        
        // Clean old caches
        CacheManager.clearOldCaches();
        
        // Load saved settings
        const { environment, userId, appId } = await StateManager.load();
        
        if (envEl) envEl.value = environment || 'production';
        
        if (userId && appId) {
            // RETURNING USER: Complete setup
            console.log('🔄 INIT: Returning user with complete setup');
            
            state.userIdLocked = true;
            state.appIdLocked = true;
            state.setupComplete = true;
            state.currentUserId = userId;
            state.currentAppId = appId;
            
            userIdEl.value = userId;
            userIdEl.readOnly = true;
            userIdEl.setAttribute('aria-readonly', 'true');
            updateUserIdIcons();
            
            // Load from cache
            await loadAppIds(userId, appId, false);
            setStatus('Welcome back! Setup is complete.', false, { persist: true });
            
        } else if (userId) {
            // USER ID SAVED: Need app selection
            console.log('🔄 INIT: User ID saved, awaiting app selection');
            
            state.userIdLocked = true;
            state.currentUserId = userId;
            
            userIdEl.value = userId;
            userIdEl.readOnly = true;
            userIdEl.setAttribute('aria-readonly', 'true');
            updateUserIdIcons();
            
            await loadAppIds(userId, '', false);
            setStatus('Select an App ID to continue.', false, { persist: true });
            
        } else {
            // FRESH START
            console.log('🔄 INIT: Fresh start');
            
            state.userIdLocked = false;
            userIdEl.value = '';
            userIdEl.readOnly = false;
            userIdEl.setAttribute('aria-readonly', 'false');
            updateUserIdIcons();
            clearAppSelections();
            setStatus('Enter your User ID to get started.', false, { persist: true });
        }
        
        // Always hide new assignment input on startup
        hideNewAssignmentInput();
        
        console.log('✅ INIT: Initialization complete');
        
    } catch (error) {
        console.error('🚨 INIT: Initialization failed:', error);
        setError('Failed to initialize. Please refresh the page.');
    } finally {
        popupRootEl?.setAttribute('aria-busy', 'false');
        updateSubmitButton();
        updateConnection();
    }
}

// === EVENT HANDLERS ===
function handleIconActivation(callback) {
    return function(event) {
        if (event.type === 'click' || (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' '))) {
            event.preventDefault();
            callback();
        }
    };
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', init);

// Environment change
if (envEl) {
    envEl.addEventListener('change', updateConnection);
}

// User ID input
if (userIdEl) {
    userIdEl.addEventListener('input', () => {
        if (!state.userIdLocked) {
            updateSubmitButton();
        }
    });
    
    userIdEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !state.userIdLocked) {
            const { valid } = Validator.validateUserId(userIdEl.value);
            if (valid) {
                saveUserId();
            }
        }
    });
}

// Assignment selection
if (assignmentEl) {
    assignmentEl.addEventListener('change', handleAssignmentChange);
}

// New assignment input
if (newAssignmentInput) {
    newAssignmentInput.addEventListener('input', () => {
        clearAssignmentNameFeedback();
        updateSubmitButton();
    });
}

// Submit button
if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
}

// Save icon (✅) - Save User ID  
if (userIdSavedIcon) {
    userIdSavedIcon.setAttribute('role', 'button');
    userIdSavedIcon.setAttribute('tabindex', '0');
    userIdSavedIcon.addEventListener('click', handleIconActivation(() => {
        if (!state.userIdLocked) {
            saveUserId();
        }
    }));
    userIdSavedIcon.addEventListener('keydown', handleIconActivation(() => {
        if (!state.userIdLocked) {
            saveUserId();
        }
    }));
}

// Edit icon (✏️) - Unlock User ID
if (userIdEditIcon) {
    userIdEditIcon.setAttribute('role', 'button');
    userIdEditIcon.setAttribute('tabindex', '0');
    userIdEditIcon.addEventListener('click', handleIconActivation(() => {
        if (state.userIdLocked) {
            unlockUserId();
        }
    }));
    userIdEditIcon.addEventListener('keydown', handleIconActivation(() => {
        if (state.userIdLocked) {
            unlockUserId();
        }
    }));
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
    }
});
