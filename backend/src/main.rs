pub mod engine;
pub mod gamestate;
pub mod messages;
pub mod network;

use engine::GameEngine;
use gamestate::GameState;
use messages::{ClientMessage, ServerMessage, ServerMessageType};
use tokio::net::TcpListener;
use tokio::time::{Duration, interval};

const TICKS_PER_SECOND: u32 = 60;

#[tokio::main]
async fn main() {
    println!("Starting game server...");

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
    let (tx_broadcast, _) = tokio::sync::broadcast::channel::<ServerMessage>(1000);

    // Spawn a task to handle incoming connections
    let tx_broadcast_client = tx_broadcast.clone();
    tokio::spawn(async move {
        while let Ok((stream, _peer_addr)) = listener.accept().await {
            let rx_broadcast = tx_broadcast_client.subscribe();
            tokio::spawn(network::accept_connection(stream, tx.clone(), rx_broadcast));
        }
    });

    // Main game loop
    let mut game_interval = interval(Duration::from_secs_f64(1.0 / TICKS_PER_SECOND as f64));
    let mut curr_tick: u64 = 0;

    loop {
        game_interval.tick().await;
        curr_tick += 1;

        // Collect all messages from the channel for this tick
        let mut messages = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            messages.push(msg);
        }

        // compute the next state
        game_engine.process_tick(&mut game_state, messages);

        // send the state to all clients if there are any
        if tx_broadcast.receiver_count() > 0 && game_engine.get_player_count() > 0 {
            if let Err(e) = tx_broadcast.send(ServerMessage {
                message_type: ServerMessageType::SendState {
                    game_state: game_state.clone(),
                },
                tick: curr_tick,
            }) {
                eprintln!("Error sending state to clients: {}", e);
            }
        }

        // Log server status periodically (e.g., every second)
        if curr_tick % (TICKS_PER_SECOND as u64) == 0 {
            let current_second = curr_tick / (TICKS_PER_SECOND as u64);
            println!("Server tick {} ({}s elapsed)", curr_tick, current_second);

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
