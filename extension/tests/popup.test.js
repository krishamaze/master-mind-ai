import { jest } from '@jest/globals';

const ADD_NEW_ASSIGNMENT_OPTION = '__add_new_assignment__';

function setupDom() {
  document.body.innerHTML = `
    <select id="environment">
      <option value="production">Production</option>
      <option value="development">Development</option>
    </select>
    <select id="assignment-select"></select>
    <div id="assignment-loading" hidden></div>
    <div id="new-assignment-container" hidden></div>
    <input id="new-assignment-name" type="text" />
    <div id="new-assignment-feedback" hidden></div>
    <input id="userId" type="text" />
    <button id="save">Save</button>
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
  let mockFetchAssignments;

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
      assignmentId: ''
    });
    mockSetSettings = jest.fn().mockResolvedValue(undefined);
    mockCreateAssignment = jest.fn().mockResolvedValue({ id: 10, name: 'NewAssign1' });
    mockFetchAssignments = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 10, name: 'NewAssign1' }])
      .mockResolvedValue([]);

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
        fetchAssignments: mockFetchAssignments,
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

  test('creates a new assignment and saves the selection', async () => {
    const assignmentSelect = document.getElementById('assignment-select');
    const newAssignmentInput = document.getElementById('new-assignment-name');
    const saveButton = document.getElementById('save');

    assignmentSelect.value = ADD_NEW_ASSIGNMENT_OPTION;
    assignmentSelect.dispatchEvent(new Event('change'));

    newAssignmentInput.value = 'NewAssign1';
    newAssignmentInput.dispatchEvent(new Event('input'));

    saveButton.click();

    await flushPromises();
    await flushPromises();

    expect(mockCreateAssignment).toHaveBeenCalledWith('https://api.example', {
      name: 'NewAssign1'
    });

    expect(mockFetchAssignments).toHaveBeenCalledTimes(2);
    expect(mockFetchAssignments).toHaveBeenLastCalledWith('https://api.example', 'user-123');

    expect(mockSetSettings).toHaveBeenCalledWith({
      environment: 'production',
      userId: 'user-123',
      assignmentId: '10'
    });

    expect(assignmentSelect.value).toBe('10');
  });
});
