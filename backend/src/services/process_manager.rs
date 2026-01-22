use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use std::fs;
use tracing::{info, warn};
use serde_json::Value;

use crate::error::AppError;

/// Manages game server processes
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, ServerProcess>>>,
}

struct ServerProcess {
    child: Child,
    log_tx: broadcast::Sender<String>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn is_running(&self, server_id: &str) -> bool {
        // We need a blocking check here, but for simplicity we'll use try_read
        if let Ok(processes) = self.processes.try_read() {
            processes.contains_key(server_id)
        } else {
            false
        }
    }

    pub fn subscribe_logs(&self, server_id: &str) -> broadcast::Receiver<String> {
        let (_tx, rx) = broadcast::channel(1000);
        // If server exists, return its receiver; otherwise return empty receiver
        if let Ok(processes) = self.processes.try_read() {
            if let Some(proc) = processes.get(server_id) {
                return proc.log_tx.subscribe();
            }
        }
        rx
    }

    pub async fn start(
        &self,
        server_id: &str,
        executable_path: &str,
        working_dir: &str,
        java_path: Option<&str>,
        min_memory: Option<&str>,
        max_memory: Option<&str>,
        extra_args: Option<&str>,
        config: Option<&serde_json::Value>,
    ) -> Result<(), AppError> {
        let mut processes = self.processes.write().await;

        if processes.contains_key(server_id) {
            return Err(AppError::BadRequest("Server already running".into()));
        }

        // Build command based on game type (Hytale uses Java)
        let java = java_path.unwrap_or("java");
        let min_mem = min_memory.unwrap_or("4G");
        let max_mem = max_memory.unwrap_or("8G");

        // Generate configuration files if config provided
        if let Some(config) = config {
            self.generate_server_properties(working_dir, config).map_err(|e| AppError::Internal(format!("Failed to generate server.properties: {}", e)))?;
            self.generate_world_config(working_dir, config).map_err(|e| AppError::Internal(format!("Failed to generate world-config.json: {}", e)))?;
        }

        let mut cmd = Command::new(java);
        cmd.current_dir(working_dir)
            .arg(format!("-Xms{}", min_mem))
            .arg(format!("-Xmx{}", max_mem))
            .arg("-XX:AOTCache=HytaleServer.aot")
            .arg("-jar")
            .arg(executable_path)
            .arg("--assets")
            .arg("Assets.zip") // TODO: make dynamic based on config?
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(args) = extra_args {
            for arg in args.split_whitespace() {
                cmd.arg(arg);
            }
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to start server: {}", e)))?;

        info!("Started server {} with PID {:?}", server_id, child.id());

        // Create log broadcaster
        let (log_tx, _) = broadcast::channel::<String>(1000);

        // Spawn task to read stdout
        if let Some(stdout) = child.stdout.take() {
            let tx = log_tx.clone();
            let server_id_clone = server_id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = tx.send(line);
                }
                info!("Server {} stdout stream ended", server_id_clone);
            });
        }

        // Spawn task to read stderr
        if let Some(stderr) = child.stderr.take() {
            let tx = log_tx.clone();
            let server_id_clone = server_id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = tx.send(format!("[STDERR] {}", line));
                }
                info!("Server {} stderr stream ended", server_id_clone);
            });
        }

        processes.insert(
            server_id.to_string(),
            ServerProcess { child, log_tx },
        );

        Ok(())
    }

    pub async fn stop(&self, server_id: &str) -> Result<(), AppError> {
        let mut processes = self.processes.write().await;

        let proc = processes
            .get_mut(server_id)
            .ok_or_else(|| AppError::NotFound("Server not running".into()))?;

        // Try graceful shutdown first (send quit command)
        if let Some(stdin) = proc.child.stdin.as_mut() {
            let _ = writeln!(stdin, "/shutdown");
        }

        // Wait a bit for graceful shutdown
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

        // Force kill if still running
        if proc.child.try_wait().map_err(|e| AppError::Internal(e.to_string()))?.is_none() {
            proc.child
                .kill()
                .map_err(|e| AppError::Internal(format!("Failed to kill server: {}", e)))?;
        }

        processes.remove(server_id);
        info!("Stopped server {}", server_id);

        Ok(())
    }

    pub async fn restart(
        &self,
        server_id: &str,
        executable_path: &str,
        working_dir: &str,
        java_path: Option<&str>,
        min_memory: Option<&str>,
        max_memory: Option<&str>,
        extra_args: Option<&str>,
        config: Option<&serde_json::Value>,
    ) -> Result<(), AppError> {
        // Stop if running
        if self.is_running(server_id) {
            self.stop(server_id).await?;
        }

        // Start again
        self.start(
            server_id,
            executable_path,
            working_dir,
            java_path,
            min_memory,
            max_memory,
            extra_args,
            config,
        )
        .await
    }

    pub async fn send_command(&self, server_id: &str, command: &str) -> Result<(), AppError> {
        let mut processes = self.processes.write().await;

        let proc = processes
            .get_mut(server_id)
            .ok_or_else(|| AppError::NotFound("Server not running".into()))?;

        if let Some(stdin) = proc.child.stdin.as_mut() {
            writeln!(stdin, "{}", command)
                .map_err(|e| AppError::Internal(format!("Failed to send command: {}", e)))?;
        }

        Ok(())
    }

    fn generate_server_properties(&self, working_dir: &str, config: &serde_json::Value) -> std::io::Result<()> {
        let content = format!(
            "server.bind={}\nserver.port={}\nserver.auth={}\nserver.allow-op={}\n",
            config["bind_address"].as_str().unwrap_or("0.0.0.0"),
            config["port"].as_i64().unwrap_or(5520),
            config["auth_mode"].as_str().unwrap_or("authenticated"),
            config["allow_op"].as_bool().unwrap_or(false)
        );
        let path = std::path::Path::new(working_dir).join("server.properties");
        fs::write(path, content)
    }

    fn generate_world_config(&self, working_dir: &str, config: &serde_json::Value) -> std::io::Result<()> {
        let world_config = serde_json::json!({
            "seed": config["seed"],
            "gameplay": {
                "pvp": config.get("is_pvp_enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                "fallDamage": config.get("is_fall_damage_enabled").and_then(|v| v.as_bool()).unwrap_or(true)
            },
            "viewDistance": config.get("view_distance").and_then(|v| v.as_i64()).unwrap_or(12)
        });
        
        let path = std::path::Path::new(working_dir).join("world-config.json");
        fs::write(path, serde_json::to_string_pretty(&world_config)?)
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

