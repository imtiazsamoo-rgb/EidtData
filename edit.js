    // Configuration
    const urlParams = new URLSearchParams(window.location.search);
    const passedPortalUrl = urlParams.get('portalApiUrl');
    
    // This API_URL points to the certificate-app backend where Verification.gs was deployed
    const API_URL = "https://script.google.com/macros/s/AKfycbzrcDptT72e1HEen7VxJY9xMi7V2PU_ksS9P5-rUZeavFD1tfH7h1gjrneUB7DPhGZg/exec";
    
    // The Central Portal API URL for authentication (read from query string or fallback)
    const DEFAULT_PORTAL_API_URL = "https://script.google.com/macros/s/AKfycbwqzlbHxHIF5HzvN_6kyOVA_aCds_3wtHNNLNpK1tQl47wwJ8CBIPsDWA2U3qkVpDXJ/exec"; 
    
    const CONFIG = {
      portalApiBaseUrl: passedPortalUrl || DEFAULT_PORTAL_API_URL,
      portalAppId: "enrollment-app" 
    };
    const STORAGE_KEY = "ibfs_enrollment_user";
    
    let state = { user: null, students: [], currentStudent: null, cropper: null };
    const $ = id => document.getElementById(id);

    // Init
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      
      if (token) {
        await loginWithPortalToken(token);
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          state.user = JSON.parse(saved);
          renderApp();
          loadDashboard();
        } else {
          $('loginMessage').innerText = "Access denied. Please login via Central Portal.";
          $('loginMessage').className = "text-sm font-semibold p-3 rounded-lg bg-red-50 text-red-600 mt-4";
        }
      }
    }

    async function loginWithPortalToken(token) {
      const appId = new URLSearchParams(window.location.search).get("appId") || CONFIG.portalAppId;
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
          loadDashboard();
        } else {
          $('loginMessage').innerText = result.message || "Portal access denied.";
          $('loginMessage').className = "text-sm font-semibold p-3 rounded-lg bg-red-50 text-red-600 mt-4";
        }
      } catch (err) {
        $('loginMessage').innerText = "Portal connection failed.";
      }
    }

    function renderApp() {
      $('loginView').classList.add('hidden');
      $('appView').classList.remove('hidden');
      const u = state.user;
      $('sideUserName').innerText = u.name || (u.email ? u.email.split('@')[0] : "User");
      $('sideUserMeta').innerText = u.appRole || u.role || "User";
      
      const sc = u.schoolCode || (u.scope ? u.scope.replace('school=','') : '');
      $('currentSchool').innerText = sc ? 'Campus: ' + sc : 'Campus: All';
    }

    $('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });

    $('sidebarToggle').addEventListener('click', () => {
      const sb = $('sidebar');
      sb.classList.contains('-translate-x-full') ? sb.classList.remove('-translate-x-full') : sb.classList.add('-translate-x-full');
    });

    // Data Loading
    $('loadBtn').addEventListener('click', loadList);

    function showOverlay(title, msg, type = 'loading') {
      $('statusOverlay').classList.remove('hidden');
      $('statusTitle').innerText = title;
      $('statusMsg').innerText = msg;
      const icon = $('statusIcon');
      const btn = $('statusCloseBtn');
      
      if(type === 'loading') {
        icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        icon.className = 'text-4xl text-brand-600 mb-3';
        btn.classList.add('hidden');
      } else if(type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        icon.className = 'text-4xl text-green-600 mb-3';
        btn.classList.remove('hidden');
      } else {
        icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        icon.className = 'text-4xl text-red-600 mb-3';
        btn.classList.remove('hidden');
      }
    }

    async function loadDashboard() {
       // Auto load list on init
       loadList();
    }

    async function loadList() {
      const btn = $('loadBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Loading...';
      
      const sc = state.user.schoolCode || (state.user.scope ? state.user.scope.replace('school=','') : '');
      const cls = $('filterClass').value;
      const sts = $('filterStatus').value;
      const q = $('searchQuery').value.trim();

      try {
        const payload = { action: 'getVerificationList', schoolCode: sc, class: cls, status: sts, query: q, user: state.user.email };
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
          state.students = result.data;
          $('countTotal').innerText = result.counts.total || 0;
          $('countPending').innerText = result.counts.pending || 0;
          $('countVerified').innerText = result.counts.verified || 0;
          $('countCorrected').innerText = result.counts.corrected || 0;
          renderGrid();
        } else {
          alert('Failed to load data: ' + result.message);
        }
      } catch(e) {
        alert('Network error while loading data.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search mr-1"></i> Search';
      }
    }

    function getThumb(url) {
      if(!url) return '';
      if(url.includes('drive.google.com/file/d/')){
        const id = url.split('/d/')[1].split('/')[0];
        return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w200';
      }
      return url;
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
      return '';
    }
    
    function getRealKey(s, k) {
      let sk = k.toLowerCase().replace(/[\s\/-]/g, '');
      for(let actualKey in s) {
         if(actualKey.toLowerCase().replace(/[\s\/-]/g, '') === sk) return actualKey;
      }
      return k;
    }

    function renderGrid() {
      const grid = $('studentGrid');
      grid.innerHTML = '';
      if(state.students.length === 0) {
        grid.innerHTML = '<div class="text-center text-slate-500 py-10 col-span-full">No students found for current filters.</div>';
        return;
      }

      state.students.forEach((s, idx) => {
        const vStatus = s['Verification_Status'] || 'Pending';
        const vColor = vStatus === 'Verified' ? 'bg-green-100 text-green-700' : (vStatus === 'Corrected' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700');
        
        const photoUrl = s['PhotoURL'] || '';
        const sName = s['StudentName'] || '';
        const fName = s['FatherGuardianName'] || '';
        const gNo = s['GRNo'] || '';
        const cClass = s['CurrentClass'] || '';
        
        const card = document.createElement('div');
        card.className = "glass-panel p-5 rounded-2xl flex gap-4 items-center hover:shadow-lg transition-shadow border border-slate-200 cursor-pointer";
        card.onclick = () => openEditModal(idx);
        card.innerHTML = `
          <div class="w-16 h-20 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
            ${photoUrl ? '<img src="' + getThumb(photoUrl) + '" class="w-full h-full object-cover">' : '<div class="w-full h-full flex items-center justify-center text-slate-400"><i class="fas fa-user"></i></div>'}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-slate-800 truncate">${sName}</h4>
            <div class="text-xs text-slate-500 mb-1 truncate">${fName} | GR: ${gNo}</div>
            <div class="flex gap-2 mt-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">${cClass}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${vColor} border border-transparent">${vStatus}</span>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    function openEditModal(idx) {
      const s = state.students[idx];
      state.currentStudent = s;
      
      const gNo = s['GRNo'] || '';
      const cClass = s['CurrentClass'] || '';
      
      $('editModalSubtitle').innerText = 'GR No: ' + gNo + ' | Class: ' + cClass;
      
      $('e_grNo').value = gNo;
      $('e_name').value = s['StudentName'] || '';
      $('e_surname').value = s['SurnameCast'] || '';
      $('e_father').value = s['FatherGuardianName'] || '';
      $('e_mother').value = s['MotherName'] || '';
      $('e_cnic').value = s['ParentCNIC'] || '';
      const dob = s['DOB'];
      $('e_dob').value = dob ? new Date(dob).toISOString().split('T')[0] : '';
      $('e_class').value = cClass;
      $('e_bform').value = s['BFormNo'] || '';
      $('e_gender').value = s['Gender'] || '';
      $('e_status').value = s['Status'] || 'Admitted';
      $('e_contact').value = s['ParentContact'] || '';
      const doa = s['DateOfAdmission'];
      $('e_doa').value = doa ? new Date(doa).toISOString().split('T')[0] : '';
      $('e_address').value = s['ResidentialAddress'] || '';

      const vStatus = s['Verification_Status'] || 'Pending';
      $('dataStatusBadge').innerText = vStatus;
      $('dataStatusBadge').className = 'font-bold ' + (vStatus === 'Verified' ? 'text-green-600' : (vStatus === 'Corrected' ? 'text-blue-600' : 'text-orange-600'));
      
      // Hide Verify Without Edit button if already verified or corrected
      if (vStatus !== 'Pending') {
        $('markVerifiedBtn').classList.add('hidden');
      } else {
        $('markVerifiedBtn').classList.remove('hidden');
      }
      
      const pStatus = s['Photo_Status'] || 'Pending';
      $('photoStatusBadge').innerText = pStatus;
      $('photoStatusBadge').className = 'font-bold ' + (pStatus === 'Correct' ? 'text-green-600' : (pStatus === 'Replaced' ? 'text-blue-600' : 'text-orange-600'));

      if(s['PhotoURL']) {
        $('stuPhoto').src = getThumb(s['PhotoURL']);
      } else {
        $('stuPhoto').src = '';
      }

      $('editModal').classList.remove('hidden');
    }

    function closeModal() {
      $('editModal').classList.add('hidden');
      state.currentStudent = null;
    }

    $('editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const s = state.currentStudent;
      const gNo = s['GRNo'];
      const updateData = {};
      
      // Use exact column headers provided
      updateData['StudentName'] = $('e_name').value.trim();
      updateData['SurnameCast'] = $('e_surname').value.trim();
      updateData['FatherGuardianName'] = $('e_father').value.trim();
      updateData['MotherName'] = $('e_mother').value.trim();
      updateData['ParentCNIC'] = $('e_cnic').value.trim();
      updateData['DOB'] = $('e_dob').value;
      updateData['CurrentClass'] = $('e_class').value.trim();
      updateData['BFormNo'] = $('e_bform').value.trim();
      updateData['ParentContact'] = $('e_contact').value.trim();
      updateData['DateOfAdmission'] = $('e_doa').value;
      updateData['ResidentialAddress'] = $('e_address').value.trim();

      const sc = state.user.schoolCode || (state.user.scope ? state.user.scope.replace('school=','') : '');

      showOverlay('Updating Record', 'Saving changes to database...');
      try {
        const payload = { 
          action: 'updateAndVerifyStudent', 
          grNo: gNo, 
          schoolCode: sc, 
          updatedBy: state.user.email,
          data: updateData 
        };
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
          showOverlay("Success", "Record updated and verified.", "success");
          closeModal();
          loadList();
        } else {
          showOverlay("Error", result.message || "Failed to update. Verification might be closed.", "error");
        }
      } catch(e) {
        showOverlay("Error", "Network error.", "error");
      }
    });

    $('markVerifiedBtn').addEventListener('click', async () => {
      if(!state.currentStudent) return;
      
      const payload = {
        action: 'markStudentVerified',
        grNo: $('e_grNo').value,
        schoolCode: state.user.schoolCode || (state.user.scope ? state.user.scope.replace('school=','') : ''),
        updatedBy: state.user.email
      };

      showOverlay("Marking Verified", "Updating status...", "loading");
      
      try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
          showOverlay("Success", "Record marked as correct.", "success");
          closeModal();
          loadList();
        } else {
          showOverlay("Error", result.message || "Failed to verify. Verification might be closed.", "error");
        }
      } catch(e) {
        showOverlay("Error", "Network error.", "error");
      }
    });

    // Photo Upload & Crop
    const photoInput = $('photoInput');
    photoInput.addEventListener('change', (e) => {
      if(e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          $('cropperImage').src = ev.target.result;
          $('cropperImage').classList.remove('hidden');
          $('cropModal').classList.remove('hidden');
          
          if(state.cropper) state.cropper.destroy();
          state.cropper = new Cropper($('cropperImage'), {
            aspectRatio: 3 / 4,
            viewMode: 1
          });
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

    $('applyCropBtn').addEventListener('click', async () => {
      if (!state.cropper) return;
      const s = state.currentStudent;
      const gNo = s['GRNo'];
      const sc = state.user.schoolCode || (state.user.scope ? state.user.scope.replace('school=','') : '');
      
      const canvas = state.cropper.getCroppedCanvas({ width: 400, height: 400 });
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      $('cropModal').classList.add('hidden');
      showOverlay('Uploading Photo', 'Saving new photo to Drive...');
      
      try {
        const payload = { 
          action: 'replaceStudentPhoto', 
          grNo: gNo, 
          schoolCode: sc, 
          updatedBy: state.user.email,
          image: base64Image,
          mimeType: 'image/jpeg'
        };

        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
          showOverlay("Success", "Photo replaced successfully.", "success");
          $('stuPhoto').src = "data:image/jpeg;base64," + base64Image;
          $('photoStatusBadge').innerText = "Replaced";
          $('photoStatusBadge').className = "font-bold text-blue-600";
          loadList(); // refresh list
        } else {
          showOverlay("Error", result.message || "Failed to upload. Verification might be closed.", "error");
        }
      } catch(e) {
        showOverlay("Error", "Network error.", "error");
      }
    });

    window.openManualCrop = function() {
      const img = $('stuPhoto');
      if (!img.src || img.src === window.location.href || img.src.includes('placeholder')) {
         alert('No photo available to crop.');
         return;
      }
      $('cropperImage').src = img.src;
      $('cropperImage').classList.remove('hidden');
      $('cropModal').classList.remove('hidden');
      
      if(state.cropper) state.cropper.destroy();
      state.cropper = new Cropper($('cropperImage'), {
        aspectRatio: 3 / 4,
        viewMode: 1
      });
    };
