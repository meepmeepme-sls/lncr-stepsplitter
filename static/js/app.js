/**
 * LNCR STEP Splitter - Main Application State & UI Manager
 * Matches Late Night Combat Robotics Calculator Suite formatting and conventions.
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    sessionId: null,
    sourceName: null,
    bodies: [],
    materials: {},
    currentMaterial: 'uhmw',
    viewer: null
  };

  // DOM Elements
  const uploadCard = document.getElementById('upload-card');
  const dropZone = document.getElementById('upload-section');
  const fileInput = document.getElementById('step-file-input');
  const browseBtn = document.getElementById('browse-btn');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const cadWorkspace = document.getElementById('cad-workspace');
  const activeFilename = document.getElementById('active-filename');
  const activeBodyBadge = document.getElementById('active-body-badge');
  const statTotalVolume = document.getElementById('stat-total-volume');
  const statTotalClass = document.getElementById('stat-total-class');
  const bodiesContainer = document.getElementById('bodies-container');
  const explodeSlider = document.getElementById('explode-slider');
  const explodeVal = document.getElementById('explode-val');
  const centerOriginToggle = document.getElementById('center-origin-toggle');
  const downloadAllZipBtn = document.getElementById('download-all-zip-btn');
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  const selectAllCheckbox = document.getElementById('select-all-bodies-checkbox');
  const globalMaterialSelect = document.getElementById('global-material-select');
  const uploadAnotherBtn = document.getElementById('upload-another-btn');

  // Header & Footer Controls
  const headerThemeBtn = document.getElementById('header-theme-btn');
  const footerDarkSwitch = document.getElementById('footer-dark-switch');
  const footerDarkKnob = document.getElementById('footer-dark-knob');
  const headerResetBtn = document.getElementById('header-reset-btn');
  const headerExportBtn = document.getElementById('header-export-btn');
  const toastBanner = document.getElementById('toast-banner');
  const toastText = document.getElementById('toast-text');

  // Initialize 3D Viewer
  state.viewer = new StepViewer3D('viewer-container');
  state.viewer.onSelectCallback = (bodyIndex) => {
    highlightBodyCard(bodyIndex);
  };

  function showToast(msg) {
    if (!toastBanner || !toastText) return;
    toastText.textContent = msg;
    toastBanner.classList.remove('hidden');
    setTimeout(() => toastBanner.classList.add('hidden'), 2800);
  }

  // 1. Theme Sync (Light mode default)
  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lnc_theme', 'dark');
      if (headerThemeBtn) headerThemeBtn.textContent = 'Light';
      if (footerDarkSwitch) {
        footerDarkSwitch.setAttribute('aria-checked', 'true');
        footerDarkSwitch.classList.remove('bg-[#CBD5E1]');
        footerDarkSwitch.classList.add('bg-[#094AD8]');
      }
      if (footerDarkKnob) {
        footerDarkKnob.classList.remove('translate-x-0');
        footerDarkKnob.classList.add('translate-x-5');
      }
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lnc_theme', 'light');
      if (headerThemeBtn) headerThemeBtn.textContent = 'Dark';
      if (footerDarkSwitch) {
        footerDarkSwitch.setAttribute('aria-checked', 'false');
        footerDarkSwitch.classList.remove('bg-[#094AD8]');
        footerDarkSwitch.classList.add('bg-[#CBD5E1]');
      }
      if (footerDarkKnob) {
        footerDarkKnob.classList.remove('translate-x-5');
        footerDarkKnob.classList.add('translate-x-0');
      }
    }
    if (state.viewer) state.viewer.setTheme(isDark);
  }

  applyTheme(document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    applyTheme(!document.documentElement.classList.contains('dark'));
  }

  if (headerThemeBtn) headerThemeBtn.addEventListener('click', toggleTheme);
  if (footerDarkSwitch) footerDarkSwitch.addEventListener('click', toggleTheme);

  // 2. Header Export Action
  if (headerExportBtn) {
    headerExportBtn.addEventListener('click', () => {
      if (!state.sessionId) return;
      const centerOrigin = centerOriginToggle.checked;
      window.location.href = `/api/download-all/${state.sessionId}?center_origin=${centerOrigin}`;
    });
  }

  // 4. Fetch Materials on Load
  fetch('/api/materials')
    .then(r => r.json())
    .then(data => {
      state.materials = data.materials || {};
    })
    .catch(() => {});

  // 5. Drag & Drop & Upload Handling
  dropZone.addEventListener('click', () => fileInput.click());
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  function uploadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['step', 'stp'].includes(ext)) {
      alert('Invalid format! Please upload a CAD STEP file (.step or .stp).');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoading('Decomposing Multi-Body STEP', 'Isolating solid bodies and generating 3D meshes...');

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(r => {
      if (!r.ok) return r.json().then(err => { throw new Error(err.detail || 'Upload failed'); });
      return r.json();
    })
    .then(data => {
      hideLoading();
      handleSessionLoaded(data);
    })
    .catch(err => {
      hideLoading();
      alert(`Upload error: ${err.message}`);
    });
  }

  function showLoading(title, status) {
    document.getElementById('loading-title').textContent = title;
    loadingStatus.textContent = status;
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  // 6. Handling Loaded CAD Data
  function handleSessionLoaded(data) {
    state.sessionId = data.session_id;
    state.sourceName = data.source_name;
    state.bodies = data.bodies;

    activeFilename.textContent = data.source_name;
    activeBodyBadge.textContent = `${data.bodies.length} ${data.bodies.length === 1 ? 'Body' : 'Bodies'}`;

    const totMm3 = data.summary.total_volume_mm3;
    const totCm3 = data.summary.total_volume_cm3;
    statTotalVolume.textContent = `${totMm3.toLocaleString()} mm³ (${totCm3} cm³)`;

    if (headerExportBtn) headerExportBtn.disabled = false;

    renderBodyCards();
    updateMaterialMasses();

    uploadCard.classList.add('hidden');
    cadWorkspace.classList.remove('hidden');

    state.viewer.onWindowResize();
    state.viewer.loadBodies(state.sessionId, state.bodies);

    explodeSlider.value = 0;
    explodeVal.textContent = '0%';
  }

  // 7. Render Body Cards
  function renderBodyCards() {
    bodiesContainer.innerHTML = '';

    state.bodies.forEach((b, idx) => {
      const card = document.createElement('div');
      card.className = 'body-card p-3.5 rounded-none border border-[#CBD5E1] dark:border-[#2E3646] bg-[#F8FAFC] dark:bg-[#16181D] space-y-2.5';
      card.id = `body-card-${b.index}`;

      const colorHex = '#' + state.viewer.colorPalette[idx % state.viewer.colorPalette.length].toString(16).padStart(6, '0');
      const curMat = state.currentMaterial;
      const massInfo = b.masses[curMat] || { mass_g: 0, mass_oz: 0 };

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <input type="checkbox" class="body-select-checkbox w-3.5 h-3.5 text-[#094AD8]" data-index="${b.index}" checked />
            <span class="w-3 h-3 shrink-0 inline-block border border-black/15" style="background-color: ${colorHex}"></span>
            <input type="text" class="body-name-input w-full text-xs font-bold bg-transparent border-b border-transparent hover:border-[#CBD5E1] dark:hover:border-[#2E3646] focus:border-[#094AD8] focus:outline-none text-[#0F172A] dark:text-[#CEDDFD]" value="${b.name}" data-index="${b.index}" title="Click to rename body" />
          </div>

          <div class="flex items-center space-x-1 shrink-0">
            <button type="button" class="focus-body-btn px-2 py-1 rounded-none border border-[#CBD5E1] dark:border-[#2E3646] bg-white dark:bg-[#1F232B] text-[11px] font-semibold text-[#64748B] dark:text-[#85A3E0] hover:text-[#094AD8] hover:border-[#094AD8] cursor-pointer">
              Focus
            </button>
            <button type="button" class="toggle-visibility-btn px-2 py-1 rounded-none border border-[#CBD5E1] dark:border-[#2E3646] bg-white dark:bg-[#1F232B] text-[11px] font-semibold text-[#64748B] dark:text-[#85A3E0] hover:text-[#094AD8] hover:border-[#094AD8] cursor-pointer" data-visible="true">
              Hide
            </button>
            <button type="button" class="download-body-btn px-2.5 py-1 rounded-none bg-[#094AD8] hover:bg-[#1B5DF5] text-white text-[11px] font-bold transition-colors cursor-pointer">
              Download STEP
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-[#1F232B] p-2.5 rounded-none border border-[#E2E8F0] dark:border-[#2E3646] tabular-nums">
          <div>
            <span class="text-[#64748B] dark:text-[#85A3E0] block text-[10px] uppercase font-semibold">Bounding Box</span>
            <span class="text-[#0F172A] dark:text-[#CEDDFD] font-bold">${b.dimensions_mm.dx} × ${b.dimensions_mm.dy} × ${b.dimensions_mm.dz} mm</span>
            <span class="text-[#64748B] dark:text-[#85A3E0] block text-[10px]">(${b.dimensions_in.dx} × ${b.dimensions_in.dy} × ${b.dimensions_in.dz} in)</span>
          </div>
          <div>
            <span class="text-[#64748B] dark:text-[#85A3E0] block text-[10px] uppercase font-semibold">Volume</span>
            <span class="text-[#0F172A] dark:text-[#CEDDFD] font-bold">${b.volume_mm3.toLocaleString()} mm³</span>
            <span class="text-[#64748B] dark:text-[#85A3E0] block text-[10px]">(${b.volume_cm3} cm³)</span>
          </div>
        </div>

        <div class="tabular-nums">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-[#64748B] dark:text-[#85A3E0]">Est. Mass (<span class="body-mat-name">${state.materials[curMat]?.name || curMat}</span>):</span>
            <span class="font-bold text-[#094AD8] dark:text-[#60A5FA] body-mass-display">${massInfo.mass_g}g (${massInfo.mass_oz} oz)</span>
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => state.viewer.setHoverState(b.index));
      card.addEventListener('mouseleave', () => state.viewer.clearHoverState());

      const nameInput = card.querySelector('.body-name-input');
      nameInput.addEventListener('change', () => {
        b.name = nameInput.value.trim() || `Body_${b.index}`;
        const meshObj = state.viewer.bodies.find(x => x.index === b.index);
        if (meshObj) meshObj.name = b.name;
        fetch(`/api/rename/${state.sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: { [b.index]: b.name } })
        });
      });

      card.querySelector('.focus-body-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.viewer.focusBody(b.index);
        highlightBodyCard(b.index);
      });

      const visBtn = card.querySelector('.toggle-visibility-btn');
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const visible = visBtn.getAttribute('data-visible') === 'true';
        const next = !visible;
        visBtn.setAttribute('data-visible', String(next));
        visBtn.textContent = next ? 'Hide' : 'Show';
        state.viewer.setBodyVisibility(b.index, next);
      });

      card.querySelector('.download-body-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadBodyStep(b.index);
      });

      bodiesContainer.appendChild(card);
    });
  }

  function highlightBodyCard(bodyIndex) {
    document.querySelectorAll('.body-card').forEach(c => c.classList.remove('selected-in-3d'));
    if (bodyIndex !== null) {
      const targetCard = document.getElementById(`body-card-${bodyIndex}`);
      if (targetCard) {
        targetCard.classList.add('selected-in-3d');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // 8. Export Helpers
  function downloadBodyStep(bodyIndex) {
    if (!state.sessionId) return;
    const body = state.bodies.find(b => b.index === bodyIndex);
    const customName = body ? body.name : `Body_${bodyIndex}`;
    const centerOrigin = centerOriginToggle.checked;
    window.location.href = `/api/download/${state.sessionId}/${bodyIndex}?center_origin=${centerOrigin}&custom_name=${encodeURIComponent(customName)}`;
  }

  downloadAllZipBtn.addEventListener('click', () => {
    if (!state.sessionId) return;
    const centerOrigin = centerOriginToggle.checked;
    window.location.href = `/api/download-all/${state.sessionId}?center_origin=${centerOrigin}`;
  });

  downloadSelectedBtn.addEventListener('click', () => {
    if (!state.sessionId) return;
    const checked = document.querySelectorAll('.body-select-checkbox:checked');
    if (checked.length === 0) {
      alert('No bodies selected! Please check at least one body.');
      return;
    }
    const indices = Array.from(checked).map(cb => cb.getAttribute('data-index')).join(',');
    const centerOrigin = centerOriginToggle.checked;
    window.location.href = `/api/download-all/${state.sessionId}?selected_indices=${encodeURIComponent(indices)}&center_origin=${centerOrigin}`;
  });

  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    document.querySelectorAll('.body-select-checkbox').forEach(cb => { cb.checked = isChecked; });
  });

  explodeSlider.addEventListener('input', () => {
    const factor = parseFloat(explodeSlider.value) / 100.0;
    explodeVal.textContent = `${explodeSlider.value}%`;
    state.viewer.setExplode(factor);
  });

  globalMaterialSelect.addEventListener('change', () => {
    state.currentMaterial = globalMaterialSelect.value;
    updateMaterialMasses();
  });

  function updateMaterialMasses() {
    const curMat = state.currentMaterial;
    const matName = state.materials[curMat]?.name || curMat;
    let totalG = 0;

    state.bodies.forEach(b => {
      const massInfo = b.masses[curMat] || { mass_g: 0, mass_oz: 0 };
      totalG += massInfo.mass_g;

      const card = document.getElementById(`body-card-${b.index}`);
      if (!card) return;

      card.querySelector('.body-mat-name').textContent = matName;
      card.querySelector('.body-mass-display').textContent = `${massInfo.mass_g}g (${massInfo.mass_oz} oz)`;
    });

    const totalOz = totalG / 28.3495;
    statTotalClass.textContent = `${totalG.toFixed(1)}g (${totalOz.toFixed(2)} oz) — ${matName}`;
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => state.viewer.setCameraPreset(btn.getAttribute('data-view')));
  });

  document.getElementById('toggle-wireframe-btn').addEventListener('click', () => {
    const wire = state.viewer.toggleWireframe();
    const btn = document.getElementById('toggle-wireframe-btn');
    btn.classList.toggle('bg-[#094AD8]', wire);
    btn.classList.toggle('text-white', wire);
  });

  document.getElementById('toggle-grid-btn').addEventListener('click', () => {
    const grid = state.viewer.toggleGrid();
    const btn = document.getElementById('toggle-grid-btn');
    btn.classList.toggle('opacity-50', !grid);
  });

  document.getElementById('reset-cam-btn').addEventListener('click', () => {
    state.viewer.setCameraPreset('iso');
  });

  function resetWorkspace() {
    cadWorkspace.classList.add('hidden');
    uploadCard.classList.remove('hidden');
    fileInput.value = '';
    state.viewer.clearScene();
    state.sessionId = null;
    state.bodies = [];
    if (headerExportBtn) headerExportBtn.disabled = true;
  }

  uploadAnotherBtn.addEventListener('click', resetWorkspace);
  if (headerResetBtn) headerResetBtn.addEventListener('click', resetWorkspace);
});
