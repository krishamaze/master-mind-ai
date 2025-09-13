import { jest } from '@jest/globals';
import { DOMObserver } from '../shared/dom-observer.js';

describe('DOMObserver', () => {
  jest.useFakeTimers();

  test('notifies subscribers on matching elements', async () => {
    document.body.innerHTML = '';
    const observer = new DOMObserver({ 'conversation-capture': '.msg' });
    const cb = jest.fn();
    observer.subscribe('conversation-capture', cb);
    observer.start();

    const el = document.createElement('div');
    el.className = 'msg';
    document.body.appendChild(el);

    await Promise.resolve();
    jest.advanceTimersByTime(300);

    expect(cb).toHaveBeenCalled();
    observer.cleanup();
  });
});
