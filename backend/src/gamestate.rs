use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct Player {
    pub id: uuid::Uuid,
    pub position: Position,
}

impl Player {
    pub fn new(id: uuid::Uuid) -> Self {
        Self {
            id,
            position: Position::default(),
        }
    }
}

// #[derive(Debug, Clone)]
// pub struct GameObject {
//     pub id: u32,
//     pub position: Position,
//     pub object_type: String,
// }

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct GameState {
    players: HashMap<uuid::Uuid, Player>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, id: uuid::Uuid) -> uuid::Uuid {
        let new_player = Player::new(id);
        self.players.insert(id, new_player);
        id
    }

    pub fn remove_player(&mut self, player_id: &uuid::Uuid) {
        self.players.remove(player_id);
    }

    pub fn get_player(&self, player_id: &uuid::Uuid) -> Option<&Player> {
        self.players.get(player_id)
    }

    pub fn move_player(&mut self, player_id: &uuid::Uuid, position: Position) {
        if let Some(player) = self.players.get_mut(player_id) {
            player.position = position;
        }
    }
}
