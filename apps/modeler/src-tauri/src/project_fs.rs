//! Project folder I/O for MinsDBModeler.
//!
//! A project is a plain folder (normally a Git repository). The frontend reads the whole
//! managed tree as `{ relative path: text }`, and writes back only the files that changed.
//! Only paths inside the managed areas can be written or deleted, and `..`/absolute paths
//! are rejected, so a bad request can never touch anything outside the project folder.

use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri_plugin_dialog::DialogExt;

/// Marker file that identifies a project folder.
const MARKER: &str = "minsmodeler.yaml";
/// Folders whose files belong to the project model.
const MANAGED_DIRS: &[&str] = &["model", "conceptual", "diagrams", "standards", "physical", "output"];
/// Text formats the app reads.
const TEXT_EXT: &[&str] = &["yaml", "yml", "sql", "ddl", "md", "txt", "json", "xml"];

fn is_managed(rel: &str) -> bool {
    rel == MARKER || MANAGED_DIRS.iter().any(|d| rel.starts_with(&format!("{d}/")))
}

/// Resolves `rel` inside `root`, refusing anything that could escape it.
fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let p = Path::new(rel);
    let ok = !rel.is_empty() && p.components().all(|c| matches!(c, Component::Normal(_)));
    if !ok || !is_managed(rel) {
        return Err(format!("허용되지 않은 경로입니다: {rel}"));
    }
    Ok(root.join(p))
}

fn walk(root: &Path, dir: &Path, out: &mut HashMap<String, String>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        if path.is_dir() {
            walk(root, &path, out)?;
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if !TEXT_EXT.contains(&ext.as_str()) {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        if !is_managed(&rel) {
            continue;
        }
        if let Ok(text) = fs::read_to_string(&path) {
            out.insert(rel, text);
        }
    }
    Ok(())
}

/// Reads every managed text file of the project at `root`.
#[tauri::command]
pub fn read_project_files(root: String) -> Result<HashMap<String, String>, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return Err(format!("폴더를 찾을 수 없습니다: {}", root.display()));
    }
    let mut out = HashMap::new();
    if let Ok(text) = fs::read_to_string(root.join(MARKER)) {
        out.insert(MARKER.to_string(), text);
    }
    for dir in MANAGED_DIRS {
        let d = root.join(dir);
        if d.is_dir() {
            walk(&root, &d, &mut out).map_err(|e| format!("{}: {e}", d.display()))?;
        }
    }
    Ok(out)
}

/// Writes changed files and deletes removed ones (both limited to the managed areas).
#[tauri::command]
pub fn write_project_files(root: String, writes: HashMap<String, String>, deletes: Vec<String>) -> Result<(), String> {
    let root = PathBuf::from(root);
    fs::create_dir_all(&root).map_err(|e| format!("{}: {e}", root.display()))?;
    for (rel, content) in &writes {
        let path = resolve(&root, rel)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
        }
        fs::write(&path, content).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    for rel in &deletes {
        let path = resolve(&root, rel)?;
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        }
    }
    Ok(())
}

/// `"missing" | "empty" | "project" | "other"` — lets the UI validate a chosen location.
#[tauri::command]
pub fn inspect_folder(path: String) -> String {
    let p = PathBuf::from(path);
    if !p.exists() {
        return "missing".into();
    }
    if !p.is_dir() {
        return "other".into();
    }
    if p.join(MARKER).is_file() {
        return "project".into();
    }
    match fs::read_dir(&p) {
        Ok(mut it) => {
            if it.next().is_none() {
                "empty".into()
            } else {
                "other".into()
            }
        }
        Err(_) => "other".into(),
    }
}

/// Native folder picker. Returns `None` when the user cancels.
#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle, title: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    if let Some(t) = title {
        dialog = dialog.set_title(t);
    }
    Ok(dialog
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_paths_outside_managed_areas() {
        let root = Path::new("/tmp/proj");
        assert!(resolve(root, "model/entities/a.yaml").is_ok());
        assert!(resolve(root, MARKER).is_ok());
        assert!(resolve(root, "../evil.yaml").is_err());
        assert!(resolve(root, "model/../../evil.yaml").is_err());
        assert!(resolve(root, "/etc/passwd").is_err());
        assert!(resolve(root, "src/main.rs").is_err());
        assert!(resolve(root, "").is_err());
    }

    #[test]
    fn round_trips_files() {
        let dir = std::env::temp_dir().join(format!("mins_fs_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let root = dir.to_string_lossy().to_string();
        let mut writes = HashMap::new();
        writes.insert(MARKER.to_string(), "name: t\n".to_string());
        writes.insert("model/entities/e1.yaml".to_string(), "id: e1\n".to_string());
        writes.insert("diagrams/d.yaml".to_string(), "id: d\n".to_string());
        write_project_files(root.clone(), writes, vec![]).unwrap();
        fs::write(dir.join("notes.txt"), "not managed").unwrap();

        let read = read_project_files(root.clone()).unwrap();
        assert_eq!(read.len(), 3);
        assert_eq!(read["model/entities/e1.yaml"], "id: e1\n");
        assert_eq!(inspect_folder(root.clone()), "project");

        write_project_files(root.clone(), HashMap::new(), vec!["diagrams/d.yaml".into()]).unwrap();
        assert!(!dir.join("diagrams/d.yaml").exists());
        assert!(write_project_files(root.clone(), HashMap::new(), vec!["notes.txt".into()]).is_err());
        assert!(dir.join("notes.txt").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
