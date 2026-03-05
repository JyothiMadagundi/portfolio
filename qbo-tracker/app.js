// QBO Script Tracker - Application Logic

// Data Management
const STORAGE_KEY = 'qbo_tracker_entries';
const DB_NAME = 'qbo_tracker_files';
const DB_VERSION = 1;
let db = null;

// Initialize IndexedDB for file storage
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('files')) {
                const store = database.createObjectStore('files', { keyPath: 'id' });
                store.createIndex('entryId', 'entryId', { unique: false });
            }
        };
    });
}

function getEntries() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// File Storage Functions
async function saveFile(entryId, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const fileData = {
                id: generateId(),
                entryId: entryId,
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result,
                uploadedAt: new Date().toISOString()
            };
            
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.add(fileData);
            
            request.onsuccess = () => resolve(fileData);
            request.onerror = () => reject(request.error);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function getFilesForEntry(entryId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('entryId');
        const request = index.getAll(entryId);
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFile(fileId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.delete(fileId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteFilesForEntry(entryId) {
    const files = await getFilesForEntry(entryId);
    for (const file of files) {
        await deleteFile(file.id);
    }
}

async function getFileCount(entryId) {
    const files = await getFilesForEntry(entryId);
    return files.length;
}

// DOM Elements
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    viewAllLinks: document.querySelectorAll('.view-all'),
    
    // Views
    dashboardView: document.getElementById('dashboardView'),
    entriesView: document.getElementById('entriesView'),
    banksView: document.getElementById('banksView'),
    pageTitle: document.getElementById('pageTitle'),
    
    // Stats
    statPending: document.getElementById('statPending'),
    statInProgress: document.getElementById('statInProgress'),
    statCompleted: document.getElementById('statCompleted'),
    statError: document.getElementById('statError'),
    countHar: document.getElementById('countHar'),
    countAttempt: document.getElementById('countAttempt'),
    countIssue: document.getElementById('countIssue'),
    
    // Lists
    recentEntriesList: document.getElementById('recentEntriesList'),
    entriesTableBody: document.getElementById('entriesTableBody'),
    banksGrid: document.getElementById('banksGrid'),
    
    // Empty states
    emptyState: document.getElementById('emptyState'),
    emptyBanksState: document.getElementById('emptyBanksState'),
    
    // Filters
    searchInput: document.getElementById('searchInput'),
    filterCallType: document.getElementById('filterCallType'),
    filterStatus: document.getElementById('filterStatus'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    applyDateFilter: document.getElementById('applyDateFilter'),
    clearDateFilter: document.getElementById('clearDateFilter'),
    
    // Modal
    entryModal: document.getElementById('entryModal'),
    modalTitle: document.getElementById('modalTitle'),
    entryForm: document.getElementById('entryForm'),
    addEntryBtn: document.getElementById('addEntryBtn'),
    closeModal: document.getElementById('closeModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    
    // Form fields
    entryId: document.getElementById('entryId'),
    provider: document.getElementById('provider'),
    bankName: document.getElementById('bankName'),
    customerId: document.getElementById('customerId'),
    callType: document.getElementById('callType'),
    requestedBy: document.getElementById('requestedBy'),
    attendedBy: document.getElementById('attendedBy'),
    callBookedDate: document.getElementById('callBookedDate'),
    status: document.getElementById('status'),
    connectionStatus: document.getElementById('connectionStatus'),
    errorCode: document.getElementById('errorCode'),
    notes: document.getElementById('notes'),
    
    // Delete modal
    deleteModal: document.getElementById('deleteModal'),
    closeDeleteModal: document.getElementById('closeDeleteModal'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    
    // Import/Export
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    
    // File Upload
    fileUploadArea: document.getElementById('fileUploadArea'),
    fileUploadPrompt: document.getElementById('fileUploadPrompt'),
    fileInput: document.getElementById('fileInput'),
    attachedFilesList: document.getElementById('attachedFilesList'),
    
    // Attachments Modal
    attachmentsModal: document.getElementById('attachmentsModal'),
    closeAttachmentsModal: document.getElementById('closeAttachmentsModal'),
    attachmentEntryInfo: document.getElementById('attachmentEntryInfo'),
    attachmentsModalList: document.getElementById('attachmentsModalList'),
    emptyAttachments: document.getElementById('emptyAttachments'),
    addMoreFiles: document.getElementById('addMoreFiles'),
    addFilesInput: document.getElementById('addFilesInput'),
    
    // Toast
    toast: document.getElementById('toast')
};

let deleteTargetId = null;
let currentEntryFiles = []; // Temporary storage for files during entry creation/edit
let currentAttachmentsEntryId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    initNavigation();
    initModal();
    initFilters();
    initImportExport();
    initFileUpload();
    initAttachmentsModal();
    updateDashboard();
    renderEntries();
    renderBanks();
});

// Navigation
function initNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
        });
    });
    
    elements.viewAllLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            switchView(view);
        });
    });
}

function switchView(viewName) {
    // Update nav items
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const titles = {
        dashboard: 'Dashboard',
        entries: 'All Entries',
        banks: 'Banks Overview'
    };
    
    elements.pageTitle.textContent = titles[viewName] || 'Dashboard';
    
    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Refresh data
    if (viewName === 'entries') {
        renderEntries();
    } else if (viewName === 'banks') {
        renderBanks();
    } else {
        updateDashboard();
    }
}

// Modal Management
function initModal() {
    elements.addEntryBtn.addEventListener('click', () => openModal());
    elements.closeModal.addEventListener('click', closeEntryModal);
    elements.cancelBtn.addEventListener('click', closeEntryModal);
    elements.entryForm.addEventListener('submit', handleFormSubmit);
    
    elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
    elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal on overlay click
    elements.entryModal.addEventListener('click', (e) => {
        if (e.target === elements.entryModal) closeEntryModal();
    });
    
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) closeDeleteModal();
    });
}

async function openModal(entry = null) {
    elements.entryModal.classList.add('active');
    currentEntryFiles = []; // Clear temporary files
    
    if (entry) {
        elements.modalTitle.textContent = 'Edit Entry';
        elements.entryId.value = entry.id;
        elements.provider.value = entry.provider || '';
        elements.bankName.value = entry.bankName;
        elements.customerId.value = entry.customerId;
        elements.callType.value = entry.callType;
        elements.requestedBy.value = entry.requestedBy || '';
        elements.attendedBy.value = entry.attendedBy || '';
        elements.callBookedDate.value = entry.callBookedDate || '';
        elements.status.value = entry.status;
        elements.connectionStatus.value = entry.connectionStatus || 'not_tested';
        elements.errorCode.value = entry.errorCode || '';
        elements.notes.value = entry.notes || '';
        
        // Load existing files for display (but don't re-save them)
        const existingFiles = await getFilesForEntry(entry.id);
        renderExistingFiles(existingFiles);
    } else {
        elements.modalTitle.textContent = 'Add New Entry';
        elements.entryForm.reset();
        elements.entryId.value = '';
        elements.attachedFilesList.innerHTML = '';
    }
    
    elements.provider.focus();
}

function renderExistingFiles(files) {
    if (files.length === 0) {
        elements.attachedFilesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No files attached. Add new files above.</p>';
        return;
    }
    
    elements.attachedFilesList.innerHTML = `
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">Existing files (${files.length}):</p>
        ${files.map(f => `
            <div class="attached-file">
                <div class="attached-file-info">
                    <div class="attached-file-icon ${getFileIconClass(f.name)}">
                        ${getFileIcon(f.name)}
                    </div>
                    <div class="attached-file-details">
                        <span class="attached-file-name">${escapeHtml(f.name)}</span>
                        <span class="attached-file-size">${formatFileSize(f.size)}</span>
                    </div>
                </div>
            </div>
        `).join('')}
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 12px;">Add more files above ↑</p>
    `;
}

function closeEntryModal() {
    elements.entryModal.classList.remove('active');
    elements.entryForm.reset();
    currentEntryFiles = [];
    elements.attachedFilesList.innerHTML = '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const entries = getEntries();
    const entryData = {
        provider: elements.provider.value.trim(),
        bankName: elements.bankName.value.trim(),
        customerId: elements.customerId.value.trim(),
        callType: elements.callType.value,
        requestedBy: elements.requestedBy.value.trim(),
        attendedBy: elements.attendedBy.value.trim(),
        callBookedDate: elements.callBookedDate.value,
        status: elements.status.value,
        connectionStatus: elements.connectionStatus.value,
        errorCode: elements.errorCode.value.trim(),
        notes: elements.notes.value.trim(),
        updatedAt: new Date().toISOString()
    };
    
    let entryId;
    
    if (elements.entryId.value) {
        // Edit existing
        entryId = elements.entryId.value;
        const index = entries.findIndex(e => e.id === entryId);
        if (index !== -1) {
            entries[index] = { ...entries[index], ...entryData };
        }
    } else {
        // Add new
        entryId = generateId();
        entryData.id = entryId;
        entryData.createdAt = new Date().toISOString();
        entries.unshift(entryData);
    }
    
    saveEntries(entries);
    
    // Save any new files
    if (currentEntryFiles.length > 0) {
        for (const f of currentEntryFiles) {
            try {
                await saveFile(entryId, f.file);
            } catch (error) {
                console.error('Error saving file:', error);
            }
        }
        currentEntryFiles = [];
    }
    
    showToast(elements.entryId.value ? 'Entry updated successfully' : 'Entry added successfully', 'success');
    
    closeEntryModal();
    updateDashboard();
    renderEntries();
    renderBanks();
}

function openDeleteModal(id) {
    deleteTargetId = id;
    elements.deleteModal.classList.add('active');
}

function closeDeleteModal() {
    elements.deleteModal.classList.remove('active');
    deleteTargetId = null;
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    
    // Delete associated files first
    await deleteFilesForEntry(deleteTargetId);
    
    let entries = getEntries();
    entries = entries.filter(e => e.id !== deleteTargetId);
    saveEntries(entries);
    
    closeDeleteModal();
    showToast('Entry and attachments deleted', 'success');
    updateDashboard();
    renderEntries();
    renderBanks();
}

// Filters
function initFilters() {
    elements.searchInput.addEventListener('input', renderEntries);
    elements.filterCallType.addEventListener('change', renderEntries);
    elements.filterStatus.addEventListener('change', renderEntries);
    
    // Date range filter
    elements.applyDateFilter.addEventListener('click', renderEntries);
    elements.clearDateFilter.addEventListener('click', () => {
        elements.dateFrom.value = '';
        elements.dateTo.value = '';
        renderEntries();
    });
}

function getFilteredEntries() {
    let entries = getEntries();
    const search = elements.searchInput.value.toLowerCase();
    const callType = elements.filterCallType.value;
    const status = elements.filterStatus.value;
    const dateFrom = elements.dateFrom.value;
    const dateTo = elements.dateTo.value;
    
    if (search) {
        entries = entries.filter(e => 
            e.bankName.toLowerCase().includes(search) ||
            e.customerId.toLowerCase().includes(search) ||
            (e.provider && e.provider.toLowerCase().includes(search)) ||
            (e.requestedBy && e.requestedBy.toLowerCase().includes(search)) ||
            (e.attendedBy && e.attendedBy.toLowerCase().includes(search)) ||
            (e.notes && e.notes.toLowerCase().includes(search))
        );
    }
    
    if (callType) {
        entries = entries.filter(e => e.callType === callType);
    }
    
    if (status) {
        entries = entries.filter(e => e.status === status);
    }
    
    // Date range filter
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        entries = entries.filter(e => {
            const entryDate = new Date(e.createdAt);
            return entryDate >= fromDate;
        });
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        entries = entries.filter(e => {
            const entryDate = new Date(e.createdAt);
            return entryDate <= toDate;
        });
    }
    
    return entries;
}

// Dashboard
function updateDashboard() {
    const entries = getEntries();
    
    // Status counts
    const statusCounts = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        error: 0
    };
    
    // Call type counts
    const callTypeCounts = {
        har_collection: 0,
        verification_attempt: 0,
        issue_check: 0
    };
    
    entries.forEach(entry => {
        if (statusCounts.hasOwnProperty(entry.status)) {
            statusCounts[entry.status]++;
        }
        if (callTypeCounts.hasOwnProperty(entry.callType)) {
            callTypeCounts[entry.callType]++;
        }
    });
    
    // Update stats
    elements.statPending.textContent = statusCounts.pending;
    elements.statInProgress.textContent = statusCounts.in_progress;
    elements.statCompleted.textContent = statusCounts.completed;
    elements.statError.textContent = statusCounts.error;
    
    elements.countHar.textContent = callTypeCounts.har_collection;
    elements.countAttempt.textContent = callTypeCounts.verification_attempt;
    elements.countIssue.textContent = callTypeCounts.issue_check;
    
    // Render recent entries
    renderRecentEntries(entries.slice(0, 5));
}

function renderRecentEntries(entries) {
    if (entries.length === 0) {
        elements.recentEntriesList.innerHTML = `
            <div class="empty-state visible" style="padding: 30px;">
                <p style="color: var(--text-muted);">No entries yet</p>
            </div>
        `;
        return;
    }
    
    elements.recentEntriesList.innerHTML = entries.map(entry => `
        <div class="recent-entry">
            <div class="recent-entry-info">
                <span class="recent-entry-bank">${escapeHtml(entry.provider ? entry.provider + ' - ' : '')}${escapeHtml(entry.bankName)}</span>
                <div class="recent-entry-meta">
                    <span>${formatCallType(entry.callType)}</span>
                    <span>•</span>
                    <span>${entry.requestedBy ? 'By ' + escapeHtml(entry.requestedBy) : ''}</span>
                    <span>•</span>
                    <span>${formatDate(entry.createdAt)}</span>
                </div>
            </div>
            <span class="status-badge ${entry.status}">${formatStatus(entry.status)}</span>
        </div>
    `).join('');
}

// Entries Table
async function renderEntries() {
    const entries = getFilteredEntries();
    
    if (entries.length === 0) {
        elements.entriesTableBody.innerHTML = '';
        elements.emptyState.classList.add('visible');
        return;
    }
    
    elements.emptyState.classList.remove('visible');
    
    // Get file counts for all entries
    const fileCounts = {};
    for (const entry of entries) {
        fileCounts[entry.id] = await getFileCount(entry.id);
    }
    
    elements.entriesTableBody.innerHTML = entries.map(entry => {
        const fileCount = fileCounts[entry.id] || 0;
        return `
        <tr>
            <td>${formatDate(entry.createdAt)}</td>
            <td class="call-booked-date">${entry.callBookedDate ? formatDateInput(entry.callBookedDate) : '-'}</td>
            <td><span class="provider-badge">${escapeHtml(entry.provider || 'N/A')}</span></td>
            <td><strong>${escapeHtml(entry.bankName)}</strong></td>
            <td><code style="font-family: var(--font-mono); font-size: 0.85em;">${escapeHtml(entry.customerId)}</code></td>
            <td><span class="call-type-badge ${entry.callType}">${formatCallType(entry.callType)}</span></td>
            <td>${escapeHtml(entry.requestedBy || '-')}</td>
            <td>${escapeHtml(entry.attendedBy || '-')}</td>
            <td><span class="status-badge ${entry.status}">${formatStatus(entry.status)}</span></td>
            <td>
                ${fileCount > 0 
                    ? `<span class="attachment-badge" onclick="openAttachmentsModal('${entry.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        ${fileCount} file${fileCount > 1 ? 's' : ''}
                       </span>`
                    : `<span class="no-attachments" onclick="openAttachmentsModal('${entry.id}')" style="cursor:pointer;">+ Add</span>`
                }
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" title="Edit" onclick="editEntry('${entry.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" title="Delete" onclick="deleteEntry('${entry.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

// Global functions for inline handlers
window.editEntry = async function(id) {
    const entries = getEntries();
    const entry = entries.find(e => e.id === id);
    if (entry) {
        await openModal(entry);
    }
};

window.deleteEntry = function(id) {
    openDeleteModal(id);
};

// Banks View
function renderBanks() {
    const entries = getEntries();
    const bankMap = new Map();
    
    entries.forEach(entry => {
        // Create unique key combining provider and bank
        const key = `${entry.provider || 'Unknown'}_${entry.bankName}`;
        if (!bankMap.has(key)) {
            bankMap.set(key, {
                provider: entry.provider || 'Unknown',
                name: entry.bankName,
                total: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                hasSuccessfulConnection: false,
                teamMembers: new Set()
            });
        }
        
        const bank = bankMap.get(key);
        bank.total++;
        
        if (entry.status === 'completed') bank.completed++;
        if (entry.status === 'pending') bank.pending++;
        if (entry.status === 'in_progress') bank.inProgress++;
        if (entry.connectionStatus === 'success') bank.hasSuccessfulConnection = true;
        if (entry.requestedBy) bank.teamMembers.add(entry.requestedBy);
        if (entry.attendedBy) bank.teamMembers.add(entry.attendedBy);
    });
    
    if (bankMap.size === 0) {
        elements.banksGrid.innerHTML = '';
        elements.emptyBanksState.classList.add('visible');
        return;
    }
    
    elements.emptyBanksState.classList.remove('visible');
    
    const banks = Array.from(bankMap.values()).sort((a, b) => b.total - a.total);
    
    elements.banksGrid.innerHTML = banks.map(bank => `
        <div class="bank-card">
            <div class="bank-card-header">
                <div>
                    <span class="provider-badge" style="margin-bottom: 8px; display: inline-block;">${escapeHtml(bank.provider)}</span>
                    <h3>${escapeHtml(bank.name)}</h3>
                </div>
                ${bank.hasSuccessfulConnection 
                    ? '<span class="bank-connection-indicator connected">✓ Connected</span>'
                    : bank.completed > 0 
                        ? '<span class="bank-connection-indicator pending">Pending</span>'
                        : '<span class="bank-connection-indicator failed">Not Connected</span>'
                }
            </div>
            <div class="bank-card-stats">
                <div class="bank-stat">
                    <span class="bank-stat-value">${bank.total}</span>
                    <span class="bank-stat-label">Total Entries</span>
                </div>
                <div class="bank-stat">
                    <span class="bank-stat-value">${bank.completed}</span>
                    <span class="bank-stat-label">Completed</span>
                </div>
                <div class="bank-stat">
                    <span class="bank-stat-value">${bank.inProgress}</span>
                    <span class="bank-stat-label">In Progress</span>
                </div>
                <div class="bank-stat">
                    <span class="bank-stat-value">${bank.pending}</span>
                    <span class="bank-stat-label">Pending</span>
                </div>
            </div>
            ${bank.teamMembers.size > 0 ? `
                <div class="bank-team-members">
                    <span class="team-label">Team: </span>
                    <span class="team-names">${Array.from(bank.teamMembers).map(m => escapeHtml(m)).join(', ')}</span>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// File Upload
function initFileUpload() {
    // Click to upload
    elements.fileUploadPrompt.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    // File input change
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    elements.fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.fileUploadArea.classList.add('drag-over');
    });
    
    elements.fileUploadArea.addEventListener('dragleave', () => {
        elements.fileUploadArea.classList.remove('drag-over');
    });
    
    elements.fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.fileUploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        processFiles(files);
    });
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
    e.target.value = ''; // Reset input
}

function processFiles(files) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['har', 'html', 'htm', 'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'json'];
    
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (file.size > maxSize) {
            showToast(`File "${file.name}" exceeds 10MB limit`, 'error');
            continue;
        }
        
        if (!allowedTypes.includes(ext)) {
            showToast(`File type ".${ext}" not allowed`, 'error');
            continue;
        }
        
        // Add to temporary files list
        currentEntryFiles.push({
            tempId: generateId(),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type
        });
    }
    
    renderAttachedFiles();
}

function renderAttachedFiles() {
    if (currentEntryFiles.length === 0) {
        elements.attachedFilesList.innerHTML = '';
        return;
    }
    
    elements.attachedFilesList.innerHTML = currentEntryFiles.map(f => `
        <div class="attached-file">
            <div class="attached-file-info">
                <div class="attached-file-icon ${getFileIconClass(f.name)}">
                    ${getFileIcon(f.name)}
                </div>
                <div class="attached-file-details">
                    <span class="attached-file-name">${escapeHtml(f.name)}</span>
                    <span class="attached-file-size">${formatFileSize(f.size)}</span>
                </div>
            </div>
            <div class="attached-file-actions">
                <button class="file-action-btn delete" title="Remove" onclick="removeAttachedFile('${f.tempId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.removeAttachedFile = function(tempId) {
    currentEntryFiles = currentEntryFiles.filter(f => f.tempId !== tempId);
    renderAttachedFiles();
};

// Attachments Modal
function initAttachmentsModal() {
    elements.closeAttachmentsModal.addEventListener('click', closeAttachmentsModal);
    elements.attachmentsModal.addEventListener('click', (e) => {
        if (e.target === elements.attachmentsModal) closeAttachmentsModal();
    });
    
    elements.addMoreFiles.addEventListener('click', () => {
        elements.addFilesInput.click();
    });
    
    elements.addFilesInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        await addFilesToEntry(currentAttachmentsEntryId, files);
        e.target.value = '';
        await renderAttachmentsModalFiles(currentAttachmentsEntryId);
        renderEntries(); // Refresh table
    });
}

async function openAttachmentsModal(entryId) {
    currentAttachmentsEntryId = entryId;
    const entries = getEntries();
    const entry = entries.find(e => e.id === entryId);
    
    if (!entry) return;
    
    elements.attachmentEntryInfo.innerHTML = `
        <span class="bank-name">${escapeHtml(entry.provider ? entry.provider + ' - ' : '')}${escapeHtml(entry.bankName)}</span>
        <span class="case-id">${escapeHtml(entry.customerId)}</span>
    `;
    
    await renderAttachmentsModalFiles(entryId);
    elements.attachmentsModal.classList.add('active');
}

async function renderAttachmentsModalFiles(entryId) {
    const files = await getFilesForEntry(entryId);
    
    if (files.length === 0) {
        elements.attachmentsModalList.innerHTML = '';
        elements.emptyAttachments.classList.add('visible');
        return;
    }
    
    elements.emptyAttachments.classList.remove('visible');
    
    elements.attachmentsModalList.innerHTML = files.map(f => `
        <div class="attached-file">
            <div class="attached-file-info">
                <div class="attached-file-icon ${getFileIconClass(f.name)}">
                    ${getFileIcon(f.name)}
                </div>
                <div class="attached-file-details">
                    <span class="attached-file-name">${escapeHtml(f.name)}</span>
                    <span class="attached-file-size">${formatFileSize(f.size)} • ${formatDate(f.uploadedAt)}</span>
                </div>
            </div>
            <div class="attached-file-actions">
                <button class="file-action-btn download" title="Download" onclick="downloadFile('${f.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </button>
                <button class="file-action-btn delete" title="Delete" onclick="deleteAttachment('${f.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function closeAttachmentsModal() {
    elements.attachmentsModal.classList.remove('active');
    currentAttachmentsEntryId = null;
}

async function addFilesToEntry(entryId, files) {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['har', 'html', 'htm', 'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'json'];
    
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (file.size > maxSize) {
            showToast(`File "${file.name}" exceeds 10MB limit`, 'error');
            continue;
        }
        
        if (!allowedTypes.includes(ext)) {
            showToast(`File type ".${ext}" not allowed`, 'error');
            continue;
        }
        
        try {
            await saveFile(entryId, file);
        } catch (error) {
            showToast(`Error saving "${file.name}"`, 'error');
        }
    }
    
    showToast('Files uploaded successfully', 'success');
}

window.openAttachmentsModal = openAttachmentsModal;

window.downloadFile = async function(fileId) {
    const transaction = db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(fileId);
    
    request.onsuccess = () => {
        const file = request.result;
        if (file) {
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
};

window.deleteAttachment = async function(fileId) {
    if (confirm('Delete this attachment?')) {
        await deleteFile(fileId);
        await renderAttachmentsModalFiles(currentAttachmentsEntryId);
        renderEntries();
        showToast('Attachment deleted', 'success');
    }
};

// File utility functions
function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'har') return 'har';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'other';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'har') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    if (['html', 'htm'].includes(ext)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    if (ext === 'pdf') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Import/Export
function initImportExport() {
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importData);
}

function exportData() {
    const entries = getEntries();
    
    if (entries.length === 0) {
        showToast('No entries to export', 'error');
        return;
    }
    
    // Prepare data for Excel
    const excelData = entries.map(entry => ({
        'Created Date': formatDate(entry.createdAt),
        'Call Booked Date': entry.callBookedDate ? formatDateInput(entry.callBookedDate) : '',
        'Provider': entry.provider || '',
        'Bank Name': entry.bankName,
        'Customer/Case ID': entry.customerId,
        'Call Type': formatCallType(entry.callType),
        'Requested By': entry.requestedBy || '',
        'Attended By': entry.attendedBy || '',
        'Status': formatStatus(entry.status),
        'Connection Status': formatConnectionStatus(entry.connectionStatus).replace(/[⏳✓✗⚠]/g, '').trim(),
        'Error Code': entry.errorCode || '',
        'Notes': entry.notes || '',
        'Created At': entry.createdAt,
        'Updated At': entry.updatedAt || '',
        'Call Booked Date Raw': entry.callBookedDate || '',
        'ID': entry.id
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 12 },  // Created Date
        { wch: 14 },  // Call Booked Date
        { wch: 15 },  // Provider
        { wch: 20 },  // Bank Name
        { wch: 18 },  // Customer/Case ID
        { wch: 20 },  // Call Type
        { wch: 15 },  // Requested By
        { wch: 15 },  // Attended By
        { wch: 12 },  // Status
        { wch: 18 },  // Connection Status
        { wch: 15 },  // Error Code
        { wch: 30 },  // Notes
        { wch: 22 },  // Created At
        { wch: 22 },  // Updated At
        { wch: 14 },  // Call Booked Date Raw
        { wch: 20 },  // ID
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'QBO Tracker Data');
    
    // Generate and download file
    const fileName = `qbo-tracker-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast('Data exported to Excel successfully', 'success');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            // Read Excel file
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                throw new Error('No data found in Excel file');
            }
            
            // Map Excel columns to entry fields
            const importedEntries = jsonData.map(row => {
                // Try to find the ID column or generate new ID
                const id = row['ID'] || row['id'] || generateId();
                
                return {
                    id: id,
                    provider: row['Provider'] || row['provider'] || '',
                    bankName: row['Bank Name'] || row['bankName'] || row['Bank'] || '',
                    customerId: row['Customer/Case ID'] || row['customerId'] || row['Case ID'] || row['Customer ID'] || '',
                    callType: mapCallType(row['Call Type'] || row['callType'] || ''),
                    requestedBy: row['Requested By'] || row['requestedBy'] || '',
                    attendedBy: row['Attended By'] || row['attendedBy'] || '',
                    callBookedDate: row['Call Booked Date Raw'] || row['Call Booked Date'] || row['callBookedDate'] || '',
                    status: mapStatus(row['Status'] || row['status'] || 'pending'),
                    connectionStatus: mapConnectionStatus(row['Connection Status'] || row['connectionStatus'] || 'not_tested'),
                    errorCode: row['Error Code'] || row['errorCode'] || '',
                    notes: row['Notes'] || row['notes'] || '',
                    createdAt: row['Created At'] || row['createdAt'] || new Date().toISOString(),
                    updatedAt: row['Updated At'] || row['updatedAt'] || new Date().toISOString()
                };
            });
            
            // Validate entries - must have bank name and case ID
            const validEntries = importedEntries.filter(entry => 
                entry.bankName && entry.customerId
            );
            
            if (validEntries.length === 0) {
                throw new Error('No valid entries found. Ensure "Bank Name" and "Customer/Case ID" columns exist.');
            }
            
            // Merge with existing entries (avoid duplicates by id)
            const existingEntries = getEntries();
            const existingIds = new Set(existingEntries.map(e => e.id));
            
            const newEntries = validEntries.filter(e => !existingIds.has(e.id));
            const mergedEntries = [...newEntries, ...existingEntries];
            
            saveEntries(mergedEntries);
            showToast(`Imported ${newEntries.length} new entries from Excel`, 'success');
            
            updateDashboard();
            renderEntries();
            renderBanks();
        } catch (error) {
            showToast('Error importing Excel: ' + error.message, 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
}

// Helper functions for mapping imported data
function mapCallType(value) {
    const lower = (value || '').toLowerCase();
    if (lower.includes('har') || lower.includes('html') || lower.includes('collection')) {
        return 'har_collection';
    }
    if (lower.includes('verification') || lower.includes('attempt')) {
        return 'verification_attempt';
    }
    if (lower.includes('issue') || lower.includes('check')) {
        return 'issue_check';
    }
    return 'har_collection'; // default
}

function mapStatus(value) {
    const lower = (value || '').toLowerCase();
    if (lower.includes('progress')) return 'in_progress';
    if (lower.includes('complete')) return 'completed';
    if (lower.includes('error') || lower.includes('issue')) return 'error';
    if (lower.includes('pending')) return 'pending';
    return 'pending'; // default
}

function mapConnectionStatus(value) {
    const lower = (value || '').toLowerCase();
    if (lower.includes('success') || lower.includes('connected')) return 'success';
    if (lower.includes('failed') || lower.includes('fail')) return 'failed';
    if (lower.includes('error') || lower.includes('code')) return 'error_code';
    return 'not_tested'; // default
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDateInput(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatCallType(type) {
    const types = {
        har_collection: 'HAR/HTML Collection',
        verification_attempt: 'Verification Attempt',
        issue_check: 'Issue Check'
    };
    return types[type] || type;
}

function formatStatus(status) {
    const statuses = {
        pending: 'Pending',
        in_progress: 'In Progress',
        completed: 'Completed',
        error: 'Error'
    };
    return statuses[status] || status;
}

function formatConnectionStatus(status) {
    const statuses = {
        not_tested: '⏳ Not Tested',
        success: '✓ Connected',
        failed: '✗ Failed',
        error_code: '⚠ Error Code'
    };
    return statuses[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = elements.toast;
    toast.querySelector('.toast-message').textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

