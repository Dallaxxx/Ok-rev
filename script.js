// ==========================================
// STATE & DATA MANAGEMENT
// ==========================================
let currentUser = null;
let appData = {}; 
// Structure of appData[username]
// { exams: [ { id, name, type:'exam', children: [subjects...] } ] }

const STORAGE_KEY = 'revisionTrackerDB';

// ==========================================
// DOM ELEMENTS
// ==========================================
// Auth
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const logoutBtn = document.getElementById('logout-btn');

// User Profile & Settings
const displayName = document.getElementById('display-name');
const displayAge = document.getElementById('display-age');
const themeSelector = document.getElementById('theme-style-selector');
const colorPicker = document.getElementById('color-picker');
const accentColorRow = document.getElementById('accent-color-row');

// Navigation & Views
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const viewTitle = document.getElementById('current-view-title');
const viewSubtitle = document.getElementById('current-view-subtitle');

// Hierarchy (Syllabus)
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const addLevelText = document.getElementById('add-level-text');
const addItemBtn = document.getElementById('add-item-btn');
const hierarchyList = document.getElementById('hierarchy-list');

// Modal
const modal = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal');
const saveItemBtn = document.getElementById('save-item-btn');
const newItemInput = document.getElementById('new-item-name');
const modalTitle = document.getElementById('modal-title');

// Dashboard & Charts
const dueCountEl = document.getElementById('due-count');
const todayRevisionsContainer = document.getElementById('today-revisions-container');
const upcomingRevisionsContainer = document.getElementById('upcoming-revisions-container');
const progressFlowContainer = document.getElementById('progress-flow-container');
let progressChartInstance = null;

// Notification Elements
const notificationBtn = document.getElementById('notification-btn');
const notificationBadge = document.getElementById('notification-badge');
const notificationDropdown = document.getElementById('notification-dropdown');
const notificationList = document.getElementById('notification-list');
const closeNotificationsBtn = document.getElementById('close-notifications');

// Navigation State
let currentPath = []; // Array of node IDs to track where we are [examId, subjectId, chapterId]
let currentCalendarDate = new Date();

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    loadData();
    applyGlobalSettings();
    checkAuth();
    
    // Bind custom task events
    initCustomTasksUI();
    initCustomTestsUI();
    initNotificationUI();
    initCalendarUI();

    // Bind mindmap layout listener
    const layoutSelector = document.getElementById('mindmap-layout-selector');
    if(layoutSelector) {
        layoutSelector.addEventListener('change', (e) => {
            const content = document.getElementById('mindmap-content');
            if(content) {
                // Clear existing layout classes
                content.classList.remove('layout-horizontal', 'layout-grid');
                if(e.target.value !== 'vertical') {
                    content.classList.add(`layout-${e.target.value}`);
                }
            }
        });
    }
}

function applyGlobalSettings() {
    // These settings are global (per browser, not per user for simplicity)
    const savedThemeStyle = localStorage.getItem('app_theme_style') || 'light';
    const savedColor = localStorage.getItem('app_color');
    
    applyThemeStyle(savedThemeStyle);
    if(themeSelector) themeSelector.value = savedThemeStyle;
    
    if (savedColor) {
        document.documentElement.style.setProperty('--primary', savedColor);
        if(colorPicker) colorPicker.value = savedColor;
    }

    loadTelegramSettings(); // Load any saved telegram credentials
}

// ==========================================
// DATA persistence (LocalStorage)
// ==========================================
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        appData = JSON.parse(data);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    updateDashboard(); // Re-render charts/revisions on every save
}

// ==========================================
// AUTHENTICATION
// ==========================================
tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));

function switchTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active'); tabSignup.classList.remove('active');
        loginForm.classList.add('active'); signupForm.classList.remove('active');
    } else {
        tabSignup.classList.add('active'); tabLogin.classList.remove('active');
        signupForm.classList.add('active'); loginForm.classList.remove('active');
    }
    loginError.innerText = ''; signupError.innerText = '';
}

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const age = document.getElementById('signup-age').value;
    const password = document.getElementById('signup-password').value;

    if (appData[name]) {
        signupError.innerText = "Username already exists!";
        return;
    }

    appData[name] = {
        profile: { name, age, password },
        exams: [],
        customTasks: []
    };
    
    saveData();
    loginUser(name, password, signupError);
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value;
    loginUser(name, password, loginError);
});

function loginUser(name, password, errorElement) {
    const user = appData[name];
    if (user && user.profile.password === password) {
        // Successful login
        localStorage.setItem('currentUser', name);
        checkAuth();
    } else {
        errorElement.innerText = "Invalid username or password!";
    }
}

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    checkAuth();
});

function checkAuth() {
    const loggedInUser = localStorage.getItem('currentUser');
    if (loggedInUser && appData[loggedInUser]) {
        currentUser = appData[loggedInUser];
        
        // Safety config for legacy accounts
        if(!currentUser.customTasks) currentUser.customTasks = [];
        
        // Setup UI
        displayName.innerText = currentUser.profile.name;
        displayAge.innerText = `Age: ${currentUser.profile.age}`;
        
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Default to Dashboard
        switchView('dashboard');
        updateDashboard();
        updateNotifications();
        
        // Fire notifications for due items
        checkAndFireNotifications();
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        currentUser = null;
    }
}

// ==========================================
// SETTINGS LOGIC (Theme & Color)
// ==========================================
if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
        applyThemeStyle(e.target.value);
        localStorage.setItem('app_theme_style', e.target.value);
        updateDashboard();
    });
}

function applyThemeStyle(styleCode) {
    document.documentElement.classList.remove('dark-mode', 'theme-chatgpt');
    if (accentColorRow) accentColorRow.style.display = 'flex'; // Default show color picker
    
    if (styleCode === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else if (styleCode === 'chatgpt') {
        document.documentElement.classList.add('theme-chatgpt');
        if (accentColorRow) accentColorRow.style.display = 'none'; // Hide color picker, theme sets it to B&W
    }
}

colorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem('app_color', color);
    updateDashboard();
});

// ==========================================
// DATA EXPORT & IMPORT (BACKUP)
// ==========================================
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

// Telegram Elements
const tgTokenInput = document.getElementById('tg-bot-token');
const tgChatIdInput = document.getElementById('tg-chat-id');
const tgSyncBtn = document.getElementById('tg-sync-btn');

function loadTelegramSettings() {
    if(tgTokenInput) tgTokenInput.value = localStorage.getItem('tg_token') || '';
    if(tgChatIdInput) tgChatIdInput.value = localStorage.getItem('tg_chat_id') || '';
}

if(tgSyncBtn) {
    tgSyncBtn.addEventListener('click', async () => {
        const token = tgTokenInput.value.trim();
        const chatId = tgChatIdInput.value.trim();
        
        if(!token || !chatId) {
            alert("Please enter both Bot Token and Chat ID to sync to Telegram.");
            return;
        }

        // Save for future use
        localStorage.setItem('tg_token', token);
        localStorage.setItem('tg_chat_id', chatId);

        // Prepare File to Upload
        const dataStr = JSON.stringify(appData, null, 2);
        const fileName = `RevisionTracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([dataStr], { type: "application/json" });
        const file = new File([blob], fileName);

        // Prepare Form Data for Telegram API
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("document", file);
        formData.append("caption", "☁️ Your automated backup from Revision Tracker App.");

        const apiUrl = `https://api.telegram.org/bot${token}/sendDocument`;

        tgSyncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
        tgSyncBtn.disabled = true;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if(result.ok) {
                alert("Backup sent to Telegram successfully!");
            } else {
                alert("Telegram API Error: " + (result.description || "Check your credentials."));
            }
        } catch(error) {
            alert("Failed to send backup. Check your internet connection.\nError: " + error.message);
        } finally {
            tgSyncBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Sync to Cloud';
            tgSyncBtn.disabled = false;
        }
    });
}

if(exportBtn) {
    exportBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `RevisionTracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

if(importBtn && importFile) {
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                // Basic validation
                if (typeof importedData === 'object') {
                    appData = importedData;
                    saveData();
                    alert("Data restored successfully!");
                    checkAuth(); // Reload UI based on possibly new users or current user
                } else {
                    alert("Invalid backup file format.");
                }
            } catch (error) {
                alert("Error reading file: " + error.message);
            }
        };
        reader.readAsText(file);
        
        // Reset input so the same file can be selected again if needed
        importFile.value = '';
    });
}

// ==========================================
// NAVIGATION (Sidebar)
// ==========================================
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchView(btn.dataset.view);
    });
});

function switchView(viewName) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    // Update headers
    if (viewName === 'dashboard') {
        viewTitle.innerText = "Dashboard Overview";
        viewSubtitle.innerText = "Track your overall progress and upcoming tasks.";
        updateDashboard();
    } else if (viewName === 'syllabus') {
        viewTitle.innerText = "My Syllabus Builder";
        viewSubtitle.innerText = "Organize your study material into Exams, Subjects, Chapters, and Topics.";
        currentPath = []; // Reset to root
        renderHierarchy();
    } else if (viewName === 'mindmap') {
        viewTitle.innerText = "Syllabus Mind Map";
        viewSubtitle.innerText = "A birds-eye view of your entire structural progress.";
        renderMindMap();
    } else if (viewName === 'revisions') {
        viewTitle.innerText = "Due Revisions";
        viewSubtitle.innerText = "Stay on track with spaced repetition schedules.";
        renderRevisionsList();
    } else if (viewName === 'tests') {
        viewTitle.innerText = "Tests Planner";
        viewSubtitle.innerText = "Create and schedule custom evaluation tests.";
        renderTestsList();
    } else if (viewName === 'exam-dashboard') {
        // Handled via the handleExamDashboardClick
    }
}

// ==========================================
// HIERARCHY LOGIC (Syllabus Builder)
// ==========================================
// Levels: 0=Exam, 1=Subject, 2=Chapter
const levelNames = ['Exam', 'Subject', 'Chapter'];

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Find a node by ID dynamically navigating the path
function getNodeByPath(pathArray) {
    let currentLevel = currentUser.exams;
    let targetNode = null;

    for (let i = 0; i < pathArray.length; i++) {
        const id = pathArray[i];
        const node = currentLevel.find(n => n.id === id);
        if (!node) return null;
        
        targetNode = node;
        currentLevel = node.children || [];
    }
    return targetNode;
}

function getChildrenArray() {
    if (currentPath.length === 0) return currentUser.exams;
    const parent = getNodeByPath(currentPath);
    if (!parent.children) parent.children = [];
    return parent.children;
}

// Render dynamic list
function renderHierarchy() {
    hierarchyList.innerHTML = '';
    
    // 1. Update Breadcrumbs & Buttons
    renderBreadcrumbs();
    
    const currentDepth = currentPath.length;
    // We only have 3 levels (0 to 2). If depth < 3, there's a next level to add.
    const nextItemName = currentDepth < 3 ? levelNames[currentDepth] : null;
    
    if (nextItemName) {
        addItemBtn.classList.remove('hidden');
        addLevelText.innerText = nextItemName;
    } else {
        addItemBtn.classList.add('hidden'); // Cannot add deeper than Chapter
    }

    // 2. Render List Items
    const items = getChildrenArray();
    
    if (items.length === 0) {
        hierarchyList.innerHTML = `<div class="list-item text-muted" style="justify-content:center;">No ${nextItemName ? nextItemName + 's' : 'items'} found. Click 'Add New' to begin.</div>`;
        return;
    }

    items.forEach(item => {
        // Chapter is now the final level (depth 2)
        const isChapter = currentDepth === 2;
        const iconInfo = getIconInfo(currentDepth);
        let progressHtml = '';
        let progressPercent = 0;

        if (!isChapter) {
            progressPercent = calculateNodePercentage(item);
            let pClass = getProgressAnimationClass(progressPercent);
            
            progressHtml = `
                <div class="inline-progress">
                    <div class="progress-bar-bg" style="height: 6px; width: 60px; margin-top: 5px;">
                        <div class="progress-bar-fill ${pClass}" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            `;
        }
        
        const div = document.createElement('div');
        div.className = `list-item ${isChapter && item.completed ? 'chapter-item completed' : ''}`;
        
        let chapterRightHtml = '';
        if (isChapter) {
            let isLocked = !item.completed;
            let lockedStyle = isLocked ? 'opacity: 0.5; pointer-events: none;' : '';

            // Revisions UI
            let revHtml = `<div style="display:flex; gap: 5px; margin-right: 15px; ${lockedStyle}" title="${isLocked ? 'Complete chapter first' : 'Revisions (3)'}">
                <span style="font-size:0.8rem; color:var(--text-muted); align-self:center;">Rev:</span>
                ${[0,1,2].map(i => `<input type="checkbox" ${isLocked || (item.revisionTicks && item.revisionTicks[i]) ? 'disabled' : ''} ${item.revisionTicks && item.revisionTicks[i] ? 'checked' : ''} onchange="updateRevisionTick('${item.id}', ${i}, this.checked)">`).join('')}
            </div>`;

            // PYQs UI
            let pyqHtml = `<div style="display:flex; gap: 5px; margin-right: 15px; ${lockedStyle}" title="${isLocked ? 'Complete chapter first' : 'PYQs (3)'}">
                <span style="font-size:0.8rem; color:var(--text-muted); align-self:center;">PYQ:</span>
                ${[0,1,2].map(i => `<input type="checkbox" ${isLocked || (item.pyqTicks && item.pyqTicks[i]) ? 'disabled' : ''} ${item.pyqTicks && item.pyqTicks[i] ? 'checked' : ''} onchange="updatePyqTick('${item.id}', ${i}, this.checked)">`).join('')}
            </div>`;

            // Tests UI
            let testHtml = `<div style="display:flex; gap: 5px; margin-right: 15px; align-items:center; ${lockedStyle}" title="${isLocked ? 'Complete chapter first' : 'Tests Taken'}">
                <span style="font-size:0.8rem; color:var(--text-muted);">Tests:</span>
                <button onclick="updateTestCount('${item.id}', -1)" style="border:none; background:transparent; cursor:pointer; color:var(--danger); ${isLocked?'display:none;':''}"><i class="fa-solid fa-minus"></i></button>
                <span style="font-size:0.85rem; font-weight:bold; min-width: 12px; text-align:center;">${item.testCount || 0}</span>
                <button onclick="updateTestCount('${item.id}', 1)" style="border:none; background:transparent; cursor:pointer; color:var(--secondary); ${isLocked?'display:none;':''}"><i class="fa-solid fa-plus"></i></button>
            </div>`;

            // Main Chapter switch
            let mainCheckboxHtml = `<input type="checkbox" class="chapter-checkbox" ${item.completed ? 'checked disabled' : ''} onchange="toggleChapter('${item.id}', this)">`;

            chapterRightHtml = `
                <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                    <div style="display:flex; align-items:center;">
                        ${revHtml}
                        ${pyqHtml}
                        ${testHtml}
                    </div>
                </div>
                <div style="margin-left: 15px; align-self: center;">
                    ${mainCheckboxHtml}
                    <button class="icon-btn tooltip" onclick="deleteItem('${item.id}')" style="margin-left:10px;"><i class="fa-solid fa-trash-can" style="color:var(--danger); font-size:14px;"></i></button>
                </div>
            `;
        }

        // Disable click navigation if it's a chapter
        div.innerHTML = `
            <div class="item-left" style="align-items: flex-start;" ${!isChapter ? `onclick="navigateTo('${item.id}', '${item.name}')"` : ''}>
                <div class="item-icon" style="margin-top: 2px;">${iconInfo}</div>
                <div class="item-info">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <h4 style="margin: 0;">${item.name}</h4>
                        ${!isChapter ? `<span style="font-size: 11px; font-weight: bold; color: ${progressPercent === 100 ? 'var(--secondary)' : 'var(--primary)'};">${progressPercent}%</span>` : ''}
                    </div>
                    <p style="margin-top: 3px;">${isChapter ? 
                        (item.completed ? `Completed on: ${new Date(item.completedDate).toLocaleDateString()}` : 'Pending') : 
                        `${item.children ? item.children.length : 0} items inside`}</p>
                    ${progressHtml}
                </div>
            </div>
            <div class="item-right" style="align-self:stretch; display:flex; align-items:center; justify-content:flex-end;">
                ${isChapter ? chapterRightHtml : 
                `<button class="icon-btn tooltip" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash-can" style="color:var(--danger); font-size:14px;"></i></button>`}
            </div>
        `;
        hierarchyList.appendChild(div);
    });
}

function getIconInfo(depth) {
        if (depth === 0) return '<i class="fa-solid fa-graduation-cap"></i>';
        if (depth === 1) return '<i class="fa-solid fa-book"></i>';
        return '<i class="fa-solid fa-file-lines"></i>'; // Chapter is now the final icon
    }

// Navigation helpers
window.navigateTo = function(id, name) {
    currentPath.push(id);
    renderHierarchy();
}

function navigateToPathIndex(index) {
    // Slice path up to index
    if (index === -1) currentPath = [];
    else currentPath = currentPath.slice(0, index + 1);
    renderHierarchy();
}

function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = `<span class="crumb" onclick="navigateToPathIndex(-1)">All Exams</span>`;
    let buildPath = [];
    
    currentPath.forEach((id, index) => {
        buildPath.push(id);
        const node = getNodeByPath(buildPath);
        if (node) {
            breadcrumbsContainer.innerHTML += `<span class="crumb" onclick="navigateToPathIndex(${index})">${node.name}</span>`;
        }
    });
}

// Modal actions
addItemBtn.addEventListener('click', () => {
    newItemInput.value = '';
    modalTitle.innerText = `Add New ${levelNames[currentPath.length]}`;
    modal.classList.remove('hidden');
    newItemInput.focus();
});

closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

saveItemBtn.addEventListener('click', () => {
    const name = newItemInput.value.trim();
    if (!name) return;
    
    // Safety check in case depth is already 3
    if (currentPath.length >= 3) return;

    const depth = currentPath.length;
    const isChapter = depth === 2;
    
    const newItem = {
        id: generateId(),
        name: name,
        type: levelNames[depth].toLowerCase(),
    };

    if (isChapter) {
        newItem.completed = false;
        newItem.revisionsDone = 0; // Legacy tracks due dates met
        newItem.revisionTicks = [false, false, false]; // The physical checkboxes
        newItem.pyqTicks = [false, false, false];
        newItem.testCount = 0;
    } else {
        newItem.children = [];
    }

    getChildrenArray().push(newItem);
    saveData();
    modal.classList.add('hidden');
    renderHierarchy();
});


// Delete Action
window.deleteItem = function(id) {
    if(!confirm("Are you sure you want to delete this item? All contents inside will be lost.")) return;
    
    const items = getChildrenArray();
    const index = items.findIndex(i => i.id === id);
    if(index !== -1) {
        items.splice(index, 1);
        saveData();
        renderHierarchy();
    }
}

// ==========================================
// MIND MAP RENDERER (Advanced with Zoom/Pan)
// ==========================================
let currentMindmapLayout = 'central';
let currentMindmapExam = 'all';

// Zoom/Pan Variables
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

document.addEventListener('DOMContentLoaded', () => {
    const layoutSelector = document.getElementById('mindmap-layout-selector');
    if (layoutSelector) {
        layoutSelector.addEventListener('change', (e) => {
            currentMindmapLayout = e.target.value;
            renderMindMap();
        });
    }

    const examSelector = document.getElementById('mindmap-exam-selector');
    if (examSelector) {
        examSelector.addEventListener('change', (e) => {
            currentMindmapExam = e.target.value;
            renderMindMap();
        });
    }

    const downloadBtn = document.getElementById('download-mindmap-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleExport);
    }

    initZoomPan();
});

function initZoomPan() {
    const viewport = document.getElementById('mindmap-viewport');
    const content = document.getElementById('mindmap-content');
    const btnIn = document.getElementById('zoom-in-btn');
    const btnOut = document.getElementById('zoom-out-btn');
    const btnReset = document.getElementById('zoom-reset-btn');

    if(!viewport || !content) return;

    function applyTransform() {
        content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }

    if(btnIn) btnIn.addEventListener('click', () => { zoomLevel = Math.min(zoomLevel + 0.2, 3); applyTransform(); });
    if(btnOut) btnOut.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel - 0.2, 0.3); applyTransform(); });
    if(btnReset) btnReset.addEventListener('click', () => { zoomLevel = 1; panX = 0; panY = 0; applyTransform(); });

    viewport.addEventListener('mousedown', (e) => {
        if(e.target.closest('.mm-node') || e.target.closest('.icon-btn')) return;
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if(!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    });

    window.addEventListener('mouseleave', () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    });
    
    viewport.addEventListener('wheel', (e) => {
        if(e.target.closest('.mindmap-controls')) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomLevel = Math.min(Math.max(zoomLevel + delta, 0.3), 3);
        applyTransform();
    }, {passive: false});
}

function updateMindmapExamSelector() {
    const selector = document.getElementById('mindmap-exam-selector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="all">All Exams Overview</option>';
    if (currentUser && currentUser.exams.length > 0) {
        currentUser.exams.forEach(ex => {
            let opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            selector.appendChild(opt);
        });
    }
    selector.value = currentMindmapExam;
}

function renderMindMap() {
    updateMindmapExamSelector();
    const container = document.getElementById('mindmap-content');
    container.innerHTML = '';

    if (!currentUser || currentUser.exams.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">No syllabus added yet.</p>';
        return;
    }

    let examsToRender = currentUser.exams;
    if (currentMindmapExam !== 'all') {
        examsToRender = currentUser.exams.filter(e => e.id === currentMindmapExam);
    }

    if (currentMindmapLayout === 'central') {
        container.className = 'mindmap-content central-layout';
        renderCentralMindMap(examsToRender, container);
    } else {
        container.className = 'mindmap-content logical-layout';
        renderLogicalMindMap(examsToRender, container);
    }

    // Add collapse functionality
    container.querySelectorAll('.mm-subject').forEach(node => {
        node.title = "Click to collapse/expand chapters";
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            let wrapper = node.closest('.central-branch, .logical-group');
            if(!wrapper) return;
            
            let childrenContainer = wrapper.querySelector('.mindmap-children-container');
            
            if(childrenContainer) {
                const isHidden = childrenContainer.style.display === 'none';
                childrenContainer.style.display = isHidden ? 'flex' : 'none';
                node.style.opacity = isHidden ? '1' : '0.6';
                drawMindMapConnections(container);
            }
        });
    });

    setTimeout(() => drawMindMapConnections(container), 200);
}

function renderLogicalMindMap(exams, container) {
    let html = '';
    exams.forEach(exam => {
        const eProgress = calculateNodePercentage(exam);
        const rootHtml = `<div class="mm-node mm-root mm-exam" data-id="${exam.id}">${exam.name} (${eProgress}%)</div>`;
        
        let childrenHtml = '';
        if (exam.children) {
            childrenHtml = '<div class="logical-column" style="gap: 15px;">';
            exam.children.forEach(sub => {
                const sProgress = calculateNodePercentage(sub);
                let chList = '';
                if(sub.children) {
                    chList = '<div class="logical-column mindmap-children-container" style="gap: 10px;">';
                    sub.children.forEach(ch => {
                        let cls = ch.completed ? 'completed' : '';
                        chList += `<div class="logical-group"><div class="mm-node mm-chapter ${cls}" data-id="${ch.id}" data-parent="${sub.id}"><i class="${ch.completed ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'}"></i> ${ch.name}</div></div>`;
                    });
                    chList += '</div>';
                }
                
                childrenHtml += `
                    <div class="logical-group">
                        <div class="logical-column" style="align-items: flex-end;">
                            <div class="mm-node mm-subject" data-id="${sub.id}" data-parent="${exam.id}">${sub.name} (${sProgress}%)</div>
                        </div>
                        ${chList}
                    </div>
                `;
            });
            childrenHtml += '</div>';
        }

        html += `<div class="logical-group" style="margin-bottom: 50px; align-items: center;">${rootHtml}${childrenHtml}</div>`;
    });
    container.innerHTML = html;
}

function renderCentralMindMap(exams, container) {
    let rootName = "All Syllabus";
    let rootProgress = 0;
    let rootId = "root_all";
    let subjects = [];

    if (exams.length === 1) {
        rootName = exams[0].name;
        rootProgress = calculateNodePercentage(exams[0]);
        rootId = exams[0].id;
        subjects = exams[0].children || [];
    } else {
        let stats = calculateProgress(exams);
        rootProgress = stats.totalPoints > 0 ? ((stats.earnedPoints / stats.totalPoints) * 100).toFixed(1) : 0;
        exams.forEach(ex => {
            if(ex.children) subjects = subjects.concat(ex.children.map(s => ({...s, parentExamId: ex.id})));
        });
    }

    // Flex layout: Left Wing | Center Root | Right Wing
    container.innerHTML = `
        <div class="central-wing left" id="cw-left"></div>
        <div class="central-root-column">
            <div class="mm-node mm-root mm-exam" data-id="${rootId}">${rootName} (${rootProgress}%)</div>
        </div>
        <div class="central-wing right" id="cw-right"></div>
    `;

    const leftWing = container.querySelector('#cw-left');
    const rightWing = container.querySelector('#cw-right');

    subjects.forEach((sub, index) => {
        const sProgress = calculateNodePercentage(sub);
        const isLeft = index % 2 !== 0; 
        
        let chList = '';
        if(sub.children && sub.children.length > 0) {
            chList = '<div class="central-children mindmap-children-container">';
            sub.children.forEach(ch => {
                let cls = ch.completed ? 'completed' : '';
                chList += `<div class="mm-node mm-chapter ${cls}" data-id="${ch.id}" data-parent="${sub.id}"><i class="${ch.completed ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'}"></i> ${ch.name}</div>`;
            });
            chList += '</div>';
        }

        const subHtml = `
            <div class="central-branch">
                <div class="central-children" style="${isLeft ? 'align-items: flex-end;' : 'align-items: flex-start;'}">
                     <div class="mm-node mm-subject" data-id="${sub.id}" data-parent="${rootId}">${sub.name} (${sProgress}%)</div>
                </div>
                ${chList}
            </div>
        `;

        if (isLeft) leftWing.innerHTML += subHtml;
        else rightWing.innerHTML += subHtml;
    });
}

function drawMindMapConnections(container) {
    let oldSvg = container.querySelector('.mindmap-svg-overlay');
    if (oldSvg) oldSvg.remove();

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "mindmap-svg-overlay");
    
    const containerRect = container.getBoundingClientRect();
    // Only target nodes that are currently visible
    const childNodes = Array.from(container.querySelectorAll('.mm-node[data-parent]'))
                            .filter(n => n.offsetParent !== null);
    
    childNodes.forEach(child => {
        const parentId = child.getAttribute('data-parent');
        const parent = container.querySelector(`.mm-node[data-id="${parentId}"]`);
        
        if (parent && parent.offsetParent !== null) {
            const pRect = parent.getBoundingClientRect();
            const cRect = child.getBoundingClientRect();

            // Calculate anchor points relative to content scale (zoom level might distort getBoundingClientRect values relative to container)
            // But since SVG is inside content wrapper, it scales naturally. We just calculate raw offsets.
            const pX = parent.offsetLeft;
            const pY = parent.offsetTop;
            const pW = parent.offsetWidth;
            const pH = parent.offsetHeight;

            const cX = child.offsetLeft;
            const cY = child.offsetTop;
            const cW = child.offsetWidth;
            const cH = child.offsetHeight;

            let x1 = pX + pW / 2;
            let y1 = pY + pH / 2;
            let x2 = cX + cW / 2;
            let y2 = cY + cH / 2;

            if(container.classList.contains('logical-layout')) {
                x1 = pX + pW;
                x2 = cX;
            } else if (container.classList.contains('central-layout')) {
                if(x1 < x2) { // Target is Right
                   x1 = pX + pW;
                   x2 = cX;
                } else if (x1 > x2) { // Target is Left
                   x1 = pX;
                   x2 = cX + cW;
                }
            }

            let cx1 = x1 + (x2 - x1) / 2;
            let cy1 = y1;
            let cx2 = x1 + (x2 - x1) / 2;
            let cy2 = y2;
            
            if(container.classList.contains('central-layout')) {
                let tension = Math.abs(x2 - x1) * 0.5;
                if(x2 < x1) {
                    cx1 = x1 - tension; cx2 = x2 + tension;
                } else {
                    cx1 = x1 + tension; cx2 = x2 - tension;
                }
            }

            const path = document.createElementNS(svgNs, "path");
            path.setAttribute("d", `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
            path.setAttribute("fill", "transparent");
            path.setAttribute("stroke", "var(--border-light)");
            path.setAttribute("stroke-width", "2");

            svg.appendChild(path);
        }
    });
    container.appendChild(svg);
}

window.addEventListener('resize', () => {
    const mmView = document.getElementById('view-mindmap');
    if(mmView && mmView.classList.contains('active')) {
        drawMindMapConnections(document.getElementById('mindmap-content'));
    }
});

// ==========================================
// VECTOR EXPORT & PRINT LOGIC (PDF/SVG)
// ==========================================
function handleExport() {
    const mode = document.getElementById('export-mode').value;
    if (mode === 'vector-svg') {
        exportMindMapToSVG();
    } else if (mode === 'vector-pdf') {
        prepareAndPrint(false);
    } else if (mode === 'vector-pdf-multi') {
        prepareAndPrint(true);
    }
}

function prepareAndPrint(multiPage) {
    document.body.classList.add('print-mode');
    
    const element = document.getElementById('mindmap-content');
    const viewport = document.getElementById('mindmap-viewport');
    
    // Temporarily reset pan/zoom
    const oldZoom = zoomLevel;
    const oldPanX = panX;
    const oldPanY = panY;
    zoomLevel = 1; panX = 0; panY = 0;
    element.style.transform = `translate(0px, 0px) scale(1)`;
    
    const oldVPHeight = viewport.style.height;
    const oldVPWidth = viewport.style.width;
    const oldVPOverflow = viewport.style.overflow;
    
    // Let CSS @media print handle dimensions, but enforce inline prep
    viewport.style.height = 'auto';
    viewport.style.width = '100%';
    viewport.style.overflow = 'visible';

    let oldHTML = null;
    let oldClass = element.className;
    
    if(multiPage) {
        oldHTML = element.innerHTML;
        renderMultiPageLayout(element);
    } else {
        drawMindMapConnections(element);
    }

    // Give browser time to reflow DOM
    setTimeout(() => {
        window.print();
        
        // Restore DOM after print dialog is closed
        document.body.classList.remove('print-mode');
        if(multiPage) {
            element.innerHTML = oldHTML;
            element.className = oldClass;
        }
        
        viewport.style.height = oldVPHeight;
        viewport.style.width = oldVPWidth || '100%';
        viewport.style.overflow = oldVPOverflow;
        zoomLevel = oldZoom; panX = oldPanX; panY = oldPanY;
        element.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        drawMindMapConnections(element);
    }, 500);
}

function renderMultiPageLayout(container) {
    container.innerHTML = '';
    container.className = 'mindmap-content logical-layout multipage-print-mode';
    
    let examsToRender = currentUser.exams;
    if (currentMindmapExam !== 'all') {
        examsToRender = currentUser.exams.filter(e => e.id === currentMindmapExam);
    }

    let blocksHTML = '';
    examsToRender.forEach(exam => {
        if(exam.children) {
            exam.children.forEach(sub => {
                const sProgress = calculateNodePercentage(sub);
                let chList = '';
                if(sub.children) {
                    chList = '<div class="logical-column" style="gap: 15px;">';
                    sub.children.forEach(ch => {
                        let cls = ch.completed ? 'completed' : '';
                        chList += `<div class="logical-group"><div class="mm-node mm-chapter ${cls}" data-id="${ch.id}" data-parent="${sub.id}"><i class="${ch.completed ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'}"></i> ${ch.name}</div></div>`;
                    });
                    chList += '</div>';
                }
                
                blocksHTML += `
                    <div class="print-page-block" style="padding: 40px; width: 100%; position: relative;">
                        <h2 style="font-family: sans-serif; font-size: 24px; color: var(--text-main); margin-bottom: 40px; text-transform: uppercase;">${exam.name} - ${sub.name}</h2>
                        <div class="logical-group print-logical-container" style="position: relative; display: flex; align-items: center; gap: 40px;">
                            <div class="logical-column" style="align-items: flex-end;">
                                <div class="mm-node mm-subject" data-id="${sub.id}" style="font-size: 16px; font-weight: bold;">${sub.name} (${sProgress}%)</div>
                            </div>
                            ${chList}
                        </div>
                    </div>
                `;
            });
        }
    });
    
    container.innerHTML = blocksHTML;

    // Connect SVGs per block natively
    const blocks = container.querySelectorAll('.print-logical-container');
    const svgNs = "http://www.w3.org/2000/svg";
    blocks.forEach(block => {
        const svg = document.createElementNS(svgNs, "svg");
        svg.setAttribute("class", "mindmap-svg-overlay");
        svg.style.position = "absolute";
        svg.style.top = "0"; svg.style.left = "0";
        svg.style.width = "100%"; svg.style.height = "100%";
        svg.style.zIndex = "1";
        
        const parent = block.querySelector('.mm-subject');
        const childNodes = block.querySelectorAll('.mm-chapter');
        
        if(parent && childNodes.length > 0) {
            const pX = parent.offsetLeft;
            const pY = parent.offsetTop;
            const pW = parent.offsetWidth;
            const pH = parent.offsetHeight;

            childNodes.forEach(child => {
                const cX = child.offsetLeft;
                const cY = child.offsetTop;
                const cW = child.offsetWidth;
                const cH = child.offsetHeight;

                let x1 = pX + pW;
                let y1 = pY + pH / 2;
                let x2 = cX;
                let y2 = cY + cH / 2;

                let cx1 = x1 + (x2 - x1) / 2;
                let cy1 = y1;
                let cx2 = x1 + (x2 - x1) / 2;
                let cy2 = y2;

                const path = document.createElementNS(svgNs, "path");
                path.setAttribute("d", `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
                path.setAttribute("fill", "transparent");
                path.setAttribute("stroke", "var(--border-light)");
                path.setAttribute("stroke-width", "2");

                svg.appendChild(path);
            });
            block.appendChild(svg);
        }
    });
}

function exportMindMapToSVG() {
    const container = document.getElementById('mindmap-content');
    if(!container) return;

    const oldZoom = zoomLevel;
    const oldPanX = panX;
    const oldPanY = panY;
    zoomLevel = 1; panX = 0; panY = 0;
    container.style.transform = `translate(0px, 0px) scale(1)`;
    drawMindMapConnections(container);

    const pad = 60;
    const w = container.scrollWidth + pad;
    const h = container.scrollHeight + pad;

    const bg = window.getComputedStyle(document.body).backgroundColor;

    // Multiply native width/height by 5 to prevent pixelation in naive image viewers that rasterize SVGs
    let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 5}" height="${h * 5}" viewBox="-${pad/2} -${pad/2} ${w} ${h}" style="background-color: ${bg}; font-family: sans-serif;" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">`;
    
    const computedBorderLib = getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim() || '#e2e8f0';

    const overlay = container.querySelector('.mindmap-svg-overlay');
    if(overlay) {
        let pathsHtml = overlay.innerHTML;
        pathsHtml = pathsHtml.replace(/var\(--border-light\)/g, computedBorderLib);
        svgStr += pathsHtml;
    }

    const nodes = container.querySelectorAll('.mm-node');
    
    nodes.forEach(node => {
        if(node.offsetParent === null) return;
        
        const x = node.offsetLeft;
        const y = node.offsetTop;
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        
        const style = window.getComputedStyle(node);
        const bgColor = style.backgroundColor;
        const color = style.color;
        
        let borderLeftColor = style.borderLeftColor;
        let borderLeftWidth = parseFloat(style.borderLeftWidth) || 0;
        let borderColor = style.borderColor;
        let borderWidth = parseFloat(style.borderWidth) || 0;
        
        const ry = 6;
        
        if(node.classList.contains('mm-exam')) {
           svgStr += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${ry}" ry="${ry}" fill="${bgColor}" />`;
        } else {
           svgStr += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${ry}" ry="${ry}" fill="${bgColor}" stroke="${borderColor}" stroke-width="${borderWidth}" />`;
           if (borderLeftWidth > 0 && borderLeftWidth < 10) {
              svgStr += `<path d="M ${x + ry} ${y} L ${x} ${y} A ${ry} ${ry} 0 0 0 ${x} ${y+ry} L ${x} ${y+height-ry} A ${ry} ${ry} 0 0 0 ${x+ry} ${y+height}" fill="none" stroke="${borderLeftColor}" stroke-width="${borderLeftWidth}" />`;
           }
        }

        const cleanText = node.innerText.replace(/[\uF000-\uF8FF]/g, '').trim(); 
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = style.fontWeight;
        
        const textY = y + height / 2 + (fontSize * 0.35); 
        const textHeightOffset = style.paddingTop ? parseFloat(style.paddingTop) : 0;
        
        // Horizontal text alignment approximation
        const textX = x + (width / 2);
        
        svgStr += `<text x="${textX}" y="${textY}" fill="${color}" font-size="${fontSize}px" font-weight="${fontWeight}" text-anchor="middle">${cleanText}</text>`;
    });

    svgStr += `</svg>`;

    zoomLevel = oldZoom; panX = oldPanX; panY = oldPanY;
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    drawMindMapConnections(container);

    const blob = new Blob([svgStr], {type: "image/svg+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Syllabus_MindMap_${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// ==========================================
// CHAPTER COMPLETION & REVISION LOGIC
// ==========================================
window.toggleChapter = function(chapterId, checkboxEl) {
    const chapter = getChildrenArray().find(t => t.id === chapterId);
    if (chapter) {
        if (!chapter.completed) {
            if (confirm("Mark chapter as complete? This action cannot be undone.")) {
                chapter.completed = true;
                const todayStr = new Date().toISOString(); 
                chapter.completedDate = todayStr;
                chapter.revisionsDone = 0;
                // Schedule revisions (3, 5, 10 days)
                chapter.revisions = [
                    calculateDateOffsets(todayStr, 3),
                    calculateDateOffsets(todayStr, 5),
                    calculateDateOffsets(todayStr, 10)
                ];
                saveData();
                renderHierarchy();
            } else {
                if (checkboxEl) checkboxEl.checked = false;
            }
        }
    }
}

window.updateRevisionTick = function(chapterId, index, isChecked) {
    const chapter = getChildrenArray().find(t => t.id === chapterId);
    if(chapter && isChecked) {
        if(confirm(`Mark Revision ${index + 1} as complete? This cannot be undone.`)){
            if(!chapter.revisionTicks) chapter.revisionTicks = [false, false, false];
            chapter.revisionTicks[index] = true;
            saveData();
            renderHierarchy();
        } else {
            // Uncheck visually if they cancel
            setTimeout(renderHierarchy, 50);
        }
    }
}

window.updatePyqTick = function(chapterId, index, isChecked) {
    const chapter = getChildrenArray().find(t => t.id === chapterId);
    if(chapter && isChecked) {
        if(confirm(`Mark PYQ ${index + 1} as complete? This cannot be undone.`)){
            if(!chapter.pyqTicks) chapter.pyqTicks = [false, false, false];
            chapter.pyqTicks[index] = true;
            saveData();
            renderHierarchy();
        } else {
            setTimeout(renderHierarchy, 50);
        }
    }
}

window.updateTestCount = function(chapterId, delta) {
    const chapter = getChildrenArray().find(t => t.id === chapterId);
    if(chapter) {
        if(typeof chapter.testCount === 'undefined') chapter.testCount = 0;
        const newCount = chapter.testCount + delta;
        if(newCount >= 0) {
            chapter.testCount = newCount;
            // No confirmation for tests since it's just informational
            saveData();
            renderHierarchy();
        }
    }
}

function calculateDateOffsets(baseDateIso, daysToAdd) {
    const date = new Date(baseDateIso);
    date.setDate(date.getDate() + daysToAdd);
    // Return only Date part (YYYY-MM-DD) for easier comparison
    return date.toISOString().split('T')[0];
}

// Initialize
init();

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

function updateDashboard() {
    if (!currentUser) return;

    // 1. Calculate overall progress and collect due revisions
    const stats = calculateProgress(currentUser.exams);
    
    // 2. Render Overall Progress Pie Chart
    renderPieChart(stats.totalCompleted, stats.totalPending, stats);
    
    // Clear subject breakdown initially
    document.getElementById('subjectPieChart').style.display = 'none';
    document.getElementById('subjectChartPlaceholder').style.display = 'block';
    document.getElementById('subjectBreakdownContainer').innerHTML = '';

    // 3. Render Progress Flow
    renderProgressFlow(currentUser.exams);

    // 4. Update Revisions and Tests Lists
    renderRevisionsList();
    renderTestsList();
    
    // 5. Render Dashboard Calendar
    renderDashboardCalendar();
}

function calculateProgress(nodes) {
    let stats = { totalChapters: 0, totalCompleted: 0, totalPending: 0, totalPoints: 0, earnedPoints: 0 };
    
    nodes.forEach(node => {
        if (node.type === 'chapter') {
            stats.totalChapters++;
            stats.totalPoints += 7; // 1 for complete, 3 for revs, 3 for PYQs
            
            let earned = 0;
            if (node.completed) earned += 1;
            if (node.revisionTicks) earned += node.revisionTicks.filter(t => t).length;
            if (node.pyqTicks) earned += node.pyqTicks.filter(t => t).length;
            
            stats.earnedPoints += earned;
            
            if (earned === 7) stats.totalCompleted++;
            else stats.totalPending++;
        } else if (node.children) {
            const childStats = calculateProgress(node.children);
            stats.totalChapters += childStats.totalChapters;
            stats.totalCompleted += childStats.totalCompleted;
            stats.totalPending += childStats.totalPending;
            stats.totalPoints += childStats.totalPoints;
            stats.earnedPoints += childStats.earnedPoints;
        }
    });
    return stats;
}

function calculateNodePercentage(node) {
    if (node.type === 'chapter') {
        let earned = 0;
        if (node.completed) earned += 1;
        if (node.revisionTicks) earned += node.revisionTicks.filter(t => t).length;
        if (node.pyqTicks) earned += node.pyqTicks.filter(t => t).length;
        return Math.round((earned / 7) * 100);
    }
    
    if (!node.children || node.children.length === 0) return 0;
    
    const stats = calculateProgress([node]);
    if (stats.totalPoints === 0) return 0;
    
    return Math.round((stats.earnedPoints / stats.totalPoints) * 100);
}

// ==========================================
// CHARTS (Chart.js)
// ==========================================
function renderPieChart(earnedPoints, remainingPoints, stats) {
    const ctx = document.getElementById('overallProgressChart').getContext('2d');
    
    // Destroy previous instance to avoid overload
    if (progressChartInstance) {
        progressChartInstance.destroy();
    }
    
    // We get exams directly from current user
    const dataEmpty = currentUser.exams.length === 0 || stats.totalPoints === 0;

    // By default, show subject weights
    const labels = [];
    const dataSeries = [];
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    
    if(!dataEmpty) {
        currentUser.exams.forEach((ex, idx) => {
            labels.push(ex.name);
            dataSeries.push(ex.children ? ex.children.length : 0);
        });
    }

    progressChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dataEmpty ? ['No Data'] : labels,
            datasets: [{
                data: dataEmpty ? [1] : dataSeries,
                backgroundColor: dataEmpty ? ['#e2e8f0'] : colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: !dataEmpty },
                title: { display: !dataEmpty, text: 'Exam Weightage (By Chapters)' }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            },
            onClick: (event, elements) => {
                if(elements.length > 0 && !dataEmpty) {
                    const idx = elements[0].index;
                    const exam = currentUser.exams[idx];
                    handleExamPieClick(exam);
                }
            }
        }
    });
}

let pieClickTimer = null;
function handleExamPieClick(exam) {
    if (pieClickTimer == null) {
        pieClickTimer = setTimeout(() => {
            pieClickTimer = null;
            openExamDashboard(exam); // Single/Center Click -> Open Dashboard
        }, 250);
    } else {
        clearTimeout(pieClickTimer);
        pieClickTimer = null;
        renderSubjectPieChart(exam); // Double Click -> Subject drill-down
    }
}

function openExamDashboard(exam) {
    document.getElementById('exam-dashboard-title').innerText = `${exam.name} Overview`;
    
    const stats = calculateProgress([exam]);
    const examStatsContainer = document.getElementById('exam-dashboard-stats');
    
    // Exam specific isolated stats
    examStatsContainer.innerHTML = `
        <div class="stat-card pending-revisions" style="border-left-color: var(--primary);">
            <i class="fa-solid fa-graduation-cap" style="color: var(--primary);"></i>
            <div class="stat-info">
                <h3>Chapters Built</h3>
                <span class="stat-value">${stats.totalChapters}</span>
            </div>
        </div>
        <div class="stat-card pending-revisions" style="border-left-color: var(--secondary);">
            <i class="fa-solid fa-check-double" style="color: var(--secondary);"></i>
            <div class="stat-info">
                <h3>Chapters Completed</h3>
                <span class="stat-value">${stats.totalCompleted}</span>
            </div>
        </div>
        <div class="stat-card pending-revisions" style="border-left-color: var(--warning);">
            <i class="fa-solid fa-spinner" style="color: var(--warning);"></i>
            <div class="stat-info">
                <h3>Total Points Earned</h3>
                <span class="stat-value" style="font-size: 18px;">${stats.earnedPoints} / ${stats.totalPoints}</span>
            </div>
        </div>
    `;

    // Flow exclusively for this exam
    renderProgressFlow([exam], 'exam-progress-flow-container');
    
    switchView('exam-dashboard');
}

function showExamBreakdown(exam) {
    const container = document.getElementById('subjectBreakdownContainer');
    if (!container) return;
    
    let html = `<h4 style="margin-bottom:10px;">${exam.name} - Subjects</h4><ul style="padding-left: 20px; font-size: 0.9rem; margin-bottom: 10px;">`;
    if(exam.children && exam.children.length > 0) {
        exam.children.forEach(sub => {
            const perc = calculateNodePercentage(sub);
            html += `<li style="margin-bottom: 5px;"><strong>${sub.name}</strong> <span style="color:var(--text-muted);">(${perc}% completed)</span></li>`;
        });
    } else {
        html += `<p class="text-muted">No subjects added.</p>`;
    }
    html += `</ul>`;
    container.innerHTML = html;
}

let subjectChartInstance = null;
function renderSubjectPieChart(exam) {
    const ctx = document.getElementById('subjectPieChart');
    if(!ctx) return;
    
    document.getElementById('subjectChartPlaceholder').style.display = 'none';
    ctx.style.display = 'block';
    
    if(subjectChartInstance) subjectChartInstance.destroy();
    
    const subjectNames = [];
    const pointsData = [];
    const colors = ['#f59e0b', '#10b981', '#4f46e5', '#ec4899', '#06b6d4'];
    
    if(exam.children) {
        exam.children.forEach(sub => {
            subjectNames.push(sub.name);
            const stats = calculateProgress([sub]);
            pointsData.push(stats.earnedPoints);
        });
    }
    
    subjectChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: subjectNames.length ? subjectNames : ['No Subjects'],
            datasets: [{
                data: subjectNames.length ? pointsData : [1],
                backgroundColor: subjectNames.length ? colors.slice(0, subjectNames.length) : ['#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `${exam.name} - Subject Progress (Points)` }
            }
        }
    });
}

function renderProgressFlow(nodes, targetContainerId = 'progress-flow-container') {
    const container = document.getElementById(targetContainerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (nodes.length === 0) {
        container.innerHTML = '<p class="text-muted text-center mt-4">No data to display.</p>';
        return;
    }

    nodes.forEach(exam => {
        const percent = calculateNodePercentage(exam);
        let eClass = getProgressAnimationClass(percent);
        
        const div = document.createElement('div');
        div.className = 'flow-item';
        div.innerHTML = `
            <div class="flow-header">
                <span>${exam.name}</span>
                <span>${percent}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill ${eClass}" style="width: ${percent}%;"></div>
            </div>
        `;
        progressFlowContainer.appendChild(div);
        
        // Render Subject level if exam has children
        if (exam.children && exam.children.length > 0) {
            exam.children.forEach(sub => {
                const subPercent = calculateNodePercentage(sub);
                let sClass = getProgressAnimationClass(subPercent);
                
                const subDiv = document.createElement('div');
                subDiv.className = 'flow-item';
                subDiv.style.marginLeft = '20px';
                subDiv.style.borderLeftColor = 'var(--secondary)';
                subDiv.innerHTML = `
                    <div class="flow-header">
                        <span style="font-size: 13px;">↳ ${sub.name}</span>
                        <span style="font-size: 13px;">${subPercent}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${sClass}" style="width: ${subPercent}%;"></div>
                    </div>
                `;
                container.appendChild(subDiv);
            });
        }
    });
}

function getProgressAnimationClass(percent) {
    if (percent === 100) return 'progress-fire';
    if (percent > 60) return 'progress-lava';
    if (percent > 30) return 'progress-rage';
    return 'progress-normal';
}

// ==========================================
// CALENDAR & CUSTOM TASKS LOGIC
// ==========================================
let pendingCustomTargets = []; // Stores `{id, name, pathString}` of selected chips

function initCustomTasksUI() {
    const input = document.getElementById('customTaskSearchInput');
    const dropdown = document.getElementById('customTaskDropdown');
    const chipContainer = document.getElementById('selectedChaptersContainer');
    const dateInput = document.getElementById('customTaskDate');
    const btnRev = document.getElementById('btnAddCustomRevision');
    const btnTest = document.getElementById('btnAddCustomTest');
    
    if(!input) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        const hits = searchSyllabus(query);
        if (hits.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size:13px;">No results found.</div>';
        } else {
            dropdown.innerHTML = hits.map(hit => {
                if(!hit.isCompleted) {
                    return `<div class="search-result-item disabled" style="padding: 10px; cursor: not-allowed; border-bottom: 1px solid var(--border-light); font-size:13px; opacity: 0.5;" title="Complete to unlock">
                                <strong><i class="fa-solid fa-lock"></i> ${hit.name}</strong> <span style="font-size:11px; color: var(--text-muted);">(${hit.pathString})</span>
                            </div>`;
                }
                return `<div class="search-result-item" data-id="${hit.id}" data-name="${hit.name}" data-path="${hit.pathString}"
                             style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-light); font-size:13px;">
                            <strong>${hit.name}</strong> <span style="font-size:11px; color: var(--text-muted);">(${hit.pathString})</span>
                        </div>`;
            }).join('');
            
            dropdown.querySelectorAll('.search-result-item:not(.disabled)').forEach(item => {
                item.addEventListener('click', () => {
                    addPendingTarget(item.dataset.id, item.dataset.name, item.dataset.path);
                    input.value = '';
                    dropdown.style.display = 'none';
                });
            });
        }
        dropdown.style.display = 'block';
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    btnRev.addEventListener('click', () => saveCustomTask('revision', dateInput.value, pendingCustomTargets, 'selectedChaptersContainer', 'customTaskDate'));
}

let pendingCustomTestTargets = [];
function initCustomTestsUI() {
    const input = document.getElementById('customTestSearchInput');
    const dropdown = document.getElementById('customTestDropdown');
    const dateInput = document.getElementById('customTestDate');
    const btnTest = document.getElementById('btnAddCustomTestOnly');
    
    if(!input) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        const hits = searchSyllabus(query);
        if (hits.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size:13px;">No results found.</div>';
        } else {
            dropdown.innerHTML = hits.map(hit => {
                if(!hit.isCompleted) {
                    return `<div class="search-result-item disabled" style="padding: 10px; cursor: not-allowed; border-bottom: 1px solid var(--border-light); font-size:13px; opacity: 0.5;" title="Complete to unlock">
                                <strong><i class="fa-solid fa-lock"></i> ${hit.name}</strong> <span style="font-size:11px; color: var(--text-muted);">(${hit.type}) - ${hit.pathString}</span>
                            </div>`;
                }
                return `<div class="search-result-item" data-id="${hit.id}" data-name="${hit.name}" data-path="${hit.pathString}" data-type="${hit.type}"
                             style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-light); font-size:13px;">
                            <strong>${hit.name}</strong> <span style="font-size:11px; color: var(--text-muted);">(${hit.type}) - ${hit.pathString}</span>
                        </div>`;
            }).join('');
            
            dropdown.querySelectorAll('.search-result-item:not(.disabled)').forEach(item => {
                item.addEventListener('click', () => {
                    addTestTarget(item.dataset.id, item.dataset.name, item.dataset.path, item.dataset.type);
                    input.value = '';
                    dropdown.style.display = 'none';
                });
            });
        }
        dropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    btnTest.addEventListener('click', () => saveCustomTask('test', dateInput.value, pendingCustomTestTargets, 'selectedTestChaptersContainer', 'customTestDate'));
}

function searchSyllabus(query) {
    const results = [];
    const keywords = query.split('').join('.*'); // basic fuzzy like 't.*h.*e.*r.*m'
    const regex = new RegExp(keywords, 'i');

    function checkCompletion(node) {
        if (node.type === 'chapter') return !!node.completed;
        if (!node.children || node.children.length === 0) return false;
        // For subjects, consider them completed if ALL their chapters are completed
        let allCompleted = true;
        function traverseSub(n) {
            if(n.type === 'chapter' && !n.completed) allCompleted = false;
            if(n.children) n.children.forEach(traverseSub);
        }
        traverseSub(node);
        return allCompleted;
    }

    function traverse(node, pathNames) {
        if ((node.type === 'chapter' || node.type === 'subject') && regex.test(node.name)) {
            results.push({
                id: node.id,
                name: node.name,
                type: node.type,
                pathString: pathNames.join(' > '),
                isCompleted: checkCompletion(node)
            });
        }
        if (node.children) {
            node.children.forEach(child => traverse(child, [...pathNames, node.name]));
        }
    }
    currentUser.exams.forEach(ex => traverse(ex, []));
    return results;
}

function extractChaptersFromNode(nodeId) {
    let chapters = [];
    function findAndExtract(nodes) {
        for(let n of nodes) {
            if (n.id === nodeId) {
                if (n.type === 'chapter') chapters.push({id: n.id, name: n.name});
                else if (n.children) fetchAllChildren(n.children);
                return true; // found
            }
            if (n.children) {
                if(findAndExtract(n.children)) return true;
            }
        }
        return false;
    }
    function fetchAllChildren(nodes) {
        nodes.forEach(c => {
            if (c.type === 'chapter') chapters.push({id: c.id, name: c.name});
            else if (c.children) fetchAllChildren(c.children);
        });
    }
    findAndExtract(currentUser.exams);
    return chapters;
}

function addTestTarget(id, name, pathString, type) {
    if(pendingCustomTestTargets.find(t => t.id === id)) return;
    
    // If subject is clicked, we might extract chapters, but let's just add the subject visually
    // For simplicity, we add the target directly
    pendingCustomTestTargets.push({id, name, pathString, type});
    renderChips(pendingCustomTestTargets, 'selectedTestChaptersContainer', true);
}

function addPendingTarget(id, name, pathString, type='chapter') {
    if(pendingCustomTargets.find(t => t.id === id)) return;
    pendingCustomTargets.push({id, name, pathString, type});
    renderChips(pendingCustomTargets, 'selectedChaptersContainer', false);
}

function removePendingTarget(id, isTest) {
    if (isTest) {
        pendingCustomTestTargets = pendingCustomTestTargets.filter(t => t.id !== id);
        renderChips(pendingCustomTestTargets, 'selectedTestChaptersContainer', true);
    } else {
        pendingCustomTargets = pendingCustomTargets.filter(t => t.id !== id);
        renderChips(pendingCustomTargets, 'selectedChaptersContainer', false);
    }
}

function renderChips(array, targetContainerId, isTest) {
    const container = document.getElementById(targetContainerId);
    if(!container) return;
    container.innerHTML = array.map(t => `
        <div style="display:inline-flex; align-items:center; gap:5px; padding: 4px 8px; background:var(--bg-main); border:1px solid var(--border-light); border-radius:12px; font-size:12px;">
            <span>${t.name}</span>
            <i class="fa-solid fa-xmark" style="cursor:pointer; color:var(--danger);" onclick="removePendingTarget('${t.id}', ${isTest})"></i>
        </div>
    `).join('');
}

function saveCustomTask(type, dateStr, arrayRef, containerId, dateInputId) {
    if(arrayRef.length === 0) { alert("Please select at least one item."); return; }
    if(!dateStr) { alert("Please select a valid date."); return; }

    const task = {
        id: 'ct_' + Date.now(),
        type: type, // 'revision' or 'test'
        dateStr: dateStr,
        targets: [...arrayRef],
        completed: false
    };

    currentUser.customTasks.push(task);
    saveData();
    
    // Clear Form
    arrayRef.length = 0; // empties the actual array
    renderChips(arrayRef, containerId, type === 'test');
    document.getElementById(dateInputId).value = '';
}

// Modify the old getDueRevisionsList to return all unified calendar events
function getUnifiedCalendarList() {
    let events = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Gather Automatic Revisions
    function traverse(node, pathNames) {
        const currentPath = [...pathNames, node.name];
        if (node.type === 'chapter' && node.completed && node.revisions) {
            node.revisions.forEach((revDateStr, index) => {
               if(index >= (node.revisionsDone || 0) ) {
                   events.push({
                       eventId: node.id + '_' + index,
                       nodeId: node.id,
                       title: node.name,
                       subtitle: pathNames.join(' > '),
                       dateStr: revDateStr,
                       tagText: index === 0 ? 'Day 3 Auto Rev' : (index === 1 ? 'Day 5 Auto Rev' : 'Day 10 Auto Rev'),
                       tagClass: 'auto-rev',
                       type: 'auto_revision',
                       revIndex: index,
                       isDue: revDateStr <= today
                   });
               }
            });
        }
        if (node.children) node.children.forEach(c => traverse(c, currentPath));
    }
    currentUser.exams.forEach(ex => traverse(ex, []));
    
    // 2. Gather Custom Tasks
    currentUser.customTasks.forEach(ct => {
        if(!ct.completed) {
            events.push({
                eventId: ct.id,
                title: ct.targets.length > 1 ? `Custom ${ct.type === 'test' ? 'Test' : 'Revision'} (${ct.targets.length} Topics)` : ct.targets[0].name,
                subtitle: ct.targets.map(t => t.name).join(', '),
                dateStr: ct.dateStr,
                tagText: ct.type === 'test' ? 'Custom Test' : 'Custom Rev',
                tagClass: ct.type === 'test' ? 'test-tag' : 'custom-rev-tag',
                type: 'custom_task',
                taskRef: ct,
                isDue: ct.dateStr <= today
            });
        }
    });

    // Sort heavily by date
    events.sort((a,b) => new Date(a.dateStr) - new Date(b.dateStr));
    
    return events;
}

// ==========================================
// NOTIFICATIONS & CALENDAR UI
// ==========================================
function initNotificationUI() {
    if(notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.style.display = notificationDropdown.style.display === 'none' ? 'block' : 'none';
        });
    }
    if(closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', () => {
             notificationDropdown.style.display = 'none';
        });
    }
    document.addEventListener('click', (e) => {
        if (notificationDropdown && !notificationDropdown.contains(e.target) && e.target !== notificationBtn && !notificationBtn.contains(e.target)){
            notificationDropdown.style.display = 'none';
        }
    });
}

function updateNotifications() {
    const allEvents = getUnifiedCalendarList();
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find all uncompleted items that are due TODAY or OVERDUE
    const pendingEvents = allEvents.filter(ev => ev.isDue && !ev.isCompleted);
    
    if(notificationBadge) {
        if(pendingEvents.length > 0) {
            notificationBadge.style.display = 'flex';
            notificationBadge.innerText = pendingEvents.length > 9 ? '9+' : pendingEvents.length;
        } else {
            notificationBadge.style.display = 'none';
        }
    }

    if(notificationList) {
        if(pendingEvents.length === 0) {
            notificationList.innerHTML = '<div class="text-muted text-center" style="font-size: 13px; padding: 10px;">All caught up for today!</div>';
        } else {
            notificationList.innerHTML = pendingEvents.map(ev => {
                let iconClass = ev.type === 'auto_revision' ? 'notif-rev' : (ev.taskRef && ev.taskRef.type === 'test' ? 'notif-test' : 'notif-custom');
                let iconHTML = ev.type === 'auto_revision' ? '<i class="fa-solid fa-clock-rotate-left"></i>' : (ev.taskRef && ev.taskRef.type === 'test' ? '<i class="fa-solid fa-file-signature"></i>' : '<i class="fa-solid fa-bookmark"></i>');
                
                return `
                <div class="notification-item">
                    <div style="display:flex; align-items:center;">
                        <div class="notif-icon ${iconClass}">
                            ${iconHTML}
                        </div>
                        <div>
                            <div style="font-weight: 500; font-size: 13px; color: var(--text-main); margin-bottom: 2px;">${ev.title}</div>
                            <div style="color: var(--text-muted); font-size: 11px;">${ev.subtitle}</div>
                        </div>
                    </div>
                </div>
            `}).join('');
        }
    }
}

function checkAndFireNotifications() {
    if (!("Notification" in window)) return;
    
    const allEvents = getUnifiedCalendarList();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = allEvents.filter(ev => ev.isDue && !ev.isCompleted);
    
    if(todayEvents.length === 0) return;

    const lastNotif = localStorage.getItem(`last_notif_${currentUser.profile.name}`);
    if(lastNotif === todayStr) return;

    function sendNotification() {
        const text = `You have ${todayEvents.length} action item(s) pending for today! Let's get to work!`;
        const notification = new Notification("Revision Tracker Reminder", {
            body: text,
            icon: "https://cdn-icons-png.flaticon.com/512/3233/3233483.png"
        });
        localStorage.setItem(`last_notif_${currentUser.profile.name}`, todayStr);
    }

    if (Notification.permission === "granted") {
        sendNotification();
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") sendNotification();
        });
    }
}

function renderRevisionsList() {
    const list = getUnifiedCalendarList().filter(item => item.type === 'auto_revision' || (item.type === 'custom_task' && item.taskRef.type === 'revision'));
    renderFeedList(list, 'calendar-feed-container', 'Your schedule is empty! Complete chapters or create custom revisions.');
}

function renderTestsList() {
    const list = getUnifiedCalendarList().filter(item => item.type === 'custom_task' && item.taskRef.type === 'test');
    renderFeedList(list, 'tests-feed-container', 'No upcoming tests! Create custom tests to evaluate your preparation.');
}

function renderFeedList(list, containerId, emptyMsg) {
    const container = document.getElementById(containerId);
    if(!container) return;

    const pendingList = list.filter(item => !item.isCompleted);

    if (pendingList.length === 0) {
        container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
        return;
    }

    const grouped = {};
    pendingList.forEach(item => {
        if(!grouped[item.dateStr]) grouped[item.dateStr] = [];
        grouped[item.dateStr].push(item);
    });

    let html = '';
    const today = new Date().toISOString().split('T')[0];

    Object.keys(grouped).sort().forEach(dateStr => {
        const events = grouped[dateStr];
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(y, m-1, d);
        let dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        
        if (dateStr === today) dateLabel = `Today (${dateLabel})`;
        else if (dateStr < today) dateLabel = `Overdue (${dateLabel})`;
        
        const isPast = dateStr < today;
        const headerColor = isPast ? 'var(--danger)' : (dateStr === today ? 'var(--primary)' : 'var(--text-main)');

        html += `
            <div style="margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid var(--border-light); padding-bottom: 5px;">
                <h4 style="color: ${headerColor}; margin: 0; font-size: 15px;">${dateLabel}</h4>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
        `;

        events.forEach(item => {
            const cardClass = item.isDue ? 'revision-card' : 'revision-card future';
            
            let actionsHtml = '';
            if(item.type === 'auto_revision') {
                actionsHtml = `<button class="primary-btn" style="padding: 6px 12px; font-size:12px;" onclick="markRevisionDone('${item.nodeId}', ${item.revIndex})">Mark Done</button>`;
            } else {
                actionsHtml = `
                    <div style="display:flex; gap: 5px;">
                        <button class="primary-btn" style="padding: 6px 12px; font-size:12px;" onclick="markCustomTaskDone('${item.eventId}')" title="Complete task"><i class="fa-solid fa-check"></i></button>
                        <button class="secondary-btn" style="padding: 6px; font-size:12px; color:var(--danger); border-color:var(--danger);" onclick="deleteCustomTask('${item.eventId}')" title="Delete Task"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }

            html += `
                <div class="${cardClass}">
                    <div class="revision-info" style="flex:1;">
                        <div style="display:flex; align-items:center; gap: 8px; margin-bottom:5px;">
                            <span class="${item.tagClass} revision-tag">${item.tagText}</span>
                            <h4 style="margin:0;">${item.title}</h4>
                        </div>
                        <p style="margin:0;">${item.subtitle}</p>
                    </div>
                    <div style="margin-left: 15px; align-self: center;">
                        ${actionsHtml}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });

    container.innerHTML = html;
}

// ==========================================
// HISTORY FEEDS LOGIC
// ==========================================
function initHistoryUI() {
    const btnRevHistory = document.getElementById('toggle-rev-history');
    const containerRevHistory = document.getElementById('revisions-history-container');
    
    const btnTestHistory = document.getElementById('toggle-test-history');
    const containerTestHistory = document.getElementById('tests-history-container');

    if(btnRevHistory) {
        btnRevHistory.addEventListener('click', () => {
            if (containerRevHistory.style.display === 'none') {
                containerRevHistory.style.display = 'block';
                btnRevHistory.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide History';
                renderHistoryList('revisions', 'rev-history-list');
            } else {
                containerRevHistory.style.display = 'none';
                btnRevHistory.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> View History';
            }
        });
    }

    if(btnTestHistory) {
        btnTestHistory.addEventListener('click', () => {
            if (containerTestHistory.style.display === 'none') {
                containerTestHistory.style.display = 'block';
                btnTestHistory.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide History';
                renderHistoryList('tests', 'test-history-list');
            } else {
                containerTestHistory.style.display = 'none';
                btnTestHistory.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> View History';
            }
        });
    }
}

function renderHistoryList(type, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;

    let historyEvents = [];
    const allEvents = getUnifiedCalendarList();
    
    if (type === 'revisions') {
        historyEvents = allEvents.filter(item => item.isCompleted && (item.type === 'auto_revision' || (item.type === 'custom_task' && item.taskRef.type === 'revision')));
    } else if (type === 'tests') {
        historyEvents = allEvents.filter(item => item.isCompleted && (item.type === 'custom_task' && item.taskRef.type === 'test'));
    }

    if (historyEvents.length === 0) {
        container.innerHTML = `<div class="text-muted" style="font-size: 13px;">No completed history available yet.</div>`;
        return;
    }

    // Newest first
    historyEvents.sort((a,b) => new Date(b.dateStr) - new Date(a.dateStr));

    let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    historyEvents.forEach(item => {
        let iconClass = item.type === 'auto_revision' ? 'notif-rev' : (item.taskRef && item.taskRef.type === 'test' ? 'notif-test' : 'notif-custom');
        let iconHTML = item.type === 'auto_revision' ? '<i class="fa-solid fa-clock-rotate-left"></i>' : (item.taskRef && item.taskRef.type === 'test' ? '<i class="fa-solid fa-file-signature"></i>' : '<i class="fa-solid fa-bookmark"></i>');
        
        let dateObj = new Date(item.dateStr);
        let dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        html += `
            <div class="notification-item" style="border: 1px solid var(--border-light); border-radius: var(--radius);">
                <div style="display:flex; align-items:center;">
                    <div class="notif-icon ${iconClass}">
                        ${iconHTML}
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
                            <span style="font-weight: 500; font-size: 13px; color: var(--text-main);">${item.title}</span>
                            <span style="font-size: 11px; padding: 2px 6px; background: rgba(16, 185, 129, 0.1); color: var(--secondary); border-radius: 4px;">✔ Done</i></span>
                        </div>
                        <div style="color: var(--text-muted); font-size: 11px;">${item.subtitle} &nbsp;•&nbsp; Date: ${dateLabel}</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

window.markRevisionDone = function(nodeId, revIndex) {
    let target = null;
    function findNode(nodes) {
        for (let n of nodes) {
            if (n.id === nodeId) { target = n; return; }
            if (n.children) findNode(n.children);
        }
    }
    findNode(currentUser.exams);
    
    if (target && typeof target.revisionsDone !== 'undefined') {
        target.revisionsDone = revIndex + 1;
        saveData();
        updateNotifications();
    }
}

window.markCustomTaskDone = function(taskId) {
    const target = currentUser.customTasks.find(t => t.id === taskId);
    if(target) {
        target.completed = true;
        
        // If it's a test, auto-increment the test counters for all involved chapters
        if (target.type === 'test') {
            target.targets.forEach(tNode => {
                const chaptersInfo = extractChaptersFromNode(tNode.id);
                chaptersInfo.forEach(chInfo => {
                    incrementTestCountForId(chInfo.id);
                });
            });
            
            // Re-render syllabus if it happens to be open
            const syllabusView = document.getElementById('view-syllabus');
            if (syllabusView && syllabusView.classList.contains('active')) {
                if (typeof renderHierarchy === 'function') {
                    renderHierarchy();
                }
            }
        }

        saveData();
        updateNotifications();
        
        // Re-render lists to show updated state
        renderRevisionsList();
        renderTestsList();
        renderDashboardCalendar();
    }
}

function incrementTestCountForId(chapterId) {
    function traverse(nodes) {
        for(let n of nodes) {
            if (n.id === chapterId) {
                if(typeof n.testCount === 'undefined') n.testCount = 0;
                n.testCount += 1;
                return true;
            }
            if (n.children) {
                if (traverse(n.children)) return true;
            }
        }
        return false;
    }
    traverse(currentUser.exams);
}

window.deleteCustomTask = function(taskId) {
    if(confirm("Delete this custom task? This cannot be undone.")) {
        currentUser.customTasks = currentUser.customTasks.filter(t => t.id !== taskId);
        saveData();
        updateNotifications();
    }
}

// ==========================================
// DASHBOARD CALENDAR TRACKER
// ==========================================
function initCalendarUI() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    const calCloseBtn = document.getElementById('cal-close-details');

    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderDashboardCalendar();
        });
    }
    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderDashboardCalendar();
        });
    }
    if(calCloseBtn) {
        calCloseBtn.addEventListener('click', () => {
            document.getElementById('cal-day-details').style.display = 'none';
            document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
        });
    }
}

function renderDashboardCalendar() {
    const monthYearEl = document.getElementById('cal-month-year');
    const daysContainer = document.getElementById('calendar-days');
    if(!monthYearEl || !daysContainer) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Set Header
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    monthYearEl.innerText = `${monthNames[month]} ${year}`;

    // Get calendar constraints
    const firstDay = new Date(year, month, 1).getDay(); // 0(Sun) to 6(Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get all events
    const allEvents = getUnifiedCalendarList();
    const completionDates = []; // Track completed chapters dates

    function gatherCompletedDates(nodes) {
        nodes.forEach(n => {
            if(n.type === 'chapter' && n.completed && n.completedDate) {
                completionDates.push({ dateStr: n.completedDate.split('T')[0], name: n.name });
            }
            if(n.children) gatherCompletedDates(n.children);
        });
    }
    gatherCompletedDates(currentUser.exams);

    let html = '';
    const todayStr = new Date().toISOString().split('T')[0];

    // Padding empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    // Days forming the month
    for (let i = 1; i <= daysInMonth; i++) {
        const paddedMonth = String(month + 1).padStart(2, '0');
        const paddedDay = String(i).padStart(2, '0');
        const dStr = `${year}-${paddedMonth}-${paddedDay}`;
        
        const isToday = dStr === todayStr;
        
        // Find events on this date
        const eventsToday = allEvents.filter(ev => ev.dateStr === dStr);
        const completesToday = completionDates.filter(c => c.dateStr === dStr);
        
        let hasPending = false;
        let hasDone = false;
        let hasTest = false;

        eventsToday.forEach(ev => {
            if(ev.isCompleted) hasDone = true;
            else hasPending = true;
            if(ev.type === 'custom_task' && ev.taskRef && ev.taskRef.type === 'test') hasTest = true;
        });
        if(completesToday.length > 0) hasDone = true;

        let indicatorsHTML = `<div class="cal-indicators">`;
        if(hasDone) indicatorsHTML += `<span class="cal-dot dot-done" title="Work Completed"></span>`;
        if(hasTest) indicatorsHTML += `<span class="cal-dot dot-test" title="Test Date"></span>`;
        if(hasPending) indicatorsHTML += `<span class="cal-dot dot-pending" title="Pending Tasks"></span>`;
        indicatorsHTML += `</div>`;

        html += `
            <div class="cal-day ${isToday ? 'today' : ''}" data-date="${dStr}" onclick="showCalendarDayDetails('${dStr}')">
                <span class="cal-date-num">${i}</span>
                ${indicatorsHTML}
            </div>
        `;
    }

    daysContainer.innerHTML = html;
}

window.showCalendarDayDetails = function(dateStr) {
    // Remove selected state logic
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    const clickedEl = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
    if(clickedEl) clickedEl.classList.add('selected');

    const detailsContainer = document.getElementById('cal-day-details');
    const titleEl = document.getElementById('cal-detail-date');
    const contentEl = document.getElementById('cal-detail-content');

    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m-1, d);
    titleEl.innerText = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const allEvents = getUnifiedCalendarList().filter(ev => ev.dateStr === dateStr);
    
    // Find chapter completions
    const completionDates = [];
    function gatherCompletedDates(nodes) {
        nodes.forEach(n => {
            if(n.type === 'chapter' && n.completed && n.completedDate && n.completedDate.split('T')[0] === dateStr) {
                completionDates.push(n.name);
            }
            if(n.children) gatherCompletedDates(n.children);
        });
    }
    gatherCompletedDates(currentUser.exams);

    let contentHtml = '';

    if(completionDates.length > 0) {
        contentHtml += `<div style="margin-bottom: 8px; font-weight: 500; color: var(--secondary);"><i class="fa-solid fa-graduation-cap"></i> Chapters Completed:</div>`;
        completionDates.forEach(name => {
            contentHtml += `<div class="cal-detail-item"><i class="fa-solid fa-check" style="color:var(--secondary)"></i> <span>${name}</span></div>`;
        });
    }

    const pending = allEvents.filter(ev => !ev.isCompleted);
    const completed = allEvents.filter(ev => ev.isCompleted);

    if (completed.length > 0) {
        contentHtml += `<div style="margin-bottom: 8px; margin-top: 10px; font-weight: 500; color: var(--secondary);"><i class="fa-solid fa-check-double"></i> Tasks Finished:</div>`;
        completed.forEach(ev => {
            contentHtml += `<div class="cal-detail-item"><i class="fa-solid fa-check" style="color:var(--secondary)"></i> <span>${ev.title} - ${ev.subtitle}</span></div>`;
        });
    }

    if (pending.length > 0) {
        contentHtml += `<div style="margin-bottom: 8px; margin-top: 10px; font-weight: 500; color: var(--warning);"><i class="fa-solid fa-clock"></i> Pending Tasks:</div>`;
        pending.forEach(ev => {
            contentHtml += `<div class="cal-detail-item"><i class="fa-solid fa-spinner" style="color:var(--warning)"></i> <span style="color:var(--text-muted)">${ev.title} - ${ev.subtitle}</span></div>`;
        });
    }

    if(contentHtml === '') {
        contentHtml = '<div class="text-muted text-center" style="padding: 10px;">No activity on this date.</div>';
    }

    contentEl.innerHTML = contentHtml;
    detailsContainer.style.display = 'block';
}

// Ensure History UI is initialized
document.addEventListener('DOMContentLoaded', () => {
    initHistoryUI();
});
