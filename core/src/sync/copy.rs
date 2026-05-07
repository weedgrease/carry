//! Two-phase directory copy with rollback (stage to `.tmp_<uuid>`, then swap).

use crate::error::{AppError, AppResult};
use std::path::Path;
use uuid::Uuid;
use walkdir::WalkDir;

/// Recursively copy `src` into `dst`, preserving the directory shape.
pub fn copy_tree(src: &Path, dst: &Path) -> AppResult<()> {
    if !src.is_dir() { return Err(AppError::PathMissing(src.to_path_buf())); }
    std::fs::create_dir_all(dst)?;
    for entry in WalkDir::new(src) {
        let entry = entry.map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        let rel = entry.path().strip_prefix(src)
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() { std::fs::create_dir_all(parent)?; }
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Atomically swap `target` for `new_contents` via rename, with rollback if
/// the rename fails after the original was moved aside.
pub fn replace_directory(target: &Path, new_contents: &Path) -> AppResult<()> {
    let backup = target.with_extension(format!("old_{}", Uuid::new_v4()));
    let target_existed = target.exists();
    if target_existed { std::fs::rename(target, &backup)?; }
    if let Err(e) = std::fs::rename(new_contents, target) {
        if target_existed { let _ = std::fs::rename(&backup, target); }
        return Err(AppError::Io(e));
    }
    if target_existed { let _ = std::fs::remove_dir_all(&backup); }
    Ok(())
}

/// Stage the new tree next to `target` then atomically swap it in.
pub struct TwoPhaseCopy<'a> {
    pub src: &'a Path,
    pub target: &'a Path,
}

impl<'a> TwoPhaseCopy<'a> {
    /// Run the copy. On any failure the staged tree is removed and the
    /// original `target` is left in place.
    pub fn execute(&self) -> AppResult<()> {
        let parent = self.target.parent()
            .ok_or_else(|| AppError::PathMissing(self.target.to_path_buf()))?;
        std::fs::create_dir_all(parent)?;
        let temp_name = format!("{}.tmp_{}",
            self.target.file_name().and_then(|s| s.to_str()).unwrap_or("copy"),
            Uuid::new_v4());
        let temp = parent.join(temp_name);

        if let Err(e) = copy_tree(self.src, &temp) {
            let _ = std::fs::remove_dir_all(&temp);
            return Err(e);
        }
        if let Err(e) = replace_directory(self.target, &temp) {
            let _ = std::fs::remove_dir_all(&temp);
            return Err(e);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn read(p: &Path) -> String { std::fs::read_to_string(p).unwrap() }

    #[test]
    fn two_phase_replaces_existing_target() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("file.txt"), "new").unwrap();
        let target = dir.path().join("target");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("file.txt"), "old").unwrap();

        TwoPhaseCopy { src: &src, target: &target }.execute().unwrap();
        assert_eq!(read(&target.join("file.txt")), "new");
    }

    #[test]
    fn copy_tree_preserves_subdirs() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        std::fs::create_dir_all(src.join("a/b")).unwrap();
        std::fs::write(src.join("a/b/c.txt"), "deep").unwrap();
        let dst = dir.path().join("dst");
        copy_tree(&src, &dst).unwrap();
        assert_eq!(read(&dst.join("a/b/c.txt")), "deep");
    }
}
