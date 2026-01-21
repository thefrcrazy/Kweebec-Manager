use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use crate::error::AppError;
use crate::api::auth::AuthResponse;

#[derive(Serialize)]
struct SetupStatusResponse {
    is_setup: bool,
}

#[derive(Deserialize)]
struct SetupRequest {
    username: String,
    password: String,
    servers_dir: String,
    backups_dir: String,
    theme_color: String,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/setup")
            .route("/status", web::get().to(get_setup_status))
            .route("", web::post().to(perform_setup)),
    );
}

async fn get_setup_status(pool: web::Data<DbPool>) -> Result<HttpResponse, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(SetupStatusResponse {
        is_setup: count > 0,
    }))
}

async fn perform_setup(
    pool: web::Data<DbPool>,
    body: web::Json<SetupRequest>,
) -> Result<HttpResponse, AppError> {
    // 1. Check if setup is already done
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool.get_ref())
        .await?;

    if count > 0 {
        return Err(AppError::BadRequest("Setup already completed".into()));
    }

    // 2. Create Admin User
    // Note: We're reusing auth logic but we need to hash password manually if we don't use auth service helper
    // Let's use bcrypt directly as in auth.rs
    let password_hash = bcrypt::hash(&body.password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user_id = uuid::Uuid::new_v4().to_string();
    
    // Use role text instead of is_admin boolean
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, role, accent_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    )
    .bind(&user_id)
    .bind(&body.username)
    .bind(&password_hash)
    .bind("admin") // Role
    .bind(&body.theme_color) // Sync accent_color with theme_color
    .execute(pool.get_ref())
    .await?;

    // 3. Update Settings
    async fn upsert_setting(pool: &crate::db::DbPool, key: &str, value: &str) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
        Ok(())
    }

    upsert_setting(pool.get_ref(), "servers_dir", &body.servers_dir).await?;
    upsert_setting(pool.get_ref(), "backups_dir", &body.backups_dir).await?;
    upsert_setting(pool.get_ref(), "login_default_color", &body.theme_color).await?;

    // 4. Return Login Token (Auto-login)
    // Generate JWT
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".into());
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = crate::api::auth::Claims {
        sub: user_id.clone(),
        username: body.username.clone(),
        role: "admin".to_string(),
        exp: expiration,
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        token,
        user: crate::api::auth::UserInfo {
            id: user_id,
            username: body.username.clone(),
            role: "admin".to_string(),
            accent_color: Some(body.theme_color.clone()),
        },
    }))
}
