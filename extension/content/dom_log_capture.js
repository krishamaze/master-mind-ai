(async () => {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const consoleLogBuffer = [];
  let consoleLogTimerId = null;
  let firstConsoleLogTimestamp = null;
  let activePlatform = null;

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  const serializeConsoleArg = value => {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  };

  const sendConsoleLogs = payload =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'console-logs', payload },
        response => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }

          if (!response?.success) {
            reject(new Error(response?.error || 'Console log transmission failed'));
            return;
          }

          resolve(response?.data ?? null);
        }
      );
    });

  const flushConsoleLogs = async () => {
    if (!consoleLogBuffer.length) {
      return;
    }

    const payload = {
      platform: activePlatform,
      pageUrl: window.location.href,
      firstLoggedAt: firstConsoleLogTimestamp,
      entries: consoleLogBuffer.map(entry => ({ ...entry }))
    };

    try {
      await sendConsoleLogs(payload);
      originalConsole.log('📡 Sent console logs to backend', payload.entries.length);
      consoleLogBuffer.length = 0;
      firstConsoleLogTimestamp = null;
    } catch (error) {
      originalConsole.error('❌ Failed to send console logs to backend', error);
      if (!consoleLogTimerId) {
        consoleLogTimerId = setTimeout(async () => {
          consoleLogTimerId = null;
          await flushConsoleLogs();
        }, FIVE_MINUTES_MS);
      }
    }
  };

  const scheduleConsoleFlush = () => {
    if (consoleLogTimerId) {
      return;
    }

    consoleLogTimerId = setTimeout(async () => {
      consoleLogTimerId = null;
      await flushConsoleLogs();
    }, FIVE_MINUTES_MS);
  };

  const captureConsoleCall = (level, args) => {
    const timestamp = new Date().toISOString();
    consoleLogBuffer.push({
      level,
      timestamp,
      messages: args.map(serializeConsoleArg)
    });

    if (!firstConsoleLogTimestamp) {
      firstConsoleLogTimestamp = timestamp;
      scheduleConsoleFlush();
    }
  };

  console.log = (...args) => {
    captureConsoleCall('log', args);
    originalConsole.log(...args);
  };

  console.warn = (...args) => {
    captureConsoleCall('warn', args);
    originalConsole.warn(...args);
  };

  console.error = (...args) => {
    captureConsoleCall('error', args);
    originalConsole.error(...args);
  };

  try {
    console.log('🪵 Initializing DOM log capture...');

    const [
      { detectPlatform, getPlatformConfig },
      { default: DOMObserver }
    ] = await Promise.all([
      import(chrome.runtime.getURL('shared/platform-config.js')),
      import(chrome.runtime.getURL('shared/dom-observer.js'))
    ]);

    const platform = detectPlatform();
    activePlatform = platform;
    if (!platform) {
      console.warn('DOM log capture: unsupported platform for this page');
      return;
    }

    const { selectors } = getPlatformConfig(platform);
    const captureSelector = selectors?.['conversation-capture'];
    if (!captureSelector) {
      console.warn('DOM log capture: no conversation selector configured');
      return;
    }

    const observer = new DOMObserver(selectors);

    const logConversationSnapshot = elements => {
      try {
        const snapshot = Array.from(elements, node => node.innerText.trim()).filter(Boolean);
        if (snapshot.length === 0) {
          return;
        }
        console.debug(`📥 [${platform}] conversation snapshot`, snapshot);
      } catch (error) {
        console.error('DOM log capture failed to read elements', error);
      }
    };

    observer.subscribe('conversation-capture', logConversationSnapshot);
    observer.start();

    window.addEventListener('beforeunload', () => {
      try {
        observer.cleanup();
      } catch (error) {
        console.warn('DOM log capture cleanup warning', error);
      }

      if (consoleLogBuffer.length) {
        flushConsoleLogs();
      }
    });

    console.log('✅ DOM log capture ready');
  } catch (error) {
    console.error('❌ Failed to initialize DOM log capture', error);
  }
})();
