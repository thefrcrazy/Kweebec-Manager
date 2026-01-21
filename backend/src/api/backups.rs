use actix_web::{web, HttpResponse, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct BackupResponse {
    pub id: String,
    pub server_id: String,
    pub filename: String,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBackupRequest {
    pub server_id: String,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/backups")
            .route("", web::get().to(list_backups))
            .route("", web::post().to(create_backup))
            .route("/{id}", web::get().to(get_backup))
            .route("/{id}", web::delete().to(delete_backup))
            .route("/{id}/restore", web::post().to(restore_backup)),
    );
}

async fn list_backups(
    pool: web::Data<DbPool>,
    query: web::Query<ListBackupsQuery>,
) -> Result<HttpResponse, AppError> {
    let backups: Vec<BackupRow> = if let Some(server_id) = &query.server_id {
        sqlx::query_as(
            "SELECT id, server_id, filename, size_bytes, created_at FROM backups WHERE server_id = ? ORDER BY created_at DESC"
        )
        .bind(server_id)
        .fetch_all(pool.get_ref())
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, server_id, filename, size_bytes, created_at FROM backups ORDER BY created_at DESC"
        )
        .fetch_all(pool.get_ref())
        .await?
    };

    let responses: Vec<BackupResponse> = backups
        .into_iter()
        .map(|b| BackupResponse {
            id: b.id,
            server_id: b.server_id,
            filename: b.filename,
            size_bytes: b.size_bytes,
            created_at: b.created_at,
        })
        .collect();

    Ok(HttpResponse::Ok().json(responses))
}

async fn create_backup(
    pool: web::Data<DbPool>,
    body: web::Json<CreateBackupRequest>,
) -> Result<HttpResponse, AppError> {
    // Check server exists
    let server: Option<(String,)> = sqlx::query_as("SELECT working_dir FROM servers WHERE id = ?")
        .bind(&body.server_id)
        .fetch_optional(pool.get_ref())
        .await?;

    if server.is_none() {
        return Err(AppError::NotFound("Server not found".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let filename = format!(
        "backup_{}_{}.tar.gz",
        body.server_id,
        now.format("%Y%m%d_%H%M%S")
    );

    // Create backups directory if not exists
    let backups_dir = std::path::Path::new("backups");
    if !backups_dir.exists() {
        std::fs::create_dir_all(backups_dir).map_err(|e| AppError::Internal(format!("Failed to create backups dir: {}", e)))?;
    }

    let backup_path = backups_dir.join(&filename);
    
    // Create actual backup
    let working_dir = &server.unwrap().0;
    
    // Call service
    let size_bytes = crate::services::backup_service::create_archive(working_dir, backup_path.to_str().unwrap())
        .map_err(|e| AppError::Internal(format!("Backup failed: {:?}", e)))?;

    let created_at = now.to_rfc3339();

    sqlx::query(
        "INSERT INTO backups (id, server_id, filename, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.server_id)
    .bind(&filename)
    .bind(size_bytes as i64)
    .bind(&created_at)
    .execute(pool.get_ref())
    .await?;

    Ok(HttpResponse::Created().json(BackupResponse {
        id,
        server_id: body.server_id.clone(),
        filename,
        size_bytes: size_bytes as i64,
        created_at,
    }))
}

async fn get_backup(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    let backup: BackupRow = sqlx::query_as(
        "SELECT id, server_id, filename, size_bytes, created_at FROM backups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Backup not found".into()))?;

    Ok(HttpResponse::Ok().json(BackupResponse {
        id: backup.id,
        server_id: backup.server_id,
        filename: backup.filename,
        size_bytes: backup.size_bytes,
        created_at: backup.created_at,
    }))
}

async fn delete_backup(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    // Get filename first to delete file
    let backup: Option<(String,)> = sqlx::query_as("SELECT filename FROM backups WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.get_ref())
        .await?;

    if let Some((filename,)) = backup {
         let backups_dir = std::path::Path::new("backups");
         let file_path = backups_dir.join(filename);
         if file_path.exists() {
             std::fs::remove_file(file_path).map_err(|e| AppError::Internal(format!("Failed to delete backup file: {}", e)))?;
         }
    }

    let result = sqlx::query("DELETE FROM backups WHERE id = ?")
        .bind(&id)
        .execute(pool.get_ref())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Backup not found".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "success": true })))
}

async fn restore_backup(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();

    let backup: BackupRow = sqlx::query_as(
        "SELECT id, server_id, filename, size_bytes, created_at FROM backups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Backup not found".into()))?;

    // Get server working dir
    let server: (String,) = sqlx::query_as("SELECT working_dir FROM servers WHERE id = ?")
        .bind(&backup.server_id)
        .fetch_optional(pool.get_ref())
        .await?
        .ok_or_else(|| AppError::NotFound("Server not found".into()))?;

    let backups_dir = std::path::Path::new("backups");
    let file_path = backups_dir.join(&backup.filename);
    
    // Restore
    crate::services::backup_service::extract_archive(file_path.to_str().unwrap(), &server.0)
        .map_err(|e| AppError::Internal(format!("Restore failed: {:?}", e)))?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": format!("Restoring backup {} for server {}", backup.filename, backup.server_id)
    })))
}

#[derive(Debug, Deserialize)]
struct ListBackupsQuery {
    server_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct BackupRow {
    id: String,
    server_id: String,
    filename: String,
    size_bytes: i64,
    created_at: String,
}
