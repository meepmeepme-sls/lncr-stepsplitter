/**
 * LNCR STEP Splitter - 3D Interactive Viewport Controller
 * Uses Three.js to render decomposed CAD bodies, exploded view, raycasting, and camera presets.
 */

class StepViewer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.getElementById('three-canvas');
    this.bodies = []; // { index, mesh, wireMesh, originalPos, explodeDir, color, name }
    this.selectedBodyIndex = null;
    this.hoveredBodyIndex = null;
    this.wireframeMode = false;
    this.showGrid = true;
    this.onSelectCallback = null;

    // Combat Robotics Anodized Palette
    this.colorPalette = [
      0x094AD8, // LNCR Electric Blue
      0x00F0FF, // Neon Cyan
      0xFF5E00, // Battle Orange
      0xA855F7, // Titanium Purple
      0x10B981, // Emerald Green
      0xF59E0B, // Hazard Amber
      0x64748B, // Stealth Gunmetal
      0xEF4444, // Crimson Red
      0xEAB308, // Anodized Gold
      0xEC4899, // Magenta
      0x06B6D4, // Deep Aqua
      0x84CC16  // Combat Lime
    ];

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    this.camera.position.set(150, 150, 200);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;

    // 5. Lighting
    this.setupLighting();

    // 6. Grid Helper
    this.gridHelper = new THREE.GridHelper(300, 30, 0x00F0FF, 0x2C3240);
    this.gridHelper.position.y = -0.1;
    this.scene.add(this.gridHelper);

    // 7. Raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.onMouseClick(e));

    // 9. Animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(200, 400, 300);
    dirLight1.castShadow = true;
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00F0FF, 0.3);
    dirLight2.position.set(-200, -200, -200);
    this.scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0x094AD8, 0.4);
    dirLight3.position.set(0, 300, -200);
    this.scene.add(dirLight3);
  }

  clearScene() {
    for (const b of this.bodies) {
      if (b.mesh) this.scene.remove(b.mesh);
    }
    this.bodies = [];
    this.selectedBodyIndex = null;
    this.hoveredBodyIndex = null;
  }

  loadBodies(sessionId, bodiesData) {
    this.clearScene();
    const loader = new THREE.STLLoader();
    const total = bodiesData.length;
    let loadedCount = 0;

    // Calculate global bounding box center to compute explode vectors
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const b of bodiesData) {
      if (b.bbox) {
        minX = Math.min(minX, b.bbox[0]);
        minY = Math.min(minY, b.bbox[1]);
        minZ = Math.min(minZ, b.bbox[2]);
        maxX = Math.max(maxX, b.bbox[3]);
        maxY = Math.max(maxY, b.bbox[4]);
        maxZ = Math.max(maxZ, b.bbox[5]);
      }
    }

    const assemblyCenter = new THREE.Vector3(
      (minX + maxX) / 2 || 0,
      (minY + maxY) / 2 || 0,
      (minZ + maxZ) / 2 || 0
    );

    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 100;
    this.assemblyRadius = maxDim / 2;

    bodiesData.forEach((bData, idx) => {
      const colorHex = this.colorPalette[idx % this.colorPalette.length];
      const url = `/api/mesh/${sessionId}/${bData.index}`;

      loader.load(url, (geometry) => {
        geometry.computeVertexNormals();

        // Metallic PBR Material for Combat Robotics look
        const material = new THREE.MeshStandardMaterial({
          color: colorHex,
          metalness: 0.55,
          roughness: 0.35,
          wireframe: this.wireframeMode
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { bodyIndex: bData.index, name: bData.name, baseColor: colorHex };

        // Determine explode direction (from assembly center outward through body COM)
        const com = bData.center_of_mass;
        const bodyCenter = new THREE.Vector3(com.x, com.y, com.z);
        let explodeDir = bodyCenter.clone().sub(assemblyCenter);
        if (explodeDir.lengthSq() < 0.001) {
          // If body is centered, explode along index-based angle
          const angle = (idx / Math.max(1, total)) * Math.PI * 2;
          explodeDir = new THREE.Vector3(Math.cos(angle), 0.5, Math.sin(angle));
        }
        explodeDir.normalize();

        this.scene.add(mesh);

        this.bodies.push({
          index: bData.index,
          mesh: mesh,
          material: material,
          baseColor: colorHex,
          originalPos: mesh.position.clone(),
          explodeDir: explodeDir,
          name: bData.name
        });

        loadedCount++;
        if (loadedCount === total) {
          this.fitCameraToAssembly(minX, minY, minZ, maxX, maxY, maxZ);
        }
      }, undefined, (err) => {
        console.warn(`Could not load STL for body ${bData.index}`, err);
      });
    });
  }

  fitCameraToAssembly(minX, minY, minZ, maxX, maxY, maxZ) {
    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
    const size = new THREE.Vector3(
      maxX - minX,
      maxY - minY,
      maxZ - minZ
    );
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;

    this.camera.position.set(center.x + cameraZ * 0.8, center.y + cameraZ * 0.6, center.z + cameraZ);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();

    // Adjust grid size to encompass assembly
    this.scene.remove(this.gridHelper);
    const gridSize = Math.max(200, Math.ceil(maxDim * 3 / 50) * 50);
    this.gridHelper = new THREE.GridHelper(gridSize, 20, 0x00F0FF, 0x2C3240);
    this.gridHelper.position.set(center.x, minZ - 0.5, center.z);
    this.gridHelper.visible = this.showGrid;
    this.scene.add(this.gridHelper);
  }

  setExplode(factor) { // factor: 0.0 to 1.0
    const maxDisplacement = this.assemblyRadius * 1.5;
    for (const b of this.bodies) {
      if (!b.mesh) continue;
      const offset = b.explodeDir.clone().multiplyScalar(factor * maxDisplacement);
      b.mesh.position.copy(b.originalPos).add(offset);
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.bodies.map(b => b.mesh).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(meshes);

    const badge = document.getElementById('viewport-hover-badge');
    const badgeName = document.getElementById('viewport-hover-name');

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitIndex = hitMesh.userData.bodyIndex;
      this.canvas.style.cursor = 'pointer';

      if (badge && badgeName) {
        badgeName.textContent = hitMesh.userData.name || `Body #${hitIndex}`;
        badge.classList.remove('hidden');
      }

      if (this.hoveredBodyIndex !== hitIndex) {
        this.setHoverState(hitIndex);
      }
    } else {
      this.canvas.style.cursor = 'grab';
      if (badge) badge.classList.add('hidden');
      if (this.hoveredBodyIndex !== null) {
        this.clearHoverState();
      }
    }
  }

  onMouseClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.bodies.map(b => b.mesh).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hitIndex = intersects[0].object.userData.bodyIndex;
      this.selectBody(hitIndex);
      if (this.onSelectCallback) {
        this.onSelectCallback(hitIndex);
      }
    } else {
      this.selectBody(null);
      if (this.onSelectCallback) {
        this.onSelectCallback(null);
      }
    }
  }

  setHoverState(bodyIndex) {
    this.hoveredBodyIndex = bodyIndex;
    for (const b of this.bodies) {
      if (!b.mesh) continue;
      if (b.index === bodyIndex) {
        b.material.emissive.setHex(0x00F0FF);
        b.material.emissiveIntensity = 0.35;
      } else if (b.index !== this.selectedBodyIndex) {
        b.material.emissive.setHex(0x000000);
        b.material.emissiveIntensity = 0.0;
      }
    }
  }

  clearHoverState() {
    this.hoveredBodyIndex = null;
    for (const b of this.bodies) {
      if (!b.mesh) continue;
      if (b.index === this.selectedBodyIndex) {
        b.material.emissive.setHex(0x00F0FF);
        b.material.emissiveIntensity = 0.6;
      } else {
        b.material.emissive.setHex(0x000000);
        b.material.emissiveIntensity = 0.0;
      }
    }
  }

  selectBody(bodyIndex) {
    this.selectedBodyIndex = bodyIndex;
    for (const b of this.bodies) {
      if (!b.mesh) continue;
      if (b.index === bodyIndex) {
        b.material.emissive.setHex(0x00F0FF);
        b.material.emissiveIntensity = 0.6;
      } else {
        b.material.emissive.setHex(0x000000);
        b.material.emissiveIntensity = 0.0;
      }
    }
  }

  setBodyVisibility(bodyIndex, isVisible) {
    const b = this.bodies.find(item => item.index === bodyIndex);
    if (b && b.mesh) {
      b.mesh.visible = isVisible;
    }
  }

  focusBody(bodyIndex) {
    const b = this.bodies.find(item => item.index === bodyIndex);
    if (!b || !b.mesh) return;

    const box = new THREE.Box3().setFromObject(b.mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.2;

    this.controls.target.copy(center);
    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ);
    this.controls.update();
    this.selectBody(bodyIndex);
  }

  setCameraPreset(preset) {
    const target = this.controls.target.clone();
    const dist = this.camera.position.distanceTo(target);

    if (preset === 'top') {
      this.camera.position.set(target.x, target.y + dist, target.z);
      this.camera.up.set(0, 0, -1);
    } else if (preset === 'front') {
      this.camera.position.set(target.x, target.y, target.z + dist);
      this.camera.up.set(0, 1, 0);
    } else if (preset === 'right') {
      this.camera.position.set(target.x + dist, target.y, target.z);
      this.camera.up.set(0, 1, 0);
    } else if (preset === 'iso') {
      const offset = dist / Math.sqrt(3);
      this.camera.position.set(target.x + offset, target.y + offset, target.z + offset);
      this.camera.up.set(0, 1, 0);
    }
    this.controls.update();
  }

  toggleWireframe() {
    this.wireframeMode = !this.wireframeMode;
    for (const b of this.bodies) {
      if (b.material) b.material.wireframe = this.wireframeMode;
    }
    return this.wireframeMode;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    if (this.gridHelper) this.gridHelper.visible = this.showGrid;
    return this.showGrid;
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
