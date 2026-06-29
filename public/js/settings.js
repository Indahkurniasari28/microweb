// ============================================================================
// MICROWAT - Settings Page
// ============================================================================

function initSettingsPage() {
  console.log('🔧 Init Settings');

  // Tab switching
  const tabProfile = document.getElementById('tab-profile');
  const tabParams = document.getElementById('tab-parameters');
  const panelProfile = document.getElementById('panel-profile');
  const panelParams = document.getElementById('panel-parameters');

  function switchTab(tab) {
    if (tab === 'profile') {
      panelProfile?.classList.remove('hidden');
      panelParams?.classList.add('hidden');
      tabProfile?.classList.replace('border-transparent', 'border-primary');
      tabProfile?.classList.replace('text-on-surface-variant', 'text-primary');
      tabParams?.classList.replace('border-primary', 'border-transparent');
      tabParams?.classList.replace('text-primary', 'text-on-surface-variant');
    } else {
      panelProfile?.classList.add('hidden');
      panelParams?.classList.remove('hidden');
      tabParams?.classList.replace('border-transparent', 'border-primary');
      tabParams?.classList.replace('text-on-surface-variant', 'text-primary');
      tabProfile?.classList.replace('border-primary', 'border-transparent');
      tabProfile?.classList.replace('text-primary', 'text-on-surface-variant');
    }
  }

  tabProfile?.addEventListener('click', () => switchTab('profile'));
  tabParams?.addEventListener('click', () => switchTab('parameters'));

  // Logout button in settings
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);

  // Profile form (save button - non-functional demo)
  document.getElementById('profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    addNotification('✅ Profil disimpan', 'success');
  });

  // Parameters form
  document.getElementById('parameters-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const params = {
      initialConcentration: parseFloat(document.getElementById('initial-concentration')?.value || 100),
      wavelength: parseFloat(document.getElementById('wavelength')?.value || 254),
      moldExtinctionCoeff: parseFloat(document.getElementById('extinction-coeff')?.value || 1000),
      pathLength: parseFloat(document.getElementById('path-length')?.value || 1)
    };

    try {
      const response = await fetch('/api/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await response.json();
      if (data.success) {
        systemParameters = params;
        addNotification('✅ Parameter tersimpan', 'success');
      } else {
        addNotification('❌ Gagal menyimpan parameter', 'error');
      }
    } catch (err) {
      addNotification('❌ ' + err.message, 'error');
    }
  });

  // Fill in current user email
  updateUserDisplay(currentUser?.email || '');

  // Fill in current system parameters
  populateParametersForm();
}

function populateParametersForm() {
  if (!systemParameters) return;
  const els = {
    'initial-concentration': systemParameters.initialConcentration,
    'wavelength': systemParameters.wavelength,
    'extinction-coeff': systemParameters.moldExtinctionCoeff,
    'path-length': systemParameters.pathLength
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  });
}

async function loadSystemParameters() {
  try {
    const response = await fetch('/api/parameters');
    const data = await response.json();
    if (data.success) {
      systemParameters = data.parameters;
      populateParametersForm();
    }
  } catch (err) {
    console.error('Error loading parameters:', err);
  }
}
