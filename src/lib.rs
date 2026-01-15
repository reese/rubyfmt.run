use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Format Ruby source code.
/// Takes a null-terminated C string and returns a newly allocated C string.
/// The caller must free the returned string using `free_string`.
///
/// # Safety
/// `source` must be a valid pointer to a null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn format(source: *const c_char) -> *mut c_char {
    if source.is_null() {
        return std::ptr::null_mut();
    }

    let source_str = unsafe {
        match CStr::from_ptr(source).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        }
    };

    match rubyfmt::format_buffer(source_str) {
        Ok(formatted) => match CString::new(formatted) {
            Ok(c_str) => c_str.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a string that was returned by `format`.
///
/// # Safety
/// `s` must be a pointer that was returned by `format`, or null.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() {
        drop(unsafe { CString::from_raw(s) });
    }
}
