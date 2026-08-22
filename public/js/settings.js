// ============================================================================
// MICROWAT - Settings Page (User Account)
// ============================================================================

function initSettingsPage() {
  console.log('🔧 Init Settings');

  const email = currentUser?.email || '';

  // Logout button in settings
  document.getElementById('btn-logout-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Load saved profile data
  let savedProfile = {};
  try {
    savedProfile = JSON.parse(safeStorage.getItem('user_profile_' + email) || '{}');
  } catch (e) {}

  const nameInput = document.getElementById('profile-name');
  const orgInput = document.getElementById('profile-org');
  const locInput = document.getElementById('profile-location');
  const emailInput = document.getElementById('profile-email-input');

  if (nameInput) nameInput.value = savedProfile.name || currentUser?.name || '';
  if (orgInput) orgInput.value = savedProfile.org || savedProfile.institution || currentUser?.institution || '';
  if (locInput) locInput.value = savedProfile.location || '';
  if (emailInput) emailInput.value = email;

  // Profile display headers
  const profileDisp = document.getElementById('profile-display-name');
  if (profileDisp) profileDisp.textContent = savedProfile.name || currentUser?.name || email || 'User';
  const settingsEmail = document.getElementById('settings-email');
  if (settingsEmail) settingsEmail.textContent = email;

  // Profile form submission
  document.getElementById('profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameInput?.value?.trim() || '';
    const org = orgInput?.value?.trim() || '';
    const location = locInput?.value?.trim() || '';

    const profileData = { name, org, institution: org, location, email };
    safeStorage.setItem('user_profile_' + email, JSON.stringify(profileData));

    if (currentUser) {
      currentUser.name = name;
      currentUser.institution = org;
      safeStorage.setItem('user', JSON.stringify(currentUser));
    }

    if (profileDisp) profileDisp.textContent = name || email;
    const userEmailDisp = document.getElementById('user-email-display');
    if (userEmailDisp) userEmailDisp.textContent = name || email;

    addNotification('✅ User profile saved successfully', 'success');
  });

  // Password visibility toggles
  setupPasswordToggle('toggle-user-current-pw', 'user-current-pw');
  setupPasswordToggle('toggle-user-new-pw', 'user-new-pw');
  setupPasswordToggle('toggle-user-confirm-pw', 'user-confirm-pw');

  // Change password form submission
  document.getElementById('user-password-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const curPw = document.getElementById('user-current-pw')?.value;
    const newPw = document.getElementById('user-new-pw')?.value;
    const confirmPw = document.getElementById('user-confirm-pw')?.value;

    if (!curPw) {
      addNotification('⚠️ Please enter current password', 'warning');
      return;
    }
    if (!newPw || newPw.length < 6) {
      addNotification('⚠️ New password must be at least 6 characters', 'warning');
      return;
    }
    if (newPw !== confirmPw) {
      addNotification('❌ Password confirmation does not match', 'error');
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword: curPw, newPassword: newPw })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('user-current-pw').value = '';
        document.getElementById('user-new-pw').value = '';
        document.getElementById('user-confirm-pw').value = '';
        safeStorage.setItem('user_pw_' + email, newPw);
        addNotification('✅ New password updated successfully', 'success');
      } else {
        addNotification(`❌ ${data.message || 'Failed to change password'}`, 'error');
      }
    } catch (err) {
      safeStorage.setItem('user_pw_' + email, newPw);
      document.getElementById('user-current-pw').value = '';
      document.getElementById('user-new-pw').value = '';
      document.getElementById('user-confirm-pw').value = '';
      addNotification('✅ New password saved', 'success');
    }
  });
}

function setupPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.onclick = (e) => {
    e.preventDefault();
    const icon = btn.querySelector('.material-symbols-outlined');
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.textContent = 'visibility_off';
    } else {
      input.type = 'password';
      if (icon) icon.textContent = 'visibility';
    }
  };
}

