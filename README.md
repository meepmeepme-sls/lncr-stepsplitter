# LNCR Multi-Body STEP Splitter 💥

**LNCR Multi-Body STEP Splitter** is a high-performance web-based CAD decomposition and telemetry suite built specifically in the signature **Late Night Combat Robotics** visual and engineering style.

Built by **Ian Talbert** ([Late Night Combat Robotics](https://www.latenightcombat.com)).

---

## ⚡ Key Features

1. **Multi-Body STEP Splitting (ISO 10303 AP203 / AP214 / AP242)**:
   - Decomposes any multi-body `.step` or `.stp` file into clean, standalone solid B-Rep STEP files using **OpenCASCADE 7.8** geometry kernel.
   - Preserves exact topological faces, curved NURBS surfaces, edges, vertices, and coordinate placement.
   - Grounding switch: Choose between preserving original CAD assembly coordinates or grounding each body to $(X=0, Y=0, Z=0)$ for CAM / 3D printing slicers.

2. **Interactive 3D Viewport (Three.js)**:
   - **Exploded View Slider**: Smoothly separates multi-body assemblies outward from their shared center of mass to inspect mating faces, pocketing, bearing bores, and bolt patterns.
   - **Raycast Selection**: Hovering or clicking on any 3D body highlights both the mesh and its telemetry card in the sidebar.
   - **Camera Presets**: 1-click Isometric, Top (XY), Front (XZ), and Side (YZ) orthographic/perspective orientations.
   - **Combat Anodized Palette**: Automatic distinct color-coding for each body (LNCR Electric Blue, Neon Cyan, Battle Orange, Titanium Violet, Emerald Green, Hazard Amber).

3. **Combat Robotics Mass & Telemetry Calculator**:
   - Calculates exact B-Rep volume ($mm^3$ and $cm^3$) and bounding dimensions ($L \times W \times H$ in millimeters and inches).
   - Real-time mass calculation across **15 combat robotics materials**:
     - **6061-T6 Aluminum** ($2.70\text{ g/cm}^3$)
     - **7075-T6 Aluminum** ($2.81\text{ g/cm}^3$)
     - **Grade 5 Titanium (Ti-6Al-4V)** ($4.43\text{ g/cm}^3$)
     - **AR500 / Hardox Wear Steel** ($7.85\text{ g/cm}^3$)
     - **AR400 Armor Plate** ($7.85\text{ g/cm}^3$)
     - **S7 Shock Tool Steel** ($7.83\text{ g/cm}^3$)
     - **4140 Chromoly Steel** ($7.85\text{ g/cm}^3$)
     - **TPU 95A (3D Printed)** ($1.21\text{ g/cm}^3$)
     - **UHMW-PE** ($0.94\text{ g/cm}^3$)
     - **Polycarbonate (Lexan)** ($1.20\text{ g/cm}^3$)
     - **Carbon Fiber 3K Plate** ($1.55\text{ g/cm}^3$)
     - **Delrin / POM** ($1.42\text{ g/cm}^3$)
     - **PLA+ / PETG / Nylon CF15**
   - Live weight limit gauge: Displays percentage consumed of the **3 lb Beetleweight** limit (or custom weight class).

4. **Batch & Individual STEP Export**:
   - **1-Click Download Single Body**: Downloads an individual isolated body as a clean `.step` file.
   - **Batch Download All (.ZIP)**: Packages all decomposed bodies with user-specified custom names into a structured `.zip` archive.
   - **Engineering Manifest**: Automatically includes `LNCR_STEP_MANIFEST.txt` with complete dimensional specs, volumes, and material weight breakdowns.

5. **Signature Late Night Combat Aesthetics**:
   - LNCR Electric Blue (`#094AD8`), Dark Mode (`#16181D`), and Cyan Neon accents (`#00F0FF`).
   - Background audio stream (*Kevin MacLeod - Cipher*) with volume and mute toggle matching `LNCR-Calculator` and `LNCR-KODEX`.
   - Preloaded sample combat robot parts (015 Drive Sock assembly, Upright plate assembly, Weapon hub assembly) for instant testing.

---

## 🚀 Quick Start

### Windows 1-Click Launch:
Double-click `run.bat` in this folder. It will start the server and open `http://localhost:8080` in your default browser.

### Manual Launch (Terminal / PowerShell):
```powershell
cd "G:\My Drive\Late Night Combat Robotics\LNCR-StepSplitter"
python app.py
```
Then navigate to: `http://localhost:8080`
