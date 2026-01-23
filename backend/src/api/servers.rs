use actix_web::{web, HttpResponse, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::info;
use std::path::Path;

use crate::db::DbPool;
use crate::error::AppError;
use crate::services::ProcessManager;
use crate::templates;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub game_type: String,
    pub executable_path: String,
    pub working_dir: String,
    pub java_path: Option<String>,
    pub min_memory: Option<String>,
    pub max_memory: Option<String>,
    pub extra_args: Option<String>,
    pub config: Option<serde_json::Value>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ServerResponse {
    pub id: String,
    pub name: String,
    pub game_type: String,
    pub status: String,
    pub executable_path: String,
    pub working_dir: String,
    pub java_path: Option<String>,
    pub min_memory: Option<String>,
    pub max_memory: Option<String>,
    pub extra_args: Option<String>,
    pub config: Option<serde_json::Value>,
    pub auto_start: bool,
    pub created_at: String,
    pub updated_at: String,
    pub dir_exists: bool,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/servers")
            .route("", web::get().to(list_servers))
            .route("", web::post().to(create_server))
            .route("/{id}", web::get().to(get_server))
            .route("/{id}", web::put().to(update_server))
            .route("/{id}", web::delete().to(delete_server))
            .route("/{id}/start", web::post().to(start_server))
            .route("/{id}/stop", web::post().to(stop_server))
            .route("/{id}/restart", web::post().to(restart_server))
            .route("/{id}/kill", web::post().to(kill_server))
            .route("/{id}/command", web::post().to(send_command))
            // Files API
            .route("/{id}/files", web::get().to(list_server_files))
            .route("/{id}/files/read", web::get().to(read_server_file))
            .route("/{id}/files/write", web::post().to(write_server_file)),
    );
}

async fn list_servers(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
) -> Result<HttpResponse, AppError> {
    let servers: Vec<ServerRow> = sqlx::query_as(
        "SELECT id, name, game_type, executable_path, working_dir, java_path, min_memory, max_memory, extra_args, config, auto_start, created_at, updated_at FROM servers"
    )
    .fetch_all(pool.get_ref())
    .await?;

    let responses: Vec<ServerResponse> = servers
        .into_iter()
        .map(|s| {
            // Check if the working directory exists
            let dir_exists = Path::new(&s.working_dir).exists();
            
            let status = if !dir_exists {
                "missing"
            } else if pm.is_running(&s.id) {
                "running"
            } else {
                "stopped"
            };
            ServerResponse {
                id: s.id,
                name: s.name,
                game_type: s.game_type,
                status: status.to_string(),
                executable_path: s.executable_path,
                working_dir: s.working_dir,
                java_path: s.java_path,
                min_memory: s.min_memory,
                max_memory: s.max_memory,
                extra_args: s.extra_args,
                config: s.config.and_then(|c| serde_json::from_str(&c).ok()),
                auto_start: s.auto_start != 0,
                created_at: s.created_at,
                updated_at: s.updated_at,
                dir_exists,
            }
        })
        .collect();

    Ok(HttpResponse::Ok().json(responses))
}

async fn create_server(
    pool: web::Data<DbPool>,
    body: web::Json<CreateServerRequest>,
) -> Result<HttpResponse, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let auto_start = body.auto_start.unwrap_or(false) as i32;

    // Create server directory with ID subdirectory
    // Structure:
    //   {uuid}/manager/          - Manager-specific files (server.conf, discord.conf, backups/)
    //   {uuid}/server/           - Hytale server files (working directory)
    let server_base_path = Path::new(&body.working_dir).join(&id);
    let server_path = server_base_path.join("server");
    let manager_path = server_base_path.join("manager");
    let backups_path = manager_path.join("backups");
    
    // Create all directories (Hytale official structure + manager)
    let directories = [
        &server_base_path,
        // Manager-specific
        &manager_path,
        &backups_path,
        // Hytale server structure
        &server_path,
        &server_path.join(".cache"),
        &server_path.join("mods"),
        &server_path.join("logs"),
        &server_path.join("universe"),
        &server_path.join("universe/players"),
        &server_path.join("universe/worlds"),
        &server_path.join("universe/worlds/default"),
    ];

    for dir in directories {
        if let Err(e) = fs::create_dir_all(dir).await {
            return Err(AppError::Internal(format!(
                "Failed to create directory {:?}: {}",
                dir, e
            )));
        }
    }

    info!("Created server directory structure at {:?}", server_base_path);

    // Extract configuration from request body
    let config_value = body.config.as_ref();
    let server_name = &body.name;
    let max_players: u32 = config_value
        .and_then(|c| c.get("max_players"))
        .and_then(|v| v.as_u64())
        .unwrap_or(100) as u32;
    let auth_mode = config_value
        .and_then(|c| c.get("auth_mode"))
        .and_then(|v| v.as_str())
        .unwrap_or("authenticated");
    let bind_address = config_value
        .and_then(|c| c.get("bind_address"))
        .and_then(|v| v.as_str())
        .unwrap_or("0.0.0.0");
    let port: u16 = config_value
        .and_then(|c| c.get("port"))
        .and_then(|v| v.as_u64())
        .unwrap_or(5520) as u16;

    // Generate and write config.json
    let hytale_config = templates::generate_config_json(server_name, max_players, auth_mode);
    let config_json_path = server_path.join("config.json");
    let mut file = fs::File::create(&config_json_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create config.json: {}", e))
    })?;
    file.write_all(serde_json::to_string_pretty(&hytale_config).unwrap().as_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write config.json: {}", e)))?;

    // Generate and write permissions.json
    let permissions = templates::generate_permissions_json();
    let permissions_path = server_path.join("permissions.json");
    let mut file = fs::File::create(&permissions_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create permissions.json: {}", e))
    })?;
    file.write_all(serde_json::to_string_pretty(&permissions).unwrap().as_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write permissions.json: {}", e)))?;

    // Generate and write bans.json
    let bans = templates::generate_bans_json();
    let bans_path = server_path.join("bans.json");
    let mut file = fs::File::create(&bans_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create bans.json: {}", e))
    })?;
    file.write_all(serde_json::to_string_pretty(&bans).unwrap().as_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write bans.json: {}", e)))?;

    // Generate and write whitelist.json
    let whitelist = templates::generate_whitelist_json();
    let whitelist_path = server_path.join("whitelist.json");
    let mut file = fs::File::create(&whitelist_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create whitelist.json: {}", e))
    })?;
    file.write_all(serde_json::to_string_pretty(&whitelist).unwrap().as_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write whitelist.json: {}", e)))?;

    // Generate and write universe/memories.json
    let memories_path = server_path.join("universe/memories.json");
    let mut file = fs::File::create(&memories_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create memories.json: {}", e))
    })?;
    file.write_all(b"{\"memories\": []}")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write memories.json: {}", e)))?;

    // Generate and write manager/manager.json (unified config)
    let manager_config = templates::generate_manager_json(
        &id,
        server_name,
        server_base_path.to_str().unwrap_or(""),
        bind_address,
        port,
        auth_mode,
        body.java_path.as_deref(),
        body.min_memory.as_deref(),
        body.max_memory.as_deref(),
    );
    let manager_json_path = manager_path.join("manager.json");
    let mut file = fs::File::create(&manager_json_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create manager.json: {}", e))
    })?;
    file.write_all(serde_json::to_string_pretty(&manager_config).unwrap().as_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write manager.json: {}", e)))?;

    // Create placeholder files for development
    // In production, these would be downloaded via hytale-downloader
    
    // HytaleServer.jar
    let jar_path = server_path.join("HytaleServer.jar");
    let mut file = fs::File::create(&jar_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create HytaleServer.jar placeholder: {}", e))
    })?;
    file.write_all(b"# Placeholder - Download server via hytale-downloader\n")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write HytaleServer.jar: {}", e)))?;

    // HytaleServer.aot (AOT cache for faster startup)
    let aot_path = server_path.join("HytaleServer.aot");
    let mut file = fs::File::create(&aot_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create HytaleServer.aot placeholder: {}", e))
    })?;
    file.write_all(b"# Placeholder - Generated by Java on first run with -XX:AOTCache\n")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write HytaleServer.aot: {}", e)))?;

    // Assets.zip (required game assets)
    let assets_path = server_path.join("Assets.zip");
    let mut file = fs::File::create(&assets_path).await.map_err(|e| {
        AppError::Internal(format!("Failed to create Assets.zip placeholder: {}", e))
    })?;
    file.write_all(b"# Placeholder - Download assets via hytale-downloader\n")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write Assets.zip: {}", e)))?;

    info!("Generated all configuration files for server {}", id);

    let config_str = body.config.as_ref().map(|c| c.to_string());

    // Store server in database with the correct paths
    let actual_working_dir = server_base_path.to_str().unwrap_or(&body.working_dir);
    let actual_executable = server_path.join("HytaleServer.jar");
    let actual_executable_str = actual_executable.to_str().unwrap_or(&body.executable_path);

    sqlx::query(
        "INSERT INTO servers (id, name, game_type, executable_path, working_dir, java_path, min_memory, max_memory, extra_args, config, auto_start, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.game_type)
    .bind(actual_executable_str)
    .bind(actual_working_dir)
    .bind(&body.java_path)
    .bind(&body.min_memory)
    .bind(&body.max_memory)
    .bind(&body.extra_args)
    .bind(config_str)
    .bind(auto_start)
    .bind(&now)
    .bind(&now)
    .execute(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(serde_json::json!({ 
        "id": id,
        "working_dir": actual_working_dir,
        "message": "Server directory structure created. Download the server files using hytale-downloader."
    })))
}

async fn get_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    let server: ServerRow = sqlx::query_as(
        "SELECT id, name, game_type, executable_path, working_dir, java_path, min_memory, max_memory, extra_args, config, auto_start, created_at, updated_at FROM servers WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Server not found".into()))?;

    let status = if pm.is_running(&server.id) {
        "running"
    } else {
        "stopped"
    };

    let dir_exists = Path::new(&server.working_dir).exists();

    Ok(HttpResponse::Ok().json(ServerResponse {
        id: server.id,
        name: server.name,
        game_type: server.game_type,
        status: status.to_string(),
        executable_path: server.executable_path,
        working_dir: server.working_dir,
        java_path: server.java_path,
        min_memory: server.min_memory,
        max_memory: server.max_memory,
        extra_args: server.extra_args,
        config: server.config.and_then(|c| serde_json::from_str(&c).ok()),
        auto_start: server.auto_start != 0,
        created_at: server.created_at,
        updated_at: server.updated_at,
        dir_exists,
    }))
}

async fn update_server(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
    body: web::Json<CreateServerRequest>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    let now = Utc::now().to_rfc3339();
    let auto_start = body.auto_start.unwrap_or(false) as i32;

    let config_str = body.config.as_ref().map(|c| c.to_string());

    let result = sqlx::query(
        "UPDATE servers SET name = ?, game_type = ?, executable_path = ?, working_dir = ?, java_path = ?, min_memory = ?, max_memory = ?, extra_args = ?, config = ?, auto_start = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&body.name)
    .bind(&body.game_type)
    .bind(&body.executable_path)
    .bind(&body.working_dir)
    .bind(&body.java_path)
    .bind(&body.min_memory)
    .bind(&body.max_memory)
    .bind(&body.extra_args)
    .bind(config_str)
    .bind(auto_start)
    .bind(&now)
    .bind(&id)
    .execute(pool.get_ref())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Server not found".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

async fn delete_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    // Stop server if running
    if pm.is_running(&id) {
        pm.stop(&id).await?;
    }

    let result = sqlx::query("DELETE FROM servers WHERE id = ?")
        .bind(&id)
        .execute(pool.get_ref())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Server not found".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

async fn start_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    let server: ServerRow = sqlx::query_as(
        "SELECT id, name, game_type, executable_path, working_dir, java_path, min_memory, max_memory, extra_args, config, auto_start, created_at, updated_at FROM servers WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Server not found".into()))?;

    pm.start(
        &server.id,
        &server.executable_path,
        &server.working_dir,
        server.java_path.as_deref(),
        server.min_memory.as_deref(),
        server.max_memory.as_deref(),
        server.extra_args.as_deref(),
        server.config.as_ref().and_then(|c| serde_json::from_str(c).ok()).as_ref(),
    )
    .await?;

    // Send webhook notification
    let pool_clone = pool.get_ref().clone();
    let server_name = server.name.clone();
    tokio::spawn(async move {
        crate::services::discord_service::send_notification(
            &pool_clone,
            "🟢 Serveur Démarré",
            &format!("Le serveur **{}** a été démarré.", server_name),
            crate::services::discord_service::COLOR_SUCCESS,
            Some(&server_name),
        ).await;
    });

    Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "starting" })))
}

async fn stop_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    
    // Get server name for webhook
    let server_name: Option<(String,)> = sqlx::query_as("SELECT name FROM servers WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.get_ref())
        .await?;
    
    pm.stop(&id).await?;
    
    // Send webhook notification
    if let Some((name,)) = server_name {
        let pool_clone = pool.get_ref().clone();
        tokio::spawn(async move {
            crate::services::discord_service::send_notification(
                &pool_clone,
                "🔴 Serveur Arrêté",
                &format!("Le serveur **{}** a été arrêté.", name),
                crate::services::discord_service::COLOR_ERROR,
                Some(&name),
            ).await;
        });
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "stopping" })))
}

async fn restart_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    let server: ServerRow = sqlx::query_as(
        "SELECT id, name, game_type, executable_path, working_dir, java_path, min_memory, max_memory, extra_args, config, auto_start, created_at, updated_at FROM servers WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Server not found".into()))?;

    pm.restart(
        &server.id,
        &server.executable_path,
        &server.working_dir,
        server.java_path.as_deref(),
        server.min_memory.as_deref(),
        server.max_memory.as_deref(),
        server.extra_args.as_deref(),
        server.config.as_ref().and_then(|c| serde_json::from_str(c).ok()).as_ref(),
    )
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "restarting" })))
}

async fn kill_server(
    pool: web::Data<DbPool>,
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    
    // Get server name for webhook
    let server_name: Option<(String,)> = sqlx::query_as("SELECT name FROM servers WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.get_ref())
        .await?;
    
    pm.kill(&id).await?;
    
    // Send webhook notification
    if let Some((name,)) = server_name {
        let pool_clone = pool.get_ref().clone();
        tokio::spawn(async move {
            crate::services::discord_service::send_notification(
                &pool_clone,
                "💀 Serveur Tué",
                &format!("Le serveur **{}** a été forcé de s'arrêter.", name),
                crate::services::discord_service::COLOR_WARNING,
                Some(&name),
            ).await;
        });
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "killed" })))
}

#[derive(Debug, Deserialize)]
pub struct CommandRequest {
    pub command: String,
}

async fn send_command(
    pm: web::Data<ProcessManager>,
    path: web::Path<String>,
    body: web::Json<CommandRequest>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    pm.send_command(&id, &body.command).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

#[derive(Debug, FromRow)]
struct ServerRow {
    id: String,
    name: String,
    game_type: String,
    executable_path: String,
    working_dir: String,
    java_path: Option<String>,
    min_memory: Option<String>,
    max_memory: Option<String>,
    extra_args: Option<String>,
    config: Option<String>,
    auto_start: i32,
    created_at: String,
    updated_at: String,
}

// ============= Server Files API =============

#[derive(Debug, Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct FilesQuery {
    path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReadFileQuery {
    path: String,
}

#[derive(Debug, Deserialize)]
struct WriteFileRequest {
    path: String,
    content: String,
}

async fn list_server_files(
    pool: web::Data<DbPool>,
    path_param: web::Path<String>,
    query: web::Query<FilesQuery>,
) -> Result<HttpResponse, AppError> {
    let server_id = path_param.into_inner();
    
    // Get server working directory
    let server: Option<(String,)> = sqlx::query_as("SELECT working_dir FROM servers WHERE id = ?")
        .bind(&server_id)
        .fetch_optional(pool.get_ref())
        .await?;
    
    let working_dir = server
        .ok_or_else(|| AppError::NotFound("Server not found".into()))?
        .0;
    
    // Build the path - relative to working_dir (includes server/ and manager/)
    let base_path = Path::new(&working_dir);
    let relative_path = query.path.clone().unwrap_or_default();
    let full_path = if relative_path.is_empty() {
        base_path.to_path_buf()
    } else {
        base_path.join(&relative_path)
    };
    
    // Security: ensure path is within server directory
    if !full_path.starts_with(&base_path) {
        return Err(AppError::BadRequest("Invalid path".into()));
    }
    
    if !full_path.exists() {
        return Err(AppError::NotFound("Path not found".into()));
    }
    
    if !full_path.is_dir() {
        return Err(AppError::BadRequest("Path is not a directory".into()));
    }
    
    let mut entries: Vec<FileEntry> = Vec::new();
    
    // Add parent directory if not at root
    if !relative_path.is_empty() {
        let parent = Path::new(&relative_path).parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        entries.push(FileEntry {
            name: "..".to_string(),
            path: parent,
            is_dir: true,
            size: None,
        });
    }
    
    // Read directory entries
    let read_dir = std::fs::read_dir(&full_path)
        .map_err(|e| AppError::Internal(format!("Failed to read directory: {}", e)))?;
    
    for entry in read_dir.flatten() {
        let entry_path = entry.path();
        let is_dir = entry_path.is_dir();
        let size = if is_dir { None } else { entry_path.metadata().ok().map(|m| m.len()) };
        
        if let Some(name) = entry_path.file_name() {
            let name_str = name.to_string_lossy().to_string();
            let rel_path = if relative_path.is_empty() {
                name_str.clone()
            } else {
                format!("{}/{}", relative_path, name_str)
            };
            
            entries.push(FileEntry {
                name: name_str,
                path: rel_path,
                is_dir,
                size,
            });
        }
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.name == ".." {
            std::cmp::Ordering::Less
        } else if b.name == ".." {
            std::cmp::Ordering::Greater
        } else if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "current_path": relative_path,
        "entries": entries
    })))
}

async fn read_server_file(
    pool: web::Data<DbPool>,
    path_param: web::Path<String>,
    query: web::Query<ReadFileQuery>,
) -> Result<HttpResponse, AppError> {
    let server_id = path_param.into_inner();
    
    // Get server working directory
    let server: Option<(String,)> = sqlx::query_as("SELECT working_dir FROM servers WHERE id = ?")
        .bind(&server_id)
        .fetch_optional(pool.get_ref())
        .await?;
    
    let working_dir = server
        .ok_or_else(|| AppError::NotFound("Server not found".into()))?
        .0;
    
    let base_path = Path::new(&working_dir);
    let full_path = base_path.join(&query.path);
    
    // Security check
    if !full_path.starts_with(&base_path) {
        return Err(AppError::BadRequest("Invalid path".into()));
    }
    
    if !full_path.exists() {
        return Err(AppError::NotFound("File not found".into()));
    }
    
    if full_path.is_dir() {
        return Err(AppError::BadRequest("Cannot read a directory".into()));
    }
    
    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "path": query.path,
        "content": content
    })))
}

async fn write_server_file(
    pool: web::Data<DbPool>,
    path_param: web::Path<String>,
    body: web::Json<WriteFileRequest>,
) -> Result<HttpResponse, AppError> {
    let server_id = path_param.into_inner();
    
    // Get server working directory
    let server: Option<(String,)> = sqlx::query_as("SELECT working_dir FROM servers WHERE id = ?")
        .bind(&server_id)
        .fetch_optional(pool.get_ref())
        .await?;
    
    let working_dir = server
        .ok_or_else(|| AppError::NotFound("Server not found".into()))?
        .0;
    
    let base_path = Path::new(&working_dir);
    let full_path = base_path.join(&body.path);
    
    // Security check
    if !full_path.starts_with(&base_path) {
        return Err(AppError::BadRequest("Invalid path".into()));
    }
    
    std::fs::write(&full_path, &body.content)
        .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;
    
    info!("File written: {:?}", full_path);
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "path": body.path
    })))
}
