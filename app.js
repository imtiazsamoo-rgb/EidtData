// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqzlbHxHIF5HzvN_6kyOVA_aCds_3wtHNNLNpK1tQl47wwJ8CBIPsDWA2U3qkVpDXJ/exec';
const PORTAL_STORAGE_KEY = 'ibfs_portal_user';

let currentUser = null;
let portalAdminData = { users: [], apps: [], permissions: [] };

// --- Toast & UI Utilities ---
function showToast(msg, type = 'error') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    
    msgEl.innerText = msg;
    toast.className = "fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl z-[100] transition-all duration-300 flex items-center gap-3 text-white";
    
    if (type === 'error') {
        toast.classList.add('bg-red-600');
        iconEl.className = 'fas fa-exclamation-triangle text-xl';
    } else if (type === 'success') {
        toast.classList.add('bg-brand-600');
        iconEl.className = 'fas fa-check-circle text-xl';
    } else {
        toast.classList.add('bg-slate-800');
        iconEl.className = 'fas fa-info-circle text-xl';
    }
    
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -10px)';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 4000);
}

function showLoader(show) {
    const loader = document.getElementById('global-loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function switchScreen(screenId) {
    document.getElementById('login-screen').classList.add('hidden-screen');
    document.getElementById('dashboard-screen').classList.add('hidden-screen');
    document.getElementById('iframe-screen').classList.add('hidden-screen');
    
    document.getElementById(screenId).classList.remove('hidden-screen');
}

// --- Initialization ---
window.onload = function() {
    // FORCE LOGOUT TO CLEAR OLD SESSIONS
    const forceLogoutDone = localStorage.getItem('ibfs_force_logout_v1');
    if (!forceLogoutDone) {
        localStorage.removeItem(PORTAL_STORAGE_KEY);
        localStorage.setItem('ibfs_force_logout_v1', 'true');
        showToast("Session refreshed. Please sign in again.", "info");
        return;
    }

    const savedUser = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (savedUser) {
        try {
            showDashboard(JSON.parse(savedUser));
        } catch (error) {
            localStorage.removeItem(PORTAL_STORAGE_KEY);
            showToast("Saved session expired. Please sign in again.");
        }
    }
};

// --- Auth ---
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnArrow = document.getElementById('btn-arrow');
    
    btnText.innerText = "Authenticating...";
    btnSpinner.classList.remove('hidden');
    btnArrow.classList.add('hidden');
    document.getElementById('login-btn').disabled = true;

    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email: email, password: password })
    })
    .then(response => response.json())
    .then(data => {
        btnText.innerText = "Authenticate securely";
        btnSpinner.classList.add('hidden');
        btnArrow.classList.remove('hidden');
        document.getElementById('login-btn').disabled = false;

        if (data.status === 'success') {
            showToast("Login successful!", 'success');
            const loggedInUser = data.user || {};
            if (data.token && !loggedInUser.token) {
                loggedInUser.token = data.token;
            }
            localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify(loggedInUser));
            showDashboard(loggedInUser);
        } else {
            showToast(data.message || "Invalid Email or Password!");
        }
    })
    .catch(error => {
        btnText.innerText = "Authenticate securely";
        btnSpinner.classList.add('hidden');
        btnArrow.classList.remove('hidden');
        document.getElementById('login-btn').disabled = false;
        showToast("Network error. Please try again.");
    });
}

function logout() {
    localStorage.removeItem(PORTAL_STORAGE_KEY);
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    
    const iframe = document.getElementById('app-iframe');
    iframe.src = "";
    iframe.style.opacity = '0';
    
    switchScreen('login-screen');
}

// --- Dashboard ---
function showDashboard(user) {
    currentUser = user;
    switchScreen('dashboard-screen');
    
    document.getElementById('user-display-name').innerText = user.name || user.email.split('@')[0];
    document.getElementById('user-display-role').innerText = user.role;
    
    const roleName = String(user.role || '').toUpperCase();
    const userName = user.name || user.email.split('@')[0];
    document.getElementById('dashboard-welcome-title').innerHTML = `Welcome back, <span class="text-brand-600">${userName}</span>.`;

    const manageBtn = document.getElementById('manage-users-btn');
    if (manageBtn) {
        manageBtn.classList.toggle('hidden', String(user.role || '').toLowerCase() !== 'admin');
    }
    
    const container = document.getElementById('apps-container');
    container.innerHTML = '';
    
    if (!user.apps || user.apps.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <i class="fas fa-lock text-2xl"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-700">No Systems Available</h3>
                <p class="text-slate-500 mt-2 text-center max-w-md">You do not have access to any modules. Please contact your system administrator to request access.</p>
            </div>`;
        return;
    }
    
    user.apps.forEach((app, index) => {
        const delay = index * 50; // Staggered animation
        container.appendChild(createAppCard(app, user, delay));
    });
}

function createAppCard(app, user, delayMs) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `group bg-white border border-slate-200 rounded-3xl p-6 md:p-8 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-brand-200 relative overflow-hidden`;
    card.style.animation = `slideUp 0.4s ease-out ${delayMs}ms both`;

    // Decoration circle
    const deco = document.createElement('div');
    deco.className = 'absolute -right-8 -top-8 w-32 h-32 bg-brand-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none';
    card.appendChild(deco);

    const content = document.createElement('div');
    content.className = 'relative z-10 flex flex-col items-start';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-brand-500 group-hover:text-white shadow-sm';
    const icon = document.createElement('i');
    icon.className = `${app.icon || 'fas fa-link'} text-2xl`;
    iconWrap.appendChild(icon);

    const title = document.createElement('h3');
    title.className = 'text-xl font-extrabold text-slate-800 mb-2 group-hover:text-brand-700 transition-colors';
    title.innerText = app.name || 'System';

    const linkRow = document.createElement('div');
    linkRow.className = 'flex items-center text-sm font-bold text-brand-600 mt-4 group-hover:text-brand-800';
    linkRow.innerHTML = `Launch System <i class="fas fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>`;

    content.appendChild(iconWrap);
    content.appendChild(title);
    content.appendChild(linkRow);
    card.appendChild(content);

    card.addEventListener('click', () => openAppInIframe(app, user));
    return card;
}

// --- Iframe Viewer ---
function buildAppUrl(app, user) {
    const token = user.token || '';
    const appId = app.id || app.appId || app.name;

    if (!token) throw new Error('No session token found. Please sign in again.');
    if (!app.url) throw new Error('This system does not have a URL configured.');

    const appUrl = new URL(app.url);
    appUrl.searchParams.set('token', token);
    appUrl.searchParams.set('appId', appId);
    appUrl.searchParams.set('portalApiUrl', APPS_SCRIPT_URL);
    return appUrl.toString();
}

function openAppInIframe(app, user) {
    let appUrl;
    try {
        appUrl = buildAppUrl(app, user);
    } catch (error) {
        showToast(error.message);
        return;
    }

    switchScreen('iframe-screen');
    
    document.getElementById('iframe-title').innerText = app.name || 'System';
    const iconEl = document.getElementById('iframe-app-icon');
    iconEl.innerHTML = `<i class="${app.icon || 'fas fa-cube'} text-lg"></i>`;
    
    const iframe = document.getElementById('app-iframe');
    const loader = document.getElementById('iframe-loader');
    
    // Reset loader and iframe state
    loader.style.opacity = '1';
    iframe.style.opacity = '0';
    iframe.src = appUrl;
    
    // Iframe onload handles fading in iframe and fading out loader (in index.html)
}

function closeIframe() {
    const iframe = document.getElementById('app-iframe');
    iframe.src = "";
    iframe.style.opacity = '0';
    document.getElementById('iframe-loader').style.opacity = '1';
    
    switchScreen('dashboard-screen');
}

// --- API & Admin ---
function portalApi(action, payload = {}) {
    return fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
    }).then(response => response.json());
}

function toggleUserManagement() {
    const panel = document.getElementById('user-management');
    const willOpen = panel.classList.contains('hidden-screen');
    if (willOpen) {
        panel.classList.remove('hidden-screen');
        loadUserManagement();
    } else {
        panel.classList.add('hidden-screen');
    }
}

function loadUserManagement() {
    const token = currentUser?.token || '';
    if (!token) return showToast('Please sign in again.');

    showLoader(true);
    portalApi('adminData', { token })
        .then(data => {
            showLoader(false);
            if (data.status !== 'success') return showToast(data.message || 'Unable to load users.');
            
            portalAdminData = data;
            renderUserAccessOptions([]);
            renderUsersTable();
        })
        .catch(error => {
            showLoader(false);
            showToast('Unable to connect to server.');
        });
}

function getUserPermissions(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    return portalAdminData.permissions.filter(p => String(p.email || '').trim().toLowerCase() === cleanEmail);
}

function renderUserAccessOptions(selectedPermissions) {
    const box = document.getElementById('user-app-access');
    const selectedMap = {};
    (selectedPermissions || []).forEach(p => selectedMap[p.appId] = p);

    box.innerHTML = '';

    if (!portalAdminData.apps.length) {
        box.innerHTML = '<div class="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100">No active apps found in database.</div>';
        return;
    }

    portalAdminData.apps.forEach(app => {
        const p = selectedMap[app.id] || null;
        const isChecked = !!p;

        const container = document.createElement('div');
        container.className = 'p-4 border border-slate-200 rounded-2xl bg-white shadow-sm transition-all hover:border-brand-300';

        const header = document.createElement('label');
        header.className = 'flex items-center gap-3 font-bold text-slate-800 cursor-pointer select-none';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = app.id;
        input.checked = isChecked;
        input.className = 'app-access-checkbox w-5 h-5 text-brand-600 rounded focus:ring-brand-500 accent-brand-600';
        
        const text = document.createElement('span');
        text.className = 'flex-1';
        text.innerHTML = `<i class="${app.icon || 'fas fa-cube'} text-brand-500 mr-2 w-5 text-center"></i> ${app.name || app.id}`;

        header.appendChild(input);
        header.appendChild(text);
        container.appendChild(header);

        const subBox = document.createElement('div');
        // Smooth height transition logic (Tailwind makes this slightly tricky without max-h arbitrary values, we'll use conditional display)
        subBox.className = `ml-8 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 ${isChecked ? '' : 'hidden'}`;
        subBox.id = `sub-perms-${app.id}`;

        // App Role Input
        const roleDiv = document.createElement('div');
        roleDiv.innerHTML = `<label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Sub-system Role</label>
            <input type="text" id="appRole-${app.id}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. admin, viewer" value="${(isChecked && p && p.appRole) ? escapeHtml(p.appRole) : ''}">`;
        
        // Scope Input
        const scopeDiv = document.createElement('div');
        scopeDiv.innerHTML = `<label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Data Scope</label>
            <input type="text" id="scope-${app.id}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. school=123, all" value="${(isChecked && p && p.scope) ? escapeHtml(p.scope) : ''}">`;

        subBox.appendChild(roleDiv);
        subBox.appendChild(scopeDiv);

        input.addEventListener('change', function() {
            if (this.checked) subBox.classList.remove('hidden');
            else subBox.classList.add('hidden');
        });

        container.appendChild(subBox);
        box.appendChild(container);
    });
}

function renderUsersTable() {
    const body = document.getElementById('users-table');
    body.innerHTML = '';

    portalAdminData.users.forEach(user => {
        const userPerms = getUserPermissions(user.email);
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 transition-colors';
        
        const statusBadge = user.active 
            ? '<span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-700">Active</span>' 
            : '<span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-700">Inactive</span>';

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHtml(user.name || user.email.split('@')[0])}</div>
                <div class="text-xs text-slate-500">${escapeHtml(user.email)}</div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-600">${escapeHtml(user.role || 'USER')}</span>
            </td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-center">
                <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-bold text-xs">${userPerms.length}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <button class="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" type="button" title="Edit User">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        row.querySelector('button').addEventListener('click', () => editPortalUser(user));
        body.appendChild(row);
    });
}

function editPortalUser(user) {
    document.getElementById('editing-email').value = user.email || '';
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-name').value = user.name || '';
    document.getElementById('user-role').value = user.role || 'user';
    document.getElementById('user-password').value = '';
    document.getElementById('user-active').checked = user.active !== false;
    renderUserAccessOptions(getUserPermissions(user.email));
    
    // Scroll to top of admin section
    document.getElementById('user-management').scrollIntoView({ behavior: 'smooth' });
}

function resetUserForm() {
    document.getElementById('editing-email').value = '';
    document.getElementById('user-form').reset();
    document.getElementById('user-role').value = 'user';
    document.getElementById('user-active').checked = true;
    renderUserAccessOptions([]);
}

function savePortalUser(event) {
    event.preventDefault();
    const token = currentUser?.token || '';
    const password = document.getElementById('user-password').value;
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const editingEmail = document.getElementById('editing-email').value.trim().toLowerCase();
    const role = document.getElementById('user-role').value;

    if (!editingEmail && !password) return showToast('Password is required for new users.');

    const permissions = [];
    document.querySelectorAll('.app-access-checkbox:checked').forEach(appCb => {
        const appId = appCb.value;
        const appRole = document.getElementById(`appRole-${appId}`)?.value.trim() || '';
        const scope = document.getElementById(`scope-${appId}`)?.value.trim() || '';
        permissions.push({ appId, appRole, scope });
    });

    const user = {
        email,
        originalEmail: editingEmail || email,
        name: document.getElementById('user-name').value.trim(),
        role,
        password,
        active: document.getElementById('user-active').checked
    };

    const btn = document.getElementById('save-user-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
    btn.disabled = true;

    portalApi('saveUser', { token, user, permissions })
        .then(data => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            if (data.status !== 'success') return showToast(data.message || 'Unable to save user.');
            
            showToast('User saved successfully.', 'success');
            resetUserForm();
            loadUserManagement(); // reload table
        })
        .catch(error => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            showToast('Network error while saving user.');
        });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}
