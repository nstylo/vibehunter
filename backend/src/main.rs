pub mod engine;
pub mod gamestate;
pub mod input;
pub mod network;

use engine::GameEngine;
use gamestate::GameState;
use input::ClientMessage;
use tokio::net::TcpListener;
use tokio::time::{Duration, interval};

const TICKS_PER_SECOND: u32 = 60;

#[tokio::main]
async fn main() {
    println!("Hello, world! Starting game server...");

    // Initialize GameState, wrapped for safe concurrent access
    let mut game_state = GameState::new();
    let mut game_engine = GameEngine::new();

    // Start TCP listener for WebSocket connections
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr)
        .await
        .expect("Failed to bind TCP listener");
    println!("Game server listening on: {}", addr);

    // per tick we can handle at most 1000 messages
    let (tx, mut rx) = tokio::sync::mpsc::channel::<ClientMessage>(1000);
    // broadcast channel for sending messages to all clients
    let (tx_broadcast, mut rx_broadcast) = tokio::sync::mpsc::channel::<ClientMessage>(1000);

    // Spawn a task to handle incoming connections
    tokio::spawn(async move {
        while let Ok((stream, _peer_addr)) = listener.accept().await {
            tokio::spawn(network::accept_connection(
                stream,
                tx.clone(),
                rx_broadcast.clone(),
            ));
        }
    });

    // Main game loop
    let mut game_interval = interval(Duration::from_secs_f64(1.0 / TICKS_PER_SECOND as f64));
    let mut tick_count: u64 = 0;

    loop {
        game_interval.tick().await;
        tick_count += 1;

        // Collect all messages from the channel for this tick
        let mut messages = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            messages.push(msg);
        }

        // println!("Received {:?} messages", messages);

        game_engine.process_tick(&mut game_state, messages);
        // println!("Game state: {:?}", game_state);

        // Log server status periodically (e.g., every second)
        if tick_count % (TICKS_PER_SECOND as u64) == 0 {
            let current_second = tick_count / (TICKS_PER_SECOND as u64);
            println!("Server tick {} ({}s elapsed)", tick_count, current_second);

            let players = game_engine.get_players();

            if players.is_empty() {
                println!("No players connected.");
            } else {
                println!("Currently connected players:");
                for (address, player_id) in players.iter() {
                    println!("  - Player ID: {}, Address: {}", player_id, address);
                }
            }
        }
    }
}
