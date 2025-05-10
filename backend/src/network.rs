use crate::input::{ClientMessage, ClientMessageType};
use futures_util::StreamExt;
use tokio::{net::TcpStream, sync::mpsc::error::TrySendError};
use tokio_tungstenite::accept_async;

/// Writes messages to the client
/// Receives messages from the server and broadcasts them client
pub async fn accept_connection(
    stream: TcpStream,
    tx: tokio::sync::mpsc::Sender<ClientMessage>,
    tx_broadcast: tokio::sync::mpsc::Sender<ClientMessage>,
) {
    let addr = stream
        .peer_addr()
        .expect("connected streams should have a peer address");

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("({}): WebSocket handshake failed: {}", addr, e);
            return;
        }
    };

    println!("({}): WebSocket connection established.", addr);

    let (mut write, mut read) = ws_stream.split();

    tokio::join!(
        async move {
            while let Some(msg) = rx_broadcast.recv().await {
                write.send(msg).await.unwrap();
            }
        },
        async move {
            loop {
                match read.next().await {
            Some(Ok(msg)) => {
                if msg.is_text() {
                    match serde_json::from_str::<ClientMessageType>(msg.to_text().unwrap()) {
                        Ok(msg) => {
                            println!("({}): received message: {:?}", addr, msg);
                            match tx.try_send(ClientMessage {
                                message_type: msg,
                                address: addr,
                            }) {
                                Ok(_) => {}
                                Err(TrySendError::Full(_)) => {
                                    eprintln!("({}): Channel is full. Dropping message:", addr);
                                }
                                Err(TrySendError::Closed(_)) => {
                                    eprintln!("({}): Channel is closed. Disconnecting.", addr);
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "({}): failed to deserialize message: {}. Raw: '{}'",
                                addr,
                                e,
                                msg.to_text().unwrap()
                            );
                        }
                    }
                } else if msg.is_binary() {
                    println!("({}): received binary message (not handled).", addr);
                } else if msg.is_close() {
                    println!("({}): received close frame.", addr);
                    break;
                }
            }
            Some(Err(err)) => {
                eprintln!("({}): Error receiving message: {}", addr, err);
                tx.send(ClientMessage {
                    message_type: ClientMessageType::Disconnect,
                    address: addr,
                })
                .await
                .unwrap();
                break;
            }
            None => {
                println!("({}): Connection closed.", addr);
                tx.send(ClientMessage {
                    message_type: ClientMessageType::Disconnect,
                    address: addr,
                })
                .await
                    .unwrap();
                    break;
                }
            }
        }
    );
}
