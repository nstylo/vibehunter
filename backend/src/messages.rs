use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::gamestate::GameState;

#[derive(Debug, Clone)]
pub struct ClientMessage {
    pub message_type: ClientMessageType,
    pub address: SocketAddr,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum ClientMessageType {
    Connect { player_name: String },
    Disconnect,
    SendPosition { x: f32, y: f32 },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServerMessage {
    pub message_type: ServerMessageType,
    pub tick: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum ServerMessageType {
    SendState { game_state: GameState },
}

mod tests {
    use super::*;

    #[test]
    fn test_connect_msg_deserialization() {
        let msg_json_str = r#"{"type":"Connect","player_name":"Test Player"}"#;
        let deserialized: ClientMessageType = serde_json::from_str(msg_json_str).unwrap();
        assert_eq!(
            deserialized,
            ClientMessageType::Connect {
                player_name: "Test Player".to_string(),
            }
        );
    }

    #[test]
    fn test_disconnect_msg_serialization() {
        let msg_json_str = r#"{"type":"Disconnect"}"#;
        let deserialized: ClientMessageType = serde_json::from_str(msg_json_str).unwrap();
        assert_eq!(deserialized, ClientMessageType::Disconnect);
    }

    #[test]
    fn test_send_position_msg_serialization() {
        let msg_json_str = r#"{"type":"SendPosition","x":1.0,"y":2.0}"#;
        let deserialized: ClientMessageType = serde_json::from_str(msg_json_str).unwrap();
        assert_eq!(
            deserialized,
            ClientMessageType::SendPosition { x: 1.0, y: 2.0 }
        );
    }
}
