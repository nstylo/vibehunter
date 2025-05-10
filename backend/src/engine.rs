use crate::gamestate::{GameState, Position};
use crate::messages::{ClientMessage, ClientMessageType};
use std::collections::HashMap;
use std::net::SocketAddr;

#[derive(Debug, Clone, Default)]
pub struct GameEngine {
    player_id_map: HashMap<SocketAddr, uuid::Uuid>,
}

impl GameEngine {
    pub fn new() -> Self {
        Self {
            player_id_map: HashMap::new(),
        }
    }

    pub fn get_player_id(&self, address: &SocketAddr) -> Option<uuid::Uuid> {
        self.player_id_map.get(address).cloned()
    }

    pub fn add_player(&mut self, address: SocketAddr) -> uuid::Uuid {
        let id = uuid::Uuid::new_v4();
        println!("GameEngine: Adding player with address: {}", address);
        self.player_id_map.insert(address, id);
        id
    }

    pub fn remove_player(&mut self, address: &SocketAddr) {
        println!("GameEngine: Removing player with address: {}", address);
        self.player_id_map.remove(address);
    }

    // get a non-mutable reference to the players
    pub fn get_players(&self) -> &HashMap<SocketAddr, uuid::Uuid> {
        &self.player_id_map
    }

    pub fn get_player_count(&self) -> usize {
        self.player_id_map.len()
    }

    pub fn process_tick(&mut self, game_state: &mut GameState, inputs: Vec<ClientMessage>) {
        for input in inputs {
            let player_id = match self.get_player_id(&input.address) {
                Some(id) => id,
                None => {
                    // user couldn't be found, let's ignore this input
                    println!("User not found for address: {}", input.address);
                    continue;
                }
            };

            match input.message_type {
                ClientMessageType::SendPosition { x, y } => {
                    println!("Moving player {} to position: {}, {}", player_id, x, y);
                    game_state.move_player(&player_id, Position { x, y });
                }
                ClientMessageType::Connect { player_name } => {
                    println!(
                        "Engine processing Connect for player {} with name: {}",
                        player_id, player_name
                    );
                    game_state.add_player(player_id);
                }
                ClientMessageType::Disconnect => {
                    println!("Engine noted Disconnect intent for player {}", player_id);
                    self.remove_player(&input.address);
                }
            }
        }
    }
}
