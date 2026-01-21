use actix_web::{web, HttpResponse, Result};
use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Disks, System};

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct SystemStatsResponse {
    pub cpu: f32,
    pub ram: f32,
    pub ram_used: u64,
    pub ram_total: u64,
    pub disk: f32,
    pub disk_used: u64,
    pub disk_total: u64,
    pub players_current: u32,
    pub players_max: u32,
}

// Keep a static System instance for accurate CPU readings
lazy_static::lazy_static! {
    static ref SYSTEM: Mutex<System> = Mutex::new(System::new_all());
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(web::scope("/system").route("/stats", web::get().to(get_system_stats)));
}

async fn get_system_stats() -> Result<HttpResponse, AppError> {
    let (cpu_usage, ram_percent, ram_used, ram_total) = {
        let mut sys = SYSTEM.lock().unwrap();
        sys.refresh_all();
        
        // CPU usage (average across all CPUs)
        let cpu: f32 = sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum::<f32>()
            / sys.cpus().len().max(1) as f32;

        // RAM usage
        let total = sys.total_memory();
        let used = sys.used_memory();
        let percent = if total > 0 {
            (used as f64 / total as f64 * 100.0) as f32
        } else {
            0.0
        };
        
        (cpu, percent, used, total)
    };

    // Disk usage - only count the main disk (mounted at "/" on macOS/Linux)
    let disks = Disks::new_with_refreshed_list();
    let mut disk_total: u64 = 0;
    let mut disk_used: u64 = 0;

    for disk in disks.list() {
        let mount_point = disk.mount_point().to_string_lossy();
        // Only count the root filesystem
        if mount_point == "/" {
            disk_total = disk.total_space();
            disk_used = disk.total_space() - disk.available_space();
            break;
        }
    }

    // Fallback: if no root disk found, use the first disk
    if disk_total == 0 && !disks.list().is_empty() {
        let first_disk = &disks.list()[0];
        disk_total = first_disk.total_space();
        disk_used = first_disk.total_space() - first_disk.available_space();
    }

    let disk_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64 * 100.0) as f32
    } else {
        0.0
    };

    // Players - TODO: Implement actual player counting from servers
    let players_current = 0;
    let players_max = 0;

    Ok(HttpResponse::Ok().json(SystemStatsResponse {
        cpu: cpu_usage,
        ram: ram_percent,
        ram_used,
        ram_total,
        disk: disk_percent,
        disk_used,
        disk_total,
        players_current,
        players_max,
    }))
}

