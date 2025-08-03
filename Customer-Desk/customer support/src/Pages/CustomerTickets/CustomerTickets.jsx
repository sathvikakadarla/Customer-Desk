import { useEffect, useState, useRef } from "react";
import {  Link } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import "./CustomerTickets.css";

const socket = io("https://customer-desk-backend.onrender.com");

const defaultChatboxState = (initPos = null) => ({
  dragging: false,
  dragOffset: null,
  isChatMinimized: false,
  messages: [],
  newMessage: "",
  position: initPos, // { left, top }
});

const CustomerTickets = () => {
  const [drivertickets, setDriverTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]); // Array of ticket objects
  const [chatboxStates, setChatboxStates] = useState({}); // { [ticketId]: { ...state } }
  const messagesEndRefs = useRef({});

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get("http://localhost:5002/api/tickets");
        if (response.data.success) {
          const sortedTickets = response.data.tickets.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );
          setDriverTickets(sortedTickets);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };
    fetchTickets();
  }, []);

  // Handle real-time messaging with Socket.IO for all open tickets
  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      socket.on("receiveMessage", (data) => {
        if (data.ticketId === ticket.ticketId) {
          setChatboxStates((prev) => {
            const prevMessages = prev[ticket.ticketId]?.messages || [];
            if (prevMessages.some((msg) => msg.text === data.message && msg.sender === data.sender)) {
              return prev;
            }
            return {
              ...prev,
              [ticket.ticketId]: {
                ...prev[ticket.ticketId],
                messages: [
                  ...prevMessages,
                  { sender: data.sender, text: data.message, time: new Date(data.timestamp).toLocaleTimeString() },
                ],
              },
            };
          });
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

  // Auto-scroll to the latest message for each chatbox
  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      messagesEndRefs.current[ticket.ticketId]?.scrollIntoView({ behavior: "smooth" });
    });
  }, [chatboxStates, selectedTickets]);

  // Handle ticket selection and load chat history
  const handleTicketSelect = (ticket) => {
    // Allow opening chat for closed tickets, but disable input inside chatbox
    setSelectedTickets((prev) => {
      if (prev.some((t) => t.ticketId === ticket.ticketId)) return prev;
      return [...prev, ticket];
    });
    setChatboxStates((prev) => {
      if (prev[ticket.ticketId]) return prev;
      const storedMessages =
        JSON.parse(localStorage.getItem(`chat_${ticket.ticketId}`)) || [
          { sender: "system", text: "You are now connected to the ticket chat." },
          { sender: "system", text: "Waiting for customer to connect..." },
        ];
      // Initial position: bottom right, offset left by index
      const idx = selectedTickets.length;
      const chatboxWidth = 500;
      const left = Math.max(24, window.innerWidth - 24 - (chatboxWidth + 16) * idx - chatboxWidth);
      const top = 100; // 100px from the top
      return {
        ...prev,
        [ticket.ticketId]: {
          ...defaultChatboxState({ left, top }),
          messages: storedMessages,
        },
      };
    });
  };

  // Send a new message for a specific ticket
  const sendMessage = (ticketId) => {
    const chatState = chatboxStates[ticketId];
    if (!chatState.newMessage.trim()) return;
    const messageData = {
      ticketId,
      sender: "support",
      message: chatState.newMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    socket.emit("sendMessage", messageData);
    const newMessageObject = {
      sender: "support",
      text: chatState.newMessage.trim(),
      time: new Date().toLocaleTimeString(),
    };
    setChatboxStates((prev) => {
      const updatedMessages = [...(prev[ticketId]?.messages || []), newMessageObject];
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
  };

  // Minimize and close logic
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

  // Drag logic
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
    // Clamp
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
  const closeTicket = async (ticketId) => {
    if (!window.confirm("Are you sure you want to close this ticket?")) return;
    try {
      const response = await fetch(`http://localhost:5002/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await response.json();
      if (data.success) {
        setDriverTickets((prev) =>
          prev.map((t) =>
            t.ticketId === ticketId ? { ...t, status: "closed" } : t
          )
        );
        // Notify all in the room that the ticket is closed
        socket.emit("sendMessage", {
          ticketId,
          sender: "system",
          message: "This ticket has been closed. No further messages can be sent.",
          timestamp: new Date().toISOString(),
        });
        // Bot and System closing messages
        socket.emit("sendMessage", {
          ticketId,
          sender: "🤖 Bot",
          message: "Thank you, have a good day!",
          timestamp: new Date().toISOString(),
        });
        socket.emit("sendMessage", {
          ticketId,
          sender: "💻 System",
          message: "Live chat ended. Start a new issue to reopen support.",
          timestamp: new Date().toISOString(),
        });
        setSelectedTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
        setChatboxStates((prev) => {
          const newState = { ...prev };
          delete newState[ticketId];
          return newState;
        });
      } else {
        alert("Failed to close ticket. Please try again.");
      }
    } catch {
      alert("Error closing ticket. Please try again.");
    }
  };
  const handleStatusChange = async (ticketId, newStatus) => {
    setDriverTickets((prevTickets) => {
      // Optimistically update the UI for immediate feedback
      const updatedTickets = prevTickets.map((ticket) =>
        ticket.ticketId === ticketId ? { ...ticket, status: newStatus } : ticket
      );
      return updatedTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
    try {
      const response = await axios.put(`http://localhost:5002/api/tickets/${ticketId}`, { status: newStatus });
      if (response.data.success) {
        // Optionally, update again with backend response if needed
      }
    } catch (error) {
      console.error("Error updating ticket status:", error);
    }
  };

  return (
    <div>
    <div className="total-tickets-page">
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "24px",
          zIndex: 1100,
        }}
      >
        <Link to="/dashboard" className="back-to-dashboard">
          ← Back
        </Link>
      </div>
      <h1>Customer Tickets</h1>
      <div className="total-tickets-table">
        <table>
          <thead style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 1000 }}>
            <tr>
            <th style={{ minWidth: "140px" }}>Ticket ID</th>
                <th style={{ minWidth: "150px" }}>Issue</th>
                <th style={{ minWidth: "150px" }}>Sub Issue</th>
                <th style={{ minWidth: "100px" }}>Status</th>
                <th style={{ minWidth: "100px" }}>Created At</th>
                <th style={{ minWidth: "100px" }}>Updated At</th>
                <th style={{ minWidth: "150px" }}>Name</th>
                <th style={{ minWidth: "150px" }}>Number</th>
            </tr>
          </thead>
          <tbody>
          {drivertickets.map((ticket) => (
  <tr key={ticket.ticketId}>
    <td>
      <button className="action-btn" onClick={() => handleTicketSelect(ticket)}>
        {ticket.ticketId}
      </button>
    </td>
    <td>{ticket.issue}</td>
      <td>{ticket.subissue || "No message provided"}</td>
    <td>
      <select
        className="status-dropdown"
        value={ticket.status}
        onChange={(e) => handleStatusChange(ticket.ticketId, e.target.value)}
        disabled={ticket.status === "closed"}
      >
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="waiting for response">Waiting for Response</option>
        <option value="closed">Closed</option>
      </select>
    </td>
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
      {/* Render each chatbox as position: fixed, side by side on the right */}
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
  </div>
  );
};

export default CustomerTickets;
