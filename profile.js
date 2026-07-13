const urlParams = new URLSearchParams(window.location.search);
const passedPortalUrl = urlParams.get('portalApiUrl');
const grno = urlParams.get('grno');

// Configuration
const API_URL = "https://script.google.com/macros/s/AKfycbzrcDptT72e1HEen7VxJY9xMi7V2PU_ksS9P5-rUZeavFD1tfH7h1gjrneUB7DPhGZg/exec";
const DEFAULT_PORTAL_API_URL = "https://script.google.com/macros/s/AKfycbxxxU35VnYrGP6GLeGczEhim__XQBy-YYhuJqHEcL1YA8q721h0DW2LXEGr0GdLtT1_/exec"; 
const CONFIG = {
  portalApiBaseUrl: passedPortalUrl || DEFAULT_PORTAL_API_URL,
  portalAppId: "enrollment-app" 
};
const STORAGE_KEY = "ibfs_enrollment_user";

let state = { user: null };
const $ = id => document.getElementById(id);

function toDDMMYYYY(dateStr) {
  if (!dateStr) return '-';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
}

function getVal(s, ...keys) {
  for(let k of keys) {
     if(s[k] !== undefined && s[k] !== '') return s[k];
  }
  for(let k of keys) {
    let sk = k.toLowerCase().replace(/[\s\/-]/g, '');
    for(let actualKey in s) {
       if(actualKey.toLowerCase().replace(/[\s\/-]/g, '') === sk && s[actualKey] !== '') return s[actualKey];
    }
  }
  return '-';
}

function getThumb(url) {
  if(!url) return '';
  let id = '';
  if(url.includes('drive.google.com/file/d/')){
    id = url.split('/d/')[1].split('/')[0];
  } else if (url.includes('id=')) {
    id = new URL(url).searchParams.get('id');
  }
  if (id) {
    return 'https://lh3.googleusercontent.com/d/' + id;
  }
  return url;
}

// Init
async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    
    if (token) {
      await loginWithPortalToken(token);
    } else {
      let saved = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch(e) {
        console.warn("localStorage access denied", e);
      }
      
      if (saved) {
        try {
          state.user = JSON.parse(saved);
        } catch(e) {
          state.user = null;
        }
        
        if (state.user && typeof state.user === 'object') {
          renderApp();
          loadStudentProfile();
        } else {
          throw new Error("Invalid user data");
        }
      } else {
        showError("Access denied. Please login via Central Portal.");
      }
    }
  } catch (err) {
    console.error("Init error:", err);
    showError("Initialization failed. Please login again.");
  }
}

async function loginWithPortalToken(token) {
  const appId = urlParams.get("appId") || CONFIG.portalAppId;
  try {
    const res = await fetch(CONFIG.portalApiBaseUrl, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "verifyAccess", token, appId })
    });
    const result = await res.json();
    if (result && result.status === "success" && result.allowed) {
      state.user = result.user || result;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.user));
      renderApp();
      loadStudentProfile();
    } else {
      showError(result.message || "Portal access denied.");
    }
  } catch (err) {
    showError("Portal connection failed.");
  }
}

function renderApp() {
  $('appView').classList.remove('hidden');
  const u = state.user;
  $('sideUserName').innerText = u.name || (u.email ? u.email.split('@')[0] : "User");
  $('sideUserMeta').innerText = u.appRole || u.role || "User";
  const sc = u.schoolCode || (u.scope ? u.scope.replace('school=','') : '');
  $('currentSchool').innerText = sc ? 'Campus: ' + sc : 'Campus: All';
}

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = 'index.html';
});

$('sidebarToggle').addEventListener('click', () => {
  const sb = $('sidebar');
  sb.classList.contains('-translate-x-full') ? sb.classList.remove('-translate-x-full') : sb.classList.add('-translate-x-full');
});

function showError(msg) {
  $('loadingIndicator').classList.add('hidden');
  const errBox = $('errorMsg');
  errBox.innerText = msg;
  errBox.classList.remove('hidden');
}

async function loadStudentProfile() {
  if (!grno) {
    showError("No GR Number provided in the URL.");
    return;
  }
  
  const sc = state.user.schoolCode || (state.user.scope ? state.user.scope.replace('school=','') : '');
  
  try {
    const payload = { action: 'getVerificationList', schoolCode: sc, class: '', status: '', query: grno, user: state.user.email };
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    
    if (result.status === 'success' && result.data && result.data.length > 0) {
      // Find the exact student by GRNo
      const student = result.data.find(s => String(s['GRNo']) === String(grno)) || result.data[0];
      renderStudent(student);
    } else {
      showError("Student not found or access denied.");
    }
  } catch(e) {
    console.error(e);
    showError("Network error while fetching student data.");
  }
}

function renderStudent(s) {
  $('loadingIndicator').classList.add('hidden');
  $('profileContent').classList.remove('hidden');
  
  const sName = s['StudentName'] || '-';
  $('p_name').innerText = sName;
  $('p_father').innerText = "S/O " + (s['FatherGuardianName'] || '-');
  $('p_gr').innerText = s['GRNo'] || '-';
  $('p_class').innerText = s['CurrentClass'] || '-';
  $('p_gender').innerText = s['Gender'] || '-';
  
  const vStatus = s['Verification_Status'] || 'Pending';
  const vBadge = $('p_vstatus');
  vBadge.innerText = vStatus;
  vBadge.className = 'px-4 py-1.5 rounded-full text-sm font-bold shadow-sm inline-block self-center md:self-auto ' + 
                     (vStatus === 'Verified' ? 'bg-green-100 text-green-700' : (vStatus === 'Corrected' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'));
                     
  const photoUrl = s['PhotoURL'] || '';
  if (photoUrl) {
    $('p_photo').src = getThumb(photoUrl);
    $('p_photo').classList.remove('hidden');
    $('p_photo_placeholder').classList.add('hidden');
  }

  $('p_surname').innerText = s['SurnameCast'] || '-';
  $('p_dob').innerText = toDDMMYYYY(s['DOB']);
  $('p_mother').innerText = s['MotherName'] || '-';
  $('p_bform').innerText = getVal(s, 'BFormNo', 'ParentCNIC', 'CNIC');
  
  $('p_contact').innerText = s['ParentContact'] || '-';
  $('p_address').innerText = getVal(s, 'ResidentialAddress', 'VillageCity', 'Village/City', 'Village');
  $('p_uc').innerText = getVal(s, 'UC', 'UnionCouncil');
  $('p_taluka').innerText = getVal(s, 'Taluka', 'Tehsil');
  $('p_district').innerText = getVal(s, 'District');
  
  $('p_section').innerText = s['Section'] || '-';
  $('p_doa').innerText = toDDMMYYYY(s['DateOfAdmission']);
  $('p_status').innerText = s['Status'] || 'Admitted';
  
  const editBtn = $('editProfileBtn');
  editBtn.classList.remove('hidden');
  editBtn.onclick = () => {
     window.location.href = 'edit.html?search=' + (s['GRNo'] || '');
  };
}
