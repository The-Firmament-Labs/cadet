use std::env;

use starbridge_dioxus::{load_live_snapshot, render_preview, sample_snapshot, LiveSnapshotOptions};

fn read_flag(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == flag)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

fn main() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();

    if args.iter().any(|arg| arg == "--sample") {
        println!("{}", render_preview(sample_snapshot()));
        return Ok(());
    }

    let defaults = LiveSnapshotOptions::from_env();
    let options = LiveSnapshotOptions {
        base_url: read_flag(&args, "--db-url").unwrap_or(defaults.base_url),
        database: read_flag(&args, "--database").unwrap_or(defaults.database),
    };

    let snapshot = load_live_snapshot(&options)?;
    println!("{}", render_preview(snapshot));
    Ok(())
}
