import { jest } from '@jest/globals';

const ADD_NEW_ASSIGNMENT_OPTION = 'NEW';

function setupDom() {
  document.body.innerHTML = `
    <select id="environment">
      <option value="production">Production</option>
      <option value="development">Development</option>
    </select>
    <div>
      <input id="userId" type="text" />
      <span id="userId-saved" hidden></span>
      <span id="userId-edit" hidden></span>
    </div>
    <select id="assignment-select" disabled></select>
    <span id="appId-saved" hidden></span>
    <span id="appId-edit" hidden></span>
    <div id="assignment-loading" hidden></div>
    <div id="new-assignment-container" hidden>
      <input id="new-assignment-name" type="text" />
      <div id="new-assignment-feedback" hidden></div>
    </div>
    <button id="submit" disabled>Submit</button>
    <div id="connection"></div>
    <div id="status"></div>
  `;
}

async function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('popup assignment creation flow', () => {
  let mockGetSettings;
  let mockSetSettings;
  let mockCreateAssignment;
  let mockFetchUserAppIds;
  let createdAppId;

  beforeEach(async () => {
    jest.resetModules();
    setupDom();

    global.chrome = {
      runtime: {
        sendMessage: jest.fn((message, callback) => {
          if (typeof callback === 'function') {
            callback({ ok: true });
          }
        })
      }
    };

    mockGetSettings = jest.fn().mockResolvedValue({
      environment: 'production',
      userId: 'user-123',
      appId: ''
    });
    mockSetSettings = jest.fn().mockResolvedValue(undefined);
    createdAppId = '';
    mockCreateAssignment = jest.fn().mockImplementation((_baseUrl, payload) => {
      createdAppId = payload.app_id ?? payload.appId;
      return Promise.resolve({ id: 10, name: 'NewApp01', app_id: createdAppId });
    });
    mockFetchUserAppIds = jest
      .fn()
      .mockResolvedValueOnce({ app_ids: [] })
      .mockImplementationOnce(() => Promise.resolve({ app_ids: [createdAppId] }))
      .mockResolvedValue({ app_ids: [] });

    await jest.unstable_mockModule('../config.js', () => ({
      ENVIRONMENTS: {
        production: 'https://api.example',
        development: 'http://localhost:8000'
      },
      getSettings: mockGetSettings,
      setSettings: mockSetSettings
    }));

    await jest.unstable_mockModule('../api.js', () => ({
      apiClient: {
        fetchUserAppIds: mockFetchUserAppIds,
        createAssignment: mockCreateAssignment
      }
    }));

    await import('../popup.js');
    await flushPromises();
  });

  afterEach(() => {
    delete global.chrome;
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('creates a new app ID and saves the selection', async () => {
    const assignmentSelect = document.getElementById('assignment-select');
    const newAssignmentInput = document.getElementById('new-assignment-name');
    const submitButton = document.getElementById('submit');

    const userIdInput = document.getElementById('userId');
    userIdInput.value = 'user-123';
    submitButton.disabled = false;
    submitButton.click();
    await flushPromises();
    await flushPromises();
    expect(mockFetchUserAppIds).toHaveBeenCalled();

    const addNewOption = assignmentSelect.querySelector(`option[value="${ADD_NEW_ASSIGNMENT_OPTION}"]`);
    expect(addNewOption).toBeTruthy();

    assignmentSelect.disabled = false;
    assignmentSelect.value = ADD_NEW_ASSIGNMENT_OPTION;
    assignmentSelect.dispatchEvent(new Event('change'));

    newAssignmentInput.value = 'NewApp01';
    newAssignmentInput.dispatchEvent(new Event('input'));

    submitButton.click();

    await flushPromises();
    await flushPromises();

    expect(mockCreateAssignment).toHaveBeenCalledTimes(1);
    const [, createPayload] = mockCreateAssignment.mock.calls[0];
    expect(createPayload).toEqual({ app_id: 'NewApp01', user_id: 'user-123' });

    expect(mockFetchUserAppIds).toHaveBeenCalledTimes(1);
    expect(mockFetchUserAppIds).toHaveBeenLastCalledWith('https://api.example', 'user-123');

    expect(mockSetSettings).toHaveBeenCalledWith({
      environment: 'production',
      userId: 'user-123',
      appId: 'NewApp01'
    });

    expect(assignmentSelect.value).toBe('NewApp01');
  });
});
