use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

#[derive(Serialize)]
struct ScanResponse {
    #[serde(rename = "iCloudRoot")]
    i_cloud_root: String,
    results: Vec<Value>,
}

#[derive(Serialize)]
struct ActionResponse {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    issues: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    results: Option<Vec<Value>>,
}

#[derive(Serialize)]
struct SkillsResponse {
    results: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunActionInput {
    action: String,
    target: String,
    #[serde(default)]
    link_copy: Option<bool>,
}

struct WatchState {
    path: Option<String>,
    _watcher: Option<RecommendedWatcher>,
}

impl Default for WatchState {
    fn default() -> Self {
        Self {
            path: None,
            _watcher: None,
        }
    }
}

fn dev_cli_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should have a parent directory")
        .join("src")
}

fn resolve_cli_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(res_dir) = app.path().resource_dir() {
        let bundled = res_dir.join("cli");
        if bundled.join("cli.js").is_file() {
            return Ok(bundled);
        }
    }

    let dev = dev_cli_dir();
    if dev.join("cli.js").is_file() {
        return Ok(dev);
    }

    Err(
        "Could not find CLI (cli.js). Run from the project checkout, or reinstall the app bundle."
            .to_string(),
    )
}

fn run_cli(app: &AppHandle, args: &[&str]) -> Result<Value, String> {
    let cli_dir = resolve_cli_dir(app)?;
    let cli_js = cli_dir.join("cli.js");
    let output = Command::new("node")
        .arg(cli_js.as_os_str())
        .args(args.iter().map(|s| OsStr::new(*s)))
        .arg("--json")
        .current_dir(&cli_dir)
        .output()
        .map_err(|error| format!("Failed to launch Node CLI: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() {
        return Err(if stderr.is_empty() {
            "CLI returned no output.".to_string()
        } else {
            stderr
        });
    }

    let parsed: Value =
        serde_json::from_str(&stdout).map_err(|error| format!("Invalid CLI JSON: {error}"))?;

    let ok = parsed
        .get("ok")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if !ok {
        let message = parsed
            .get("error")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| "Unknown CLI error.".to_string());
        return Err(message);
    }

    Ok(parsed)
}

/// Watch the current skills root for changes and emit `skills-refresh` so the UI can reload the list.
/// FSEvents may fire in bursts; debounce is applied before emitting. Does not "sync" to iCloud — with a normal `link` symlink, writes already live under the iCloud Drive folder; this only refreshes the in-app list.
#[tauri::command]
fn set_skills_watch(
    app: AppHandle,
    state: tauri::State<'_, Mutex<WatchState>>,
    path: Option<String>,
) -> Result<(), String> {
    let path_norm = path
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty() && p != "—");

    let mut guard = state.lock().map_err(|e| e.to_string())?;

    if guard.path == path_norm && (path_norm.is_none() == guard._watcher.is_none()) {
        return Ok(());
    }

    guard._watcher = None;
    guard.path = path_norm.clone();

    let Some(p_str) = path_norm else {
        return Ok(());
    };

    let pbuf = PathBuf::from(&p_str);
    if !pbuf.is_dir() {
        return Ok(());
    }

    let app2 = app.clone();
    let last_emit = Mutex::new(Instant::now() - Duration::from_secs(60));

    let mut w = RecommendedWatcher::new(
        move |res: std::result::Result<Event, notify::Error>| {
            if res.is_err() {
                return;
            }
            let mut last = match last_emit.lock() {
                Ok(m) => m,
                Err(_) => return,
            };
            let now = Instant::now();
            if now.saturating_duration_since(*last) < Duration::from_millis(800) {
                return;
            }
            *last = now;
            drop(last);
            let _ = app2.emit("skills-refresh", ());
        },
        Config::default(),
    )
    .map_err(|e| format!("Watcher init failed: {e}"))?;

    w.watch(Path::new(&p_str), RecursiveMode::Recursive)
        .map_err(|e| format!("Watcher watch failed: {e}"))?;
    guard._watcher = Some(w);

    Ok(())
}

#[tauri::command]
fn scan(app: AppHandle) -> Result<ScanResponse, String> {
    let value = run_cli(&app, &["scan"])?;
    let root = value
        .get("iCloudRoot")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    Ok(ScanResponse {
        i_cloud_root: root,
        results,
    })
}

#[tauri::command]
fn run_action(app: AppHandle, input: RunActionInput) -> Result<ActionResponse, String> {
    let mut args: Vec<String> = match input.action.as_str() {
        "setup" => vec!["setup".to_string()],
        "doctor" => vec!["doctor".to_string()],
        "restore-machine" => vec!["restore-machine".to_string()],
        "init-config" => vec!["init-config".to_string()],
        "link" => {
            let mut v = vec!["link".to_string(), input.target.clone()];
            if input.link_copy == Some(true) {
                v.push("--copy".to_string());
            }
            v
        }
        "unlink" | "restore" => vec![input.action.clone(), input.target.clone()],
        _ => return Err(format!("Unsupported action: {}", input.action)),
    };

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let value = run_cli(&app, &arg_refs)?;
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Completed action.")
        .to_string();
    let issues = value
        .get("issues")
        .and_then(Value::as_array)
        .cloned();
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .cloned();

    Ok(ActionResponse {
        message,
        issues,
        results,
    })
}

#[tauri::command]
fn list_skills(app: AppHandle, target: String) -> Result<SkillsResponse, String> {
    let args: Vec<&str> = vec!["list-skills", target.as_str()];
    let value = run_cli(&app, &args)?;

    let results = if let Some(array) = value.get("results").and_then(Value::as_array) {
        array.clone()
    } else {
        vec![value]
    };

    Ok(SkillsResponse { results })
}

#[tauri::command]
fn delete_skill(app: AppHandle, tool: String, skill_name: String) -> Result<ActionResponse, String> {
    let value = run_cli(&app, &["delete-skill", tool.as_str(), skill_name.as_str()])?;
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Deleted skill.")
        .to_string();

    Ok(ActionResponse {
        message,
        issues: None,
        results: None,
    })
}

#[tauri::command]
fn copy_skill(
    app: AppHandle,
    source_tool: String,
    skill_name: String,
    target_tool: String,
    target_name: Option<String>,
) -> Result<ActionResponse, String> {
    let mut owned = vec![
        "copy-skill".to_string(),
        source_tool,
        skill_name,
        target_tool,
    ];
    if let Some(name) = target_name {
        owned.push(name);
    }
    let arg_refs: Vec<&str> = owned.iter().map(String::as_str).collect();
    let value = run_cli(&app, &arg_refs)?;
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Copied skill.")
        .to_string();

    Ok(ActionResponse {
        message,
        issues: None,
        results: None,
    })
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<ActionResponse, String> {
    let status = Command::new("open")
        .arg("-R")
        .arg(path.as_str())
        .status()
        .map_err(|error| format!("Failed to open Finder: {error}"))?;

    if !status.success() {
        return Err("Finder reveal command failed.".to_string());
    }

    Ok(ActionResponse {
        message: format!("Opened Finder for {path}"),
        issues: None,
        results: None,
    })
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(WatchState::default()))
        .invoke_handler(tauri::generate_handler![
            scan,
            run_action,
            list_skills,
            delete_skill,
            copy_skill,
            reveal_in_finder,
            set_skills_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running Esay Cloud Skills");
}
