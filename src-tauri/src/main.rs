use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

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

fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should have a parent directory")
        .to_path_buf()
}

fn run_cli(args: &[&str]) -> Result<Value, String> {
    let root = project_root();
    let output = Command::new("node")
        .arg("./src/cli.js")
        .args(args)
        .arg("--json")
        .current_dir(root)
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
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| "Unknown CLI error.".to_string());
        return Err(message);
    }

    Ok(parsed)
}

#[tauri::command]
fn scan() -> Result<ScanResponse, String> {
    let value = run_cli(&["scan"])?;
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
fn run_action(action: String, target: String) -> Result<ActionResponse, String> {
    let args: Vec<&str> = match action.as_str() {
        "setup" => vec!["setup"],
        "doctor" => vec!["doctor"],
        "link" | "unlink" | "restore" => vec![action.as_str(), target.as_str()],
        _ => return Err(format!("Unsupported action: {action}")),
    };

    let value = run_cli(&args)?;
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
fn list_skills(target: String) -> Result<SkillsResponse, String> {
    let args: Vec<&str> = vec!["list-skills", target.as_str()];
    let value = run_cli(&args)?;

    let results = if let Some(array) = value.get("results").and_then(Value::as_array) {
        array.clone()
    } else {
        vec![value]
    };

    Ok(SkillsResponse { results })
}

#[tauri::command]
fn delete_skill(tool: String, skill_name: String) -> Result<ActionResponse, String> {
    let value = run_cli(&["delete-skill", tool.as_str(), skill_name.as_str()])?;
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
    source_tool: String,
    skill_name: String,
    target_tool: String,
    target_name: Option<String>,
) -> Result<ActionResponse, String> {
    let mut args = vec!["copy-skill", source_tool.as_str(), skill_name.as_str(), target_tool.as_str()];
    if let Some(name) = target_name.as_deref() {
        args.push(name);
    }

    let value = run_cli(&args)?;
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
        .invoke_handler(tauri::generate_handler![
            scan,
            run_action,
            list_skills,
            delete_skill,
            copy_skill,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running Skills Manager");
}
