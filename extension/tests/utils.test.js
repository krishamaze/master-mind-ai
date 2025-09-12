import { jest } from '@jest/globals';
import { debounce } from '../content/utils.js';

describe('debounce', () => {
  jest.useFakeTimers();

  test('delays execution', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced();
    jest.advanceTimersByTime(50);
    expect(fn).not.toBeCalled();
    jest.advanceTimersByTime(50);
    expect(fn).toBeCalledTimes(1);
  });
});
