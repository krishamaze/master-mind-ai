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

  test('generates a run id when user starts typing in an empty conversation', async () => {
    document.body.innerHTML = `
      <div class="thread"></div>
      <textarea class="composer"></textarea>
    `;

    const observer = new DOMObserver({
      'conversation-capture': '.thread .message',
      'input-detection': '.composer'
    });

    observer.start();

    await Promise.resolve();
    jest.advanceTimersByTime(300);

    const input = document.querySelector('.composer');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const runId = observer.getCurrentRunId();
    expect(runId).toMatch(/^thread_/);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(observer.getCurrentRunId()).toBe(runId);

    observer.cleanup();
  });

  test('clears run id when conversation becomes empty again', async () => {
    document.body.innerHTML = `
      <div class="thread"><div class="message">Hello</div></div>
      <textarea class="composer"></textarea>
    `;

    const observer = new DOMObserver({
      'conversation-capture': '.thread .message',
      'input-detection': '.composer'
    });

    observer.start();

    await Promise.resolve();
    jest.advanceTimersByTime(300);

    observer.setCurrentRunId('thread_existing');

    const container = document.querySelector('.thread');
    container.innerHTML = '';

    await Promise.resolve();
    jest.advanceTimersByTime(300);

    expect(observer.getCurrentRunId()).toBeNull();

    observer.cleanup();
  });
});
