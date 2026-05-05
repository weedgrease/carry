use crate::error::{AppError, AppResult};
use std::path::Path;
use sysinfo::System;

pub fn is_steam_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        let name = p.name().to_string_lossy().to_lowercase();
        name == "steam.exe" || name == "steam"
    })
}

pub fn ensure_steam_not_running() -> AppResult<()> {
    if is_steam_running() { Err(AppError::SteamRunning) } else { Ok(()) }
}

pub fn dir_size(p: &Path) -> u64 {
    let mut total = 0u64;
    for e in walkdir::WalkDir::new(p) {
        if let Ok(e) = e {
            if e.file_type().is_file() {
                if let Ok(md) = e.metadata() { total = total.saturating_add(md.len()); }
            }
        }
    }
    total
}

pub fn ensure_disk_space(target_parent: &Path, need_bytes: u64) -> AppResult<()> {
    let available = available_bytes(target_parent)?;
    let required = need_bytes.saturating_mul(2);
    if available < required {
        return Err(AppError::InsufficientDiskSpace { need: required, have: available });
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn available_bytes(p: &Path) -> AppResult<u64> {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    let mut wide: Vec<u16> = p.as_os_str().encode_wide().collect();
    wide.push(0);
    let mut free: u64 = 0;
    let ok = unsafe {
        GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, ptr::null_mut(), ptr::null_mut())
    };
    if ok == 0 {
        Err(AppError::Io(std::io::Error::last_os_error()))
    } else {
        Ok(free)
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    #[link_name = "GetDiskFreeSpaceExW"]
    fn GetDiskFreeSpaceExW(
        lpDirectoryName: *const u16,
        lpFreeBytesAvailableToCaller: *mut u64,
        lpTotalNumberOfBytes: *mut u64,
        lpTotalNumberOfFreeBytes: *mut u64,
    ) -> i32;
}

#[cfg(not(target_os = "windows"))]
fn available_bytes(_p: &Path) -> AppResult<u64> { Ok(u64::MAX) }

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn dir_size_sums_files() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("a"), b"hello").unwrap();
        std::fs::write(dir.path().join("b"), b"world!").unwrap();
        assert_eq!(dir_size(dir.path()), 11);
    }
}
