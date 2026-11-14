import os
import sys
import shutil
import tempfile
import uuid
import time
import zipfile
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import uvicorn
import gmsh

# Lock to ensure thread safety with Gmsh OpenCASCADE global state
gmsh_lock = threading.Lock()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
TEMP_WORKSPACE = Path(tempfile.gettempdir()) / "lncr_step_splitter"
TEMP_WORKSPACE.mkdir(parents=True, exist_ok=True)

# In-memory store for active sessions
# session_id -> { "source_name": str, "file_path": str, "bodies": list[dict], "created_at": float }
active_sessions: Dict[str, Dict[str, Any]] = {}

# Combat Robotics Material Densities (g/cm^3)
DENSITIES: Dict[str, Dict[str, Any]] = {
    "al_6061": {"name": "6061-T6 Aluminum", "density": 2.70, "category": "Metal"},
    "al_7075": {"name": "7075-T6 Aluminum", "density": 2.81, "category": "Metal"},
    "ti_gr5": {"name": "Grade 5 Titanium (Ti-6Al-4V)", "density": 4.43, "category": "Metal"},
    "ar500": {"name": "AR500 / Hardox Steel", "density": 7.85, "category": "Armor"},
    "ar400": {"name": "AR400 Wear Plate", "density": 7.85, "category": "Armor"},
    "s7_tool": {"name": "S7 Shock Steel", "density": 7.83, "category": "Weapon Steel"},
    "steel_4140": {"name": "4140 Chromoly Steel", "density": 7.85, "category": "Shaft/Hub"},
    "tpu_95a": {"name": "TPU 95A (3D Printed)", "density": 1.21, "category": "Polymer"},
    "uhmw": {"name": "UHMW-PE", "density": 0.94, "category": "Polymer"},
    "pc": {"name": "Polycarbonate (Lexan)", "density": 1.20, "category": "Polymer"},
    "carbon_fiber": {"name": "Carbon Fiber Plate (3K/UD)", "density": 1.55, "category": "Composite"},
    "delrin": {"name": "Delrin / Acetal (POM)", "density": 1.42, "category": "Polymer"},
    "pla_plus": {"name": "PLA+ (3D Printed)", "density": 1.24, "category": "3D Print"},
    "petg": {"name": "PETG (3D Printed)", "density": 1.27, "category": "3D Print"},
    "nylon_cf": {"name": "Nylon CF15 (3D Printed)", "density": 1.15, "category": "3D Print"}
}

# Combat Robotics Weight Classes in Grams
WEIGHT_CLASSES = {
    "Fairyweight (150g)": 150.0,
    "Antweight (1 lb / 454g)": 453.592,
    "Beetleweight (3 lb / 1361g)": 1360.78,
    "Hobbyweight (12 lb / 5.44kg)": 5443.11,
    "Featherweight (30 lb / 13.6kg)": 13607.8,
    "Heavyweight (250 lb / 113.4kg)": 113398.0
}

app = FastAPI(
    title="LNCR STEP Splitter",
    description="Multi-body STEP Decomposer and CAD Telemetry Suite for Late Night Combat Robotics",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def calculate_masses(volume_mm3: float) -> Dict[str, Any]:
    """Calculate masses in grams and ounces for all supported combat materials."""
    vol_cm3 = volume_mm3 / 1000.0
    results = {}
    for mat_id, mat_info in DENSITIES.items():
        mass_g = vol_cm3 * mat_info["density"]
        mass_oz = mass_g / 28.3495
        mass_lb = mass_g / 453.592
        results[mat_id] = {
            "name": mat_info["name"],
            "density": mat_info["density"],
            "category": mat_info["category"],
            "mass_g": round(mass_g, 2),
            "mass_oz": round(mass_oz, 2),
            "mass_lb": round(mass_lb, 3)
        }
    return results


def process_step_file(file_path: Path, original_filename: str) -> Dict[str, Any]:
    """Parse, split, and generate meshes for all bodies in the STEP file."""
    session_id = str(uuid.uuid4())
    session_dir = TEMP_WORKSPACE / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    bodies_info = []
    
    with gmsh_lock:
        gmsh.initialize(interruptible=False)
        gmsh.option.setNumber("General.Verbosity", 1)  # Quiet
        
        # Load master to discover all shapes
        gmsh.model.add("master")
        try:
            gmsh.model.occ.importShapes(str(file_path))
            gmsh.model.occ.synchronize()
        except Exception as e:
            gmsh.finalize()
            raise HTTPException(status_code=400, detail=f"Failed to read STEP file: {str(e)}")
            
        # Discover volume entities (Solids / Bodies)
        vols = gmsh.model.getEntities(3)
        
        # If no 3D solids found, check for 2D surface bodies (e.g. sheet metal shells)
        dim = 3
        if not vols:
            vols = gmsh.model.getEntities(2)
            dim = 2
            
        if not vols:
            gmsh.finalize()
            raise HTTPException(status_code=400, detail="No 3D solid bodies or surface bodies found in STEP file.")
            
        tags = [tag for _, tag in vols]
        
        # Extract initial properties for each body
        for idx, tag in enumerate(tags):
            try:
                raw_name = gmsh.model.getEntityName(dim, tag)
            except Exception:
                raw_name = ""
                
            clean_name = raw_name.replace("Shapes/", "").strip() if raw_name else ""
            if not clean_name:
                stem = Path(original_filename).stem
                clean_name = f"{stem}_Body_{idx + 1}"
                
            try:
                vol_mm3 = abs(gmsh.model.occ.getMass(dim, tag))
            except Exception:
                vol_mm3 = 0.0
                
            try:
                bbox = gmsh.model.occ.getBoundingBox(dim, tag)
                dx = abs(bbox[3] - bbox[0])
                dy = abs(bbox[4] - bbox[1])
                dz = abs(bbox[5] - bbox[2])
                cx = (bbox[0] + bbox[3]) / 2.0
                cy = (bbox[1] + bbox[4]) / 2.0
                cz = (bbox[2] + bbox[5]) / 2.0
            except Exception:
                bbox = [0, 0, 0, 0, 0, 0]
                dx, dy, dz = 0, 0, 0
                cx, cy, cz = 0, 0, 0
                
            bodies_info.append({
                "index": idx + 1,
                "tag": tag,
                "dim": dim,
                "name": clean_name,
                "volume_mm3": round(vol_mm3, 2),
                "volume_cm3": round(vol_mm3 / 1000.0, 3),
                "bbox": [round(v, 3) for v in bbox],
                "dimensions_mm": {
                    "dx": round(dx, 2),
                    "dy": round(dy, 2),
                    "dz": round(dz, 2)
                },
                "dimensions_in": {
                    "dx": round(dx / 25.4, 3),
                    "dy": round(dy / 25.4, 3),
                    "dz": round(dz / 25.4, 3)
                },
                "center_of_mass": {
                    "x": round(cx, 2),
                    "y": round(cy, 2),
                    "z": round(cz, 2)
                },
                "masses": calculate_masses(vol_mm3)
            })
            
        gmsh.finalize()
        
        # Now, for each body, export its individual STEP file and STL preview mesh
        for item in bodies_info:
            target_tag = item["tag"]
            idx = item["index"]
            
            gmsh.initialize(interruptible=False)
            gmsh.option.setNumber("General.Verbosity", 1)
            gmsh.model.add(f"export_b{idx}")
            gmsh.model.occ.importShapes(str(file_path))
            gmsh.model.occ.synchronize()
            
            # Remove all other bodies
            current_vols = [t for _, t in gmsh.model.getEntities(dim)]
            other_vols = [(dim, t) for t in current_vols if t != target_tag]
            if other_vols:
                gmsh.model.occ.remove(other_vols, recursive=True)
                gmsh.model.occ.synchronize()
                
            step_file_name = f"body_{idx}.step"
            stl_file_name = f"body_{idx}.stl"
            step_file_path = session_dir / step_file_name
            stl_file_path = session_dir / stl_file_name
            
            # Write individual STEP
            gmsh.write(str(step_file_path))
            
            # Generate 2D surface triangulation mesh for 3D web viewer
            try:
                gmsh.option.setNumber("Mesh.MeshSizeMin", max(0.5, min(item["dimensions_mm"]["dx"], item["dimensions_mm"]["dy"], item["dimensions_mm"]["dz"]) * 0.05))
                gmsh.option.setNumber("Mesh.MeshSizeMax", max(2.0, max(item["dimensions_mm"]["dx"], item["dimensions_mm"]["dy"], item["dimensions_mm"]["dz"]) * 0.25))
                gmsh.option.setNumber("Mesh.Algorithm", 6)
                gmsh.model.mesh.generate(2)
                gmsh.write(str(stl_file_path))
                item["has_mesh"] = True
            except Exception as e:
                print(f"Warning: Mesh generation failed for body {idx}: {e}")
                item["has_mesh"] = False
                
            gmsh.finalize()
            
            item["step_path"] = str(step_file_path)
            item["stl_path"] = str(stl_file_path)
            
    # Calculate total assembly volume and mass
    total_vol_mm3 = sum(b["volume_mm3"] for b in bodies_info)
    assembly_summary = {
        "body_count": len(bodies_info),
        "total_volume_mm3": round(total_vol_mm3, 2),
        "total_volume_cm3": round(total_vol_mm3 / 1000.0, 3),
        "total_masses": calculate_masses(total_vol_mm3)
    }
    
    session_data = {
        "session_id": session_id,
        "source_name": original_filename,
        "session_dir": str(session_dir),
        "bodies": bodies_info,
        "summary": assembly_summary,
        "created_at": time.time()
    }
    
    active_sessions[session_id] = session_data
    return session_data


@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    """Render main web application interface."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "title": "LNCR STEP Splitter | Late Night Combat Robotics",
            "materials": DENSITIES,
            "weight_classes": WEIGHT_CLASSES
        }
    )


@app.get("/api/materials")
async def get_materials():
    """Return dictionary of combat robotics materials and densities."""
    return {"materials": DENSITIES, "weight_classes": WEIGHT_CLASSES}


@app.post("/api/upload")
async def upload_step_file(file: UploadFile = File(...)):
    """Upload and decompose a multi-body STEP file."""
    filename = file.filename or "model.step"
    ext = Path(filename).suffix.lower()
    if ext not in [".step", ".stp"]:
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .step or .stp CAD file.")
        
    # Save uploaded file to temp workspace
    upload_id = str(uuid.uuid4())
    upload_path = TEMP_WORKSPACE / f"upload_{upload_id}_{filename}"
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        session_data = process_step_file(upload_path, filename)
        
        # Return cleaned response
        clean_bodies = []
        for b in session_data["bodies"]:
            b_copy = {k: v for k, v in b.items() if k not in ["step_path", "stl_path"]}
            clean_bodies.append(b_copy)
            
        return {
            "success": True,
            "session_id": session_data["session_id"],
            "source_name": session_data["source_name"],
            "bodies": clean_bodies,
            "summary": session_data["summary"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if upload_path.exists():
            try:
                upload_path.unlink()
            except Exception:
                pass


@app.get("/api/mesh/{session_id}/{body_index}")
async def get_body_mesh(session_id: str, body_index: int):
    """Serve the 3D STL mesh for Three.js viewer."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found.")
        
    session = active_sessions[session_id]
    bodies = session["bodies"]
    body = next((b for b in bodies if b["index"] == body_index), None)
    if not body or not body.get("has_mesh"):
        raise HTTPException(status_code=404, detail="Mesh not found for this body.")
        
    mesh_path = Path(body["stl_path"])
    if not mesh_path.exists():
        raise HTTPException(status_code=404, detail="Mesh file missing on server.")
        
    return FileResponse(
        path=mesh_path,
        media_type="model/stl",
        filename=f"body_{body_index}.stl"
    )


@app.post("/api/rename/{session_id}")
async def rename_bodies(session_id: str, payload: Dict[str, Any]):
    """Update custom names for bodies."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    names_map = payload.get("names", {})  # str(index) -> new_name
    session = active_sessions[session_id]
    for body in session["bodies"]:
        idx_str = str(body["index"])
        if idx_str in names_map and names_map[idx_str].strip():
            body["name"] = names_map[idx_str].strip()
            
    return {"success": True, "bodies": [{ "index": b["index"], "name": b["name"] } for b in session["bodies"]]}


@app.get("/api/download/{session_id}/{body_index}")
async def download_single_body(
    session_id: str, 
    body_index: int,
    center_origin: bool = Query(False, description="Translate body so center is at (0,0, Z_min=0)"),
    custom_name: Optional[str] = Query(None)
):
    """Download an individual body as a STEP file."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found.")
        
    session = active_sessions[session_id]
    bodies = session["bodies"]
    body = next((b for b in bodies if b["index"] == body_index), None)
    if not body:
        raise HTTPException(status_code=404, detail="Body index not found.")
        
    step_file = Path(body["step_path"])
    if not step_file.exists():
        raise HTTPException(status_code=404, detail="STEP file missing on server.")
        
    export_name = custom_name or body.get("name") or f"Body_{body_index}"
    # Sanitize filename
    clean_filename = "".join(c for c in export_name if c.isalnum() or c in ("-", "_", " ", ".")).strip()
    if not clean_filename.lower().endswith(".step") and not clean_filename.lower().endswith(".stp"):
        clean_filename += ".step"

    # If center_origin requested, transform shape before sending
    if center_origin:
        grounded_path = Path(session["session_dir"]) / f"grounded_b{body_index}.step"
        with gmsh_lock:
            gmsh.initialize(interruptible=False)
            gmsh.option.setNumber("General.Verbosity", 1)
            gmsh.model.add("grounding")
            gmsh.model.occ.importShapes(str(step_file))
            gmsh.model.occ.synchronize()
            
            bbox = body["bbox"]
            cx = (bbox[0] + bbox[3]) / 2.0
            cy = (bbox[1] + bbox[4]) / 2.0
            cz_min = bbox[2]
            
            # Translate so center is at (0, 0) and bottom is at Z=0
            entities = gmsh.model.getEntities(body.get("dim", 3))
            gmsh.model.occ.translate(entities, -cx, -cy, -cz_min)
            gmsh.model.occ.synchronize()
            gmsh.write(str(grounded_path))
            gmsh.finalize()
            
        return FileResponse(
            path=grounded_path,
            media_type="application/step",
            filename=clean_filename
        )

    return FileResponse(
        path=step_file,
        media_type="application/step",
        filename=clean_filename
    )


@app.get("/api/download-all/{session_id}")
async def download_all_bodies(
    session_id: str,
    selected_indices: Optional[str] = Query(None, description="Comma-separated body indices to include"),
    center_origin: bool = Query(False)
):
    """Package individual bodies into a zip file with engineering manifest."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found.")
        
    session = active_sessions[session_id]
    bodies = session["bodies"]
    
    # Filter bodies if selection provided
    if selected_indices:
        try:
            chosen = set(int(x.strip()) for x in selected_indices.split(",") if x.strip())
            export_bodies = [b for b in bodies if b["index"] in chosen]
        except Exception:
            export_bodies = bodies
    else:
        export_bodies = bodies

    if not export_bodies:
        raise HTTPException(status_code=400, detail="No bodies selected for download.")

    zip_path = Path(session["session_dir"]) / "lncr_bodies_export.zip"
    
    # Build engineering manifest text
    manifest_lines = [
        "==================================================================",
        "   LATE NIGHT COMBAT ROBOTICS - MULTI-BODY STEP SPLITTER MANIFEST",
        "==================================================================",
        f"Original Assembly: {session['source_name']}",
        f"Export Timestamp : {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        f"Total Bodies     : {len(export_bodies)} of {len(bodies)}",
        f"Total Volume     : {session['summary']['total_volume_mm3']:.2f} mm^3 ({session['summary']['total_volume_cm3']:.3f} cm^3)",
        "",
        "--- BODY DETAILS & TELEMETRY ---"
    ]
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for b in export_bodies:
            idx = b["index"]
            name = b.get("name", f"Body_{idx}")
            safe_name = "".join(c for c in name if c.isalnum() or c in ("-", "_", " ")).strip()
            if not safe_name:
                safe_name = f"Body_{idx}"
            target_filename = f"{idx:02d}_{safe_name}.step"
            
            step_file = Path(b["step_path"])
            if center_origin:
                # Ground to origin
                temp_step = Path(session["session_dir"]) / f"zip_grounded_{idx}.step"
                with gmsh_lock:
                    gmsh.initialize(interruptible=False)
                    gmsh.option.setNumber("General.Verbosity", 1)
                    gmsh.model.add(f"g_{idx}")
                    gmsh.model.occ.importShapes(str(step_file))
                    gmsh.model.occ.synchronize()
                    bbox = b["bbox"]
                    cx = (bbox[0] + bbox[3]) / 2.0
                    cy = (bbox[1] + bbox[4]) / 2.0
                    cz_min = bbox[2]
                    entities = gmsh.model.getEntities(b.get("dim", 3))
                    gmsh.model.occ.translate(entities, -cx, -cy, -cz_min)
                    gmsh.model.occ.synchronize()
                    gmsh.write(str(temp_step))
                    gmsh.finalize()
                zipf.write(temp_step, arcname=target_filename)
                if temp_step.exists():
                    temp_step.unlink()
            else:
                zipf.write(step_file, arcname=target_filename)
                
            manifest_lines.extend([
                f"Body #{idx}: {name}",
                f"  STEP File       : {target_filename}",
                f"  Volume          : {b['volume_mm3']:.2f} mm^3 ({b['volume_cm3']:.3f} cm^3)",
                f"  Dimensions (mm) : {b['dimensions_mm']['dx']} x {b['dimensions_mm']['dy']} x {b['dimensions_mm']['dz']} mm",
                f"  Dimensions (in) : {b['dimensions_in']['dx']} x {b['dimensions_in']['dy']} x {b['dimensions_in']['dz']} in",
                f"  Center of Mass  : X={b['center_of_mass']['x']}, Y={b['center_of_mass']['y']}, Z={b['center_of_mass']['z']}",
                "  Combat Mass Estimates:",
                f"    - 6061-T6 Aluminum : {b['masses']['al_6061']['mass_g']}g ({b['masses']['al_6061']['mass_oz']} oz)",
                f"    - Ti-6Al-4V Grade 5: {b['masses']['ti_gr5']['mass_g']}g ({b['masses']['ti_gr5']['mass_oz']} oz)",
                f"    - AR500 Armor Steel: {b['masses']['ar500']['mass_g']}g ({b['masses']['ar500']['mass_oz']} oz)",
                f"    - TPU 95A (Printed): {b['masses']['tpu_95a']['mass_g']}g ({b['masses']['tpu_95a']['mass_oz']} oz)",
                f"    - UHMW-PE Plastic  : {b['masses']['uhmw']['mass_g']}g ({b['masses']['uhmw']['mass_oz']} oz)",
                f"    - Carbon Fiber 3K  : {b['masses']['carbon_fiber']['mass_g']}g ({b['masses']['carbon_fiber']['mass_oz']} oz)",
                ""
            ])
            
        manifest_lines.append("==================================================================")
        manifest_lines.append("Generated by LNCR STEP Splitter | Late Night Combat Robotics")
        manifest_lines.append("Website: https://www.latenightcombat.com")
        zipf.writestr("LNCR_STEP_MANIFEST.txt", "\n".join(manifest_lines))
        
    safe_stem = Path(session["source_name"]).stem
    out_zip_name = f"{safe_stem}_Split_Bodies_LNCR.zip"
    
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=out_zip_name
    )


if __name__ == "__main__":
    # Support custom port via env or default 8080
    port = int(os.environ.get("PORT", 8080))
    print(f"============================================================")
    print(f"  Late Night Combat Robotics - Multi-Body STEP Splitter")
    print(f"  Running on: http://localhost:{port}")
    print(f"============================================================")
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)
