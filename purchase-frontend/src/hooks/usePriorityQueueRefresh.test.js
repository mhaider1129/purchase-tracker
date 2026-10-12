import { act, renderHook } from '@testing-library/react';
import usePriorityQueueRefresh from './usePriorityQueueRefresh';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test('refreshes on timer and focus, pauses for unsaved changes and cleans up', () => {
  const refresh = jest.fn();
  const { rerender, unmount } = renderHook(({ paused }) => usePriorityQueueRefresh(refresh, paused), { initialProps: { paused: false } });
  act(() => jest.advanceTimersByTime(30000));
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event('focus')));
  expect(refresh).toHaveBeenCalledTimes(2);
  rerender({ paused: true });
  act(() => { jest.advanceTimersByTime(60000); window.dispatchEvent(new Event('focus')); });
  expect(refresh).toHaveBeenCalledTimes(2);
  rerender({ paused: false });
  act(() => jest.advanceTimersByTime(30000));
  expect(refresh).toHaveBeenCalledTimes(3);
  unmount();
  act(() => { jest.advanceTimersByTime(60000); window.dispatchEvent(new Event('focus')); });
  expect(refresh).toHaveBeenCalledTimes(3);
});
