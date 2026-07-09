// ============================================================================
// MICROWAT - Settings Page
// ============================================================================

function initSettingsPage() {
  console.log('🔧 Init Settings');

  // Logout button in settings
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);

  // Profile form
  document.getElementById('profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    addNotification('✅ Profil disimpan', 'success');
  });

  // Fill in current user email
  updateUserDisplay(currentUser?.email || '');
}
