/**
 * LNCR STEP Splitter - Main Application State & UI Manager
 * Late Night Combat Robotics
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  const state = {
    sessionId: null,
    sourceName: null,
    bodies: [],
    materials: {},
    weightClasses: {},
    currentMaterial: 'al_6061',
    selectedBodyIndex: null,
    viewer: null
  };

  // DOM Elements
  const dropZone = document.getElementById('upload-section');
  const fileInput = document.getElementById('step-file-input');
  const browseBtn = document.getElementById('browse-btn');
  const sampleButtonsContainer = document.getElementById('sample-buttons-container');
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

  // Audio & Theme Elements
  const audio = document.getElementById('lncr-bg-audio');
  const audioBtn = document.getElementById('audio-toggle-btn');
  const audioIcon = document.getElementById('audio-icon');
  const themeBtn = document.getElementById('theme-toggle-btn');

  // Initialize 3D Viewer
  state.viewer = new StepViewer3D('viewer-container');
  state.viewer.onSelectCallback = (bodyIndex) => {
    highlightBodyCard(bodyIndex);
  };

  // 1. Audio Controls
  let audioPlaying = false;
  audioBtn.addEventListener('click', () => {
    if (audioPlaying) {
      audio.pause();
      audioPlaying = false;
      audioIcon.setAttribute('data-lucide', 'volume-x');
    } else {
      audio.volume = 0.25;
      audio.play().then(() => {
        audioPlaying = true;
        audioIcon.setAttribute('data-lucide', 'volume-2');
      }).catch(err => console.log('Autoplay prevented', err));
    }
    lucide.createIcons();
  });

  // 2. Theme Switcher
  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('lnc_theme', isDark ? 'dark' : 'light');
    if (state.viewer) {
      state.viewer.scene.background = new THREE.Color(isDark ? 0x0e1015 : 0xf1f5f9);
    }
    lucide.createIcons();
  });

  // 3. Fetch Materials & Samples on Load
  fetch('/api/materials')
    .then(r => r.json())
    .then(data => {
      state.materials = data.materials;
      state.weightClasses = data.weight_classes;
    });

  loadSampleList();

  function loadSampleList() {
    fetch('/api/samples')
      .then(r => r.json())
      .then(data => {
        sampleButtonsContainer.innerHTML = '';
        if (data.samples && data.samples.length > 0) {
          data.samples.forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-[#1E222B] border border-slate-200 dark:border-[#2C3240] hover:border-[#094AD8] dark:hover:border-[#00F0FF] text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1.5';
            btn.innerHTML = `<span class="truncate max-w-[150px]">${s.name}</span><span class="text-[10px] text-slate-400">(${s.size_kb} KB)</span>`;
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              loadSample(s.name);
            });
            sampleButtonsContainer.appendChild(btn);
          });
        } else {
          sampleButtonsContainer.innerHTML = '<span class="text-xs text-slate-400 font-mono">No sample files found</span>';
        }
      });
  }

  function loadSample(sampleName) {
    showLoading(`Loading sample: ${sampleName}`, "Reading B-Rep bodies & generating preview meshes...");
    fetch(`/api/load-sample/${encodeURIComponent(sampleName)}`, { method: 'POST' })
      .then(r => {
        if (!r.ok) return r.json().then(err => { throw new Error(err.detail || 'Failed'); });
        return r.json();
      })
      .then(data => {
        hideLoading();
        handleSessionLoaded(data);
      })
      .catch(err => {
        hideLoading();
        alert(`Error loading sample: ${err.message}`);
      });
  }

  // 4. Drag & Drop & Upload Handling
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
      alert("Invalid format! Please upload a CAD STEP file (.step or .stp).");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoading("Decomposing Multi-Body STEP", "Parsing OpenCASCADE topology and isolating solids...");

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

  // 5. Handling Loaded CAD Data
  function handleSessionLoaded(data) {
    state.sessionId = data.session_id;
    state.sourceName = data.source_name;
    state.bodies = data.bodies;

    // Update Header Stats
    activeFilename.textContent = data.source_name;
    activeBodyBadge.textContent = `${data.bodies.length} ${data.bodies.length === 1 ? 'Body' : 'Bodies'} Isolated`;
    
    const totMm3 = data.summary.total_volume_mm3;
    const totCm3 = data.summary.total_volume_cm3;
    statTotalVolume.textContent = `${totMm3.toLocaleString()} mm³ (${totCm3} cm³)`;

    // Estimate weight in default 6061 Aluminum
    const defaultMassG = data.summary.total_masses[state.currentMaterial]?.mass_g || 0;
    const beetlePct = ((defaultMassG / 1360.78) * 100).toFixed(1);
    statTotalClass.textContent = `${defaultMassG.toFixed(1)}g (${beetlePct}% of 3lb Beetleweight)`;

    // Render Body Cards
    renderBodyCards();

    // Load into 3D Viewport
    state.viewer.loadBodies(state.sessionId, state.bodies);

    // Switch view
    dropZone.classList.add('hidden');
    cadWorkspace.classList.remove('hidden');

    // Reset Explode Slider
    explodeSlider.value = 0;
    explodeVal.textContent = '0%';

    lucide.createIcons();
  }

  // 6. Render Body Cards in Inspector Sidebar
  function renderBodyCards() {
    bodiesContainer.innerHTML = '';

    state.bodies.forEach((b, idx) => {
      const card = document.createElement('div');
      card.className = 'body-card p-4 rounded-xl border border-slate-200 dark:border-[#2C3240] bg-slate-50/70 dark:bg-[#16181D] space-y-3';
      card.id = `body-card-${b.index}`;

      const colorHex = '#' + state.viewer.colorPalette[idx % state.viewer.colorPalette.length].toString(16).padStart(6, '0');
      const curMat = state.currentMaterial;
      const massInfo = b.masses[curMat] || { mass_g: 0, mass_oz: 0 };
      const beetlePct = Math.min(100, ((massInfo.mass_g / 1360.78) * 100)).toFixed(1);

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          
          <div class="flex items-center space-x-2.5 flex-1 min-w-0">
            <input type="checkbox" class="body-select-checkbox w-4 h-4 rounded text-[#094AD8] focus:ring-0" data-index="${b.index}" checked />
            <span class="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style="background-color: ${colorHex}"></span>
            <div class="flex-1 min-w-0">
              <input type="text" class="body-name-input w-full text-xs font-mono font-bold bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-[#2C3240] focus:border-[#094AD8] focus:outline-none text-slate-900 dark:text-white" value="${b.name}" data-index="${b.index}" title="Click to rename body" />
            </div>
          </div>

          <div class="flex items-center space-x-1 flex-shrink-0">
            <!-- Focus in 3D Button -->
            <button class="focus-body-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2C3240] text-slate-500 hover:text-[#094AD8] dark:hover:text-[#00F0FF] transition-colors" data-index="${b.index}" title="Focus in 3D Viewport">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <!-- Toggle Visibility -->
            <button class="toggle-visibility-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2C3240] text-slate-500 hover:text-[#094AD8] dark:hover:text-[#00F0FF] transition-colors" data-index="${b.index}" data-visible="true" title="Toggle visibility in 3D">
              <i data-lucide="layers" class="w-3.5 h-3.5"></i>
            </button>
            <!-- Download Single STEP -->
            <button class="download-body-btn px-2.5 py-1 rounded-lg bg-[#094AD8]/10 hover:bg-[#094AD8] text-[#094AD8] hover:text-white dark:bg-[#00F0FF]/10 dark:text-[#00F0FF] dark:hover:bg-[#00F0FF] dark:hover:text-[#0E1015] text-[11px] font-mono font-bold transition-all flex items-center space-x-1" data-index="${b.index}" title="Download individual body as STEP">
              <i data-lucide="download" class="w-3 h-3"></i>
              <span>STEP</span>
            </button>
          </div>

        </div>

        <!-- Telemetry Details Grid -->
        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white dark:bg-[#0E1015] p-2.5 rounded-lg border border-slate-100 dark:border-[#1E222B]">
          <div>
            <span class="text-slate-400 block text-[9px] uppercase">Bounding Box (L × W × H)</span>
            <span class="text-slate-700 dark:text-slate-300 font-semibold">${b.dimensions_mm.dx} × ${b.dimensions_mm.dy} × ${b.dimensions_mm.dz} mm</span>
            <span class="text-slate-400 block text-[9px]">(${b.dimensions_in.dx} × ${b.dimensions_in.dy} × ${b.dimensions_in.dz} in)</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[9px] uppercase">Volume</span>
            <span class="text-slate-700 dark:text-slate-300 font-semibold">${b.volume_mm3.toLocaleString()} mm³</span>
            <span class="text-slate-400 block text-[9px]">(${b.volume_cm3} cm³)</span>
          </div>
        </div>

        <!-- Material Mass Gauge -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="text-slate-500 dark:text-slate-400">Est. Mass (<span class="body-mat-name">${state.materials[curMat]?.name || curMat}</span>):</span>
            <span class="font-bold text-[#094AD8] dark:text-[#00F0FF] body-mass-display">${massInfo.mass_g}g (${massInfo.mass_oz} oz)</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-[#2C3240] h-1.5 rounded-full overflow-hidden">
            <div class="weight-progress-bar bg-[#094AD8] dark:bg-[#00F0FF] h-full" style="width: ${beetlePct}%"></div>
          </div>
          <div class="text-[9px] font-mono text-slate-400 text-right">
            <span>${beetlePct}% of 3lb Beetleweight limit</span>
          </div>
        </div>
      `;

      // Card hover highlights corresponding body in 3D
      card.addEventListener('mouseenter', () => {
        state.viewer.setHoverState(b.index);
      });
      card.addEventListener('mouseleave', () => {
        state.viewer.clearHoverState();
      });

      // Inline Rename Event
      const nameInput = card.querySelector('.body-name-input');
      nameInput.addEventListener('change', () => {
        b.name = nameInput.value.trim() || `Body_${b.index}`;
        // Sync with viewer mesh name
        const meshObj = state.viewer.bodies.find(x => x.index === b.index);
        if (meshObj) meshObj.name = b.name;
        // Post rename to server
        fetch(`/api/rename/${state.sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: { [b.index]: b.name } })
        });
      });

      // Focus Body in 3D Button
      card.querySelector('.focus-body-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.viewer.focusBody(b.index);
        highlightBodyCard(b.index);
      });

      // Toggle Visibility Button
      const visBtn = card.querySelector('.toggle-visibility-btn');
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyVisible = visBtn.getAttribute('data-visible') === 'true';
        const nextVisible = !currentlyVisible;
        visBtn.setAttribute('data-visible', String(nextVisible));
        state.viewer.setBodyVisibility(b.index, nextVisible);
        visBtn.classList.toggle('opacity-30', !nextVisible);
      });

      // Download Single Body STEP
      card.querySelector('.download-body-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadBodyStep(b.index);
      });

      bodiesContainer.appendChild(card);
    });

    lucide.createIcons();
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

  // 7. Single Body Download
  function downloadBodyStep(bodyIndex) {
    if (!state.sessionId) return;
    const body = state.bodies.find(b => b.index === bodyIndex);
    const customName = body ? body.name : `Body_${bodyIndex}`;
    const centerOrigin = centerOriginToggle.checked;
    const url = `/api/download/${state.sessionId}/${bodyIndex}?center_origin=${centerOrigin}&custom_name=${encodeURIComponent(customName)}`;
    window.location.href = url;
  }

  // 8. Download All Bodies as ZIP
  downloadAllZipBtn.addEventListener('click', () => {
    if (!state.sessionId) return;
    const centerOrigin = centerOriginToggle.checked;
    const url = `/api/download-all/${state.sessionId}?center_origin=${centerOrigin}`;
    window.location.href = url;
  });

  // 9. Download Selected Bodies as ZIP
  downloadSelectedBtn.addEventListener('click', () => {
    if (!state.sessionId) return;
    const checkedCheckboxes = document.querySelectorAll('.body-select-checkbox:checked');
    if (checkedCheckboxes.length === 0) {
      alert("No bodies selected! Please check at least one body.");
      return;
    }
    const selectedIndices = Array.from(checkedCheckboxes).map(cb => cb.getAttribute('data-index')).join(',');
    const centerOrigin = centerOriginToggle.checked;
    const url = `/api/download-all/${state.sessionId}?selected_indices=${encodeURIComponent(selectedIndices)}&center_origin=${centerOrigin}`;
    window.location.href = url;
  });

  // 10. Select All / Deselect All
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    document.querySelectorAll('.body-select-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });
  });

  // 11. Explode Slider
  explodeSlider.addEventListener('input', () => {
    const factor = parseFloat(explodeSlider.value) / 100.0;
    explodeVal.textContent = `${explodeSlider.value}%`;
    state.viewer.setExplode(factor);
  });

  // 12. Global Material Selector
  globalMaterialSelect.addEventListener('change', () => {
    state.currentMaterial = globalMaterialSelect.value;
    updateMaterialMasses();
  });

  function updateMaterialMasses() {
    const curMat = state.currentMaterial;
    const matName = state.materials[curMat]?.name || curMat;

    let totalG = 0;

    state.bodies.forEach(b => {
      const card = document.getElementById(`body-card-${b.index}`);
      if (!card) return;

      const massInfo = b.masses[curMat] || { mass_g: 0, mass_oz: 0 };
      totalG += massInfo.mass_g;
      const beetlePct = Math.min(100, ((massInfo.mass_g / 1360.78) * 100)).toFixed(1);

      card.querySelector('.body-mat-name').textContent = matName;
      card.querySelector('.body-mass-display').textContent = `${massInfo.mass_g}g (${massInfo.mass_oz} oz)`;
      card.querySelector('.weight-progress-bar').style.width = `${beetlePct}%`;
    });

    const totalPct = ((totalG / 1360.78) * 100).toFixed(1);
    statTotalClass.textContent = `${totalG.toFixed(1)}g (${totalPct}% of 3lb Beetleweight)`;
  }

  // 13. Camera Preset Buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      state.viewer.setCameraPreset(view);
    });
  });

  // 14. View Toggles (Wireframe, Grid, Reset Cam)
  document.getElementById('toggle-wireframe-btn').addEventListener('click', () => {
    const wire = state.viewer.toggleWireframe();
    document.getElementById('toggle-wireframe-btn').classList.toggle('text-[#00F0FF]', wire);
  });

  document.getElementById('toggle-grid-btn').addEventListener('click', () => {
    const grid = state.viewer.toggleGrid();
    document.getElementById('toggle-grid-btn').classList.toggle('text-[#00F0FF]', grid);
  });

  document.getElementById('reset-cam-btn').addEventListener('click', () => {
    state.viewer.setCameraPreset('iso');
  });

  // 15. Upload Another / Reset Button
  uploadAnotherBtn.addEventListener('click', () => {
    cadWorkspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    state.viewer.clearScene();
    state.sessionId = null;
    state.bodies = [];
  });

});
