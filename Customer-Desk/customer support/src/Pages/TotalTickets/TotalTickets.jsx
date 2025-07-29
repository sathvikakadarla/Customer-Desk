import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./TotalTickets.css";
import { Link } from "react-router-dom";

const socket = io("https://customer-desk-backend.onrender.com");

const defaultChatboxState = (initPos = null) => ({
  dragging: false,
  dragOffset: null,
  isChatMinimized: false,
  messages: [],
  newMessage: "",
  position: initPos,
});

const TotalTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [chatboxStates, setChatboxStates] = useState({});
  const messagesEndRefs = useRef({});

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch("https://customer-desk-backend.onrender.com/api/tickets");
        const data = await response.json();
        if (data.success) {
          const sortedTickets = data.tickets.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );
          setTickets(sortedTickets);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };
    fetchTickets();
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("[SOCKET] Connected with ID:", socket.id);
    });
    return () => {
      socket.off("connect");
    };
  }, []);

  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      socket.on("receiveMessage", (data) => {
        console.log(data);
        if (data.ticketId === ticket.ticketId) {
          setChatboxStates((prev) => {
            const prevMessages = prev[ticket.ticketId]?.messages || [];
            let sender = data.sender;
            let text = data.message;
            // Always treat the wait message as bot, regardless of sender
            if (text && text.trim() === "Please wait until someone join the chat.") {
              sender = "🤖 Bot";
              // Deduplicate: only add if last message is not the same
              const lastMsg = prevMessages[prevMessages.length - 1];
              if (lastMsg && lastMsg.text === text && lastMsg.sender === sender) {
                return prev;
              }
            }
            const messageTime = data.time || new Date(data.timestamp || Date.now()).toLocaleTimeString();
            return {
              ...prev,
              [ticket.ticketId]: {
                ...prev[ticket.ticketId],
                messages: [
                  ...prevMessages,
                  {
                    sender,
                    text,
                    time: messageTime,
                  },
                ],
              },
            };
          });
          // Store in localStorage
          const chatKey = `chat_${ticket.ticketId}`;
          const prevStored = JSON.parse(localStorage.getItem(chatKey)) || [];
          let sender = data.sender;
          let text = data.message;
          if (text && text.trim() === "Please wait until someone join the chat.") {
            sender = "🤖 Bot";
            const lastMsg = prevStored[prevStored.length - 1];
            if (lastMsg && lastMsg.text === text && lastMsg.sender === sender) {
              return;
            }
          }
          const newMsg = {
            sender,
            text,
            time: data.time || new Date(data.timestamp || Date.now()).toLocaleTimeString(),
          };
          localStorage.setItem(chatKey, JSON.stringify([...prevStored, newMsg]));
        }
      });
    });

    return () => {
      selectedTickets.forEach((ticket) => {
        socket.emit("leaveTicket", { ticketId: ticket.ticketId });
        socket.off("receiveMessage");
      });
    };
  }, [selectedTickets]);

  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      messagesEndRefs.current[ticket.ticketId]?.scrollIntoView({ behavior: "smooth" });
    });
  }, [chatboxStates, selectedTickets]);

  const handleTicketSelect = (ticket) => {
    if (selectedTickets.some((t) => t.ticketId === ticket.ticketId)) return;

    setSelectedTickets((prev) => [...prev, ticket]);

    setChatboxStates((prev) => {
      if (prev[ticket.ticketId]) return prev;
      const storedMessages =
        JSON.parse(localStorage.getItem(`chat_${ticket.ticketId}`)) || [
          { sender: "🤖 Bot", text: "You are now connected to the ticket chat.", time: new Date().toLocaleTimeString() },
          { sender: "🤖 Bot", text: "Waiting for customer to connect...", time: new Date().toLocaleTimeString() },
        ];
      const idx = selectedTickets.length;
      const chatboxWidth = 500;
      const left = Math.max(24, window.innerWidth - 24 - (chatboxWidth + 16) * idx - chatboxWidth);
      const top = 100;
      return {
        ...prev,
        [ticket.ticketId]: {
          ...defaultChatboxState({ left, top }),
          messages: storedMessages,
        },
      };
    });

    socket.emit("joinTicket", { ticketId: ticket.ticketId, role: "agent" });
  };

  const sendMessage = (ticketId) => {
    const chatState = chatboxStates[ticketId];
    if (!chatState.newMessage.trim()) return;

    const messageText = chatState.newMessage.trim();
    const messageData = {
      ticketId,
      sender: "support",
      message: messageText,
      timestamp: new Date().toISOString(),
      role: "agent",
    };
    socket.emit("sendMessage", messageData);

    const newMsg = {
      sender: "support",
      text: messageText,
      time: new Date().toLocaleTimeString(),
    };

    setChatboxStates((prev) => {
      const updatedMessages = [...(prev[ticketId]?.messages || []), newMsg];
      localStorage.setItem(`chat_${ticketId}`, JSON.stringify(updatedMessages));
      return {
        ...prev,
        [ticketId]: {
          ...prev[ticketId],
          messages: updatedMessages,
          newMessage: "",
        },
      };
    });

    // If the message is 'solved', close the ticket
    if (messageText.toLowerCase() === 'solved') {
      closeTicket(ticketId);
    }
  };

  const toggleMinimize = (ticketId) => {
    setChatboxStates((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        isChatMinimized: !prev[ticketId].isChatMinimized,
      },
    }));
  };

  const closeChatbox = (ticketId) => {
    setSelectedTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
    setChatboxStates((prev) => {
      const newState = { ...prev };
      delete newState[ticketId];
      return newState;
    });
  };

  const handleInputChange = (ticketId, value) => {
    setChatboxStates((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        newMessage: value,
      },
    }));
  };

  const handleDragStart = (ticketId, e) => {
    e.preventDefault();
    const startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
    setChatboxStates((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        dragging: true,
        dragOffset: {
          x: startX - (prev[ticketId]?.position?.left || 0),
          y: startY - (prev[ticketId]?.position?.top || 0),
        },
      },
    }));
    document.body.style.userSelect = "none";
  };

  const handleDrag = (ticketId, e) => {
    if (!chatboxStates[ticketId]?.dragging) return;
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
    const chatboxWidth = 500;

    let left = clientX - chatboxStates[ticketId].dragOffset.x;
    let top = clientY - chatboxStates[ticketId].dragOffset.y;

    left = Math.max(0, Math.min(window.innerWidth - chatboxWidth, left));
    top = Math.max(0, Math.min(window.innerHeight - 420, top));

    setChatboxStates((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        position: { left, top },
      },
    }));
  };

  const handleDragEnd = (ticketId) => {
    setChatboxStates((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        dragging: false,
        dragOffset: null,
      },
    }));
    document.body.style.userSelect = "";
  };

  // Add closeTicket function
  const closeTicket = async (ticketId) => {
    if (!window.confirm("Are you sure you want to end this chat?")) return;
    try {
      const response = await fetch(`https://customer-desk-backend.onrender.com/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await response.json();
      if (data.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.ticketId === ticketId ? { ...t, status: "closed" } : t
          )
        );
        // Friendly system and bot messages
        socket.emit("sendMessage", {
          ticketId,
          sender: "🤖 Bot",
          message: "🎉 This chat has been ended. Thank you for reaching out! If you need anything else, just start a new ticket. 😊",
          timestamp: new Date().toISOString(),
        });
        socket.emit("sendMessage", {
          ticketId,
          sender: "🤖 Bot",
          message: "👋 Have a wonderful day! We're always here to help.",
          timestamp: new Date().toISOString(),
        });
        socket.emit("sendMessage", {
          ticketId,
          sender: "💬 System",
          message: "💡 Live chat ended. Start a new issue to reopen support anytime!",
          timestamp: new Date().toISOString(),
        });
        setSelectedTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
        setChatboxStates((prev) => {
          const newState = { ...prev };
          delete newState[ticketId];
          return newState;
        });
      } else {
        alert("Failed to end chat. Please try again.");
      }
    } catch {
      alert("Error ending chat. Please try again.");
    }
  };

  return (
    <div>
      <div className="total-tickets-page">
        <h1>Total Tickets</h1>
        <div className="total-tickets-table">
          <table>
            <thead style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 1000 }}>
              <tr>
                <th>Ticket ID</th>
                <th>Issue</th>
                <th>Status</th>
                <th>User Message</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th>Name</th>
                <th>Number</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.ticketId}>
                  <td>
                    <button className="action-btn" onClick={() => handleTicketSelect(ticket)}>
                      {ticket.ticketId}
                    </button>
                  </td>
                  <td>{ticket.issue}</td>
                  <td>{ticket.status}</td>
                  <td>{ticket.userMessage || "No message provided"}</td>
                  <td>{new Date(ticket.createdAt).toLocaleString()}</td>
                  <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
                  <td>{ticket.userName || "N/A"}</td>
                  <td>{ticket.mobileNumber || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTickets.map((ticket, idx) => {
        const chatState = chatboxStates[ticket.ticketId] || defaultChatboxState();
        const chatboxWidth = 500;
        const { left, top } = chatState.position || {};

        return (
          <div
            key={ticket.ticketId}
            className={`chat-box${chatState.isChatMinimized ? " minimized" : ""}`}
            style={{
              position: "fixed",
              left: left ?? (window.innerWidth - 24 - (chatboxWidth + 16) * idx - chatboxWidth),
              top: top ?? (window.innerHeight - 24 - 420),
              width: chatboxWidth,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              background: "#fff",
              borderRadius: 12,
              zIndex: 2000 + idx,
              cursor: chatState.dragging ? "grabbing" : "default",
              userSelect: chatState.dragging ? "none" : "auto",
              transition: chatState.dragging ? "none" : "box-shadow 0.2s",
            }}
            onMouseMove={chatState.dragging ? (e) => handleDrag(ticket.ticketId, e) : undefined}
            onMouseUp={chatState.dragging ? () => handleDragEnd(ticket.ticketId) : undefined}
            onMouseLeave={chatState.dragging ? () => handleDragEnd(ticket.ticketId) : undefined}
            onTouchMove={chatState.dragging ? (e) => handleDrag(ticket.ticketId, e) : undefined}
            onTouchEnd={chatState.dragging ? () => handleDragEnd(ticket.ticketId) : undefined}
          >
            <div
              className="chat-header"
              style={{ cursor: "grab" }}
              onMouseDown={(e) => handleDragStart(ticket.ticketId, e)}
              onTouchStart={(e) => handleDragStart(ticket.ticketId, e)}
            >
              <h2>Support Chat - Ticket {ticket.ticketId}</h2>
              <button className="minimize-chat" onClick={() => toggleMinimize(ticket.ticketId)}>
                {chatState.isChatMinimized ? "🔼" : "🔽"}
              </button>
              <div className="chat-header">
                {ticket.status === "closed" ? (
                  <span className="closed-status">🔒 Closed</span>
                ) : (
                  <button
                    onClick={() => closeTicket(ticket.ticketId)}
                    className="close-ticket-btn"
                  >
                    💬 End Chat
                  </button>
                )}
              </div>
              <button className="close-chat" onClick={() => closeChatbox(ticket.ticketId)}>
                ✖
              </button>
            </div>
            {!chatState.isChatMinimized && (
              <>
                <div className="chat-messages">
                  {chatState.messages.map((msg, index) => {
                    const isSupport = msg.sender === "support";
                    let senderName = isSupport ? "Support" : ticket.userName || msg?.sender || "N/A";
                    if (msg.text && msg.text.trim() === "Please wait until someone join the chat.") {
                      senderName = "🤖 Bot";
                    }
                    return (
                      <div
                        key={index}
                        className={`chat-message ${isSupport ? "support-message" : "user-message"}`}
                      >
                        <span style={{ fontWeight: 600, fontSize: '1em' }}>{senderName}</span>
                        <span style={{ display: 'block', marginTop: 2 }}>{msg.text}</span>
                        <span
                          className="message-timestamp"
                          style={{
                            marginTop: 6,
                            textAlign: isSupport ? 'right' : 'left',
                            alignSelf: isSupport ? 'flex-end' : 'flex-start',
                            width: '100%',
                            fontSize: '0.82em',
                            color: '#8fa1b7',
                          }}
                        >
                          {msg.time}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={(el) => (messagesEndRefs.current[ticket.ticketId] = el)} />
                </div>
                <div className="chat-input-container">
                  <input
                    type="text"
                    placeholder={ticket.status === "closed" ? "Ticket is closed. You cannot send messages." : "Type your message..."}
                    value={chatState.newMessage}
                    onChange={(e) => handleInputChange(ticket.ticketId, e.target.value)}
                    className="chat-input"
                    disabled={ticket.status === "closed"}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatState.newMessage.trim() && ticket.status !== 'closed') {
                        e.preventDefault();
                        sendMessage(ticket.ticketId);
                      }
                    }}
                  />
                  <button
                    onClick={() => sendMessage(ticket.ticketId)}
                    className="send-btn"
                    disabled={ticket.status === "closed" || !chatState.newMessage.trim()}
                  >
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "24px 0",
          position: "fixed",
          bottom: "24px",
          right: "680px",
        }}
      >
        <Link to="/dashboard" className="back-button">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default TotalTickets;
