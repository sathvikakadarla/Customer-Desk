import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./DriverTickets.css";
import { Link } from "react-router-dom";

const socket = io("https://customer-desk-backend.onrender.com");

const defaultChatboxState = (initPos = null) => ({
  dragging: false,
  dragOffset: null,
  isChatMinimized: false,
  messages: [],
  newMessage: "",
  position: initPos, // { left, top }
});

const DriverTickets = () => {
  const [pendingTickets, setPendingTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]); // Array of ticket objects
  const [chatboxStates, setChatboxStates] = useState({}); // { [ticketId]: { ...state } }
  const messagesEndRefs = useRef({});

  // Fetch pending tickets on component mount
  useEffect(() => {
    const fetchPendingTickets = async () => {
      try {
        const response = await axios.get("http://localhost:5002/api/tickets");
        if (response.data.success) {
          const pending = response.data.tickets
            .filter((ticket) => ticket.status === "delivery")
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setPendingTickets(pending);
        }
      } catch (error) {
        console.error("Error fetching pending tickets:", error);
      }
    };
    fetchPendingTickets();
  }, []);

  // Handle real-time messaging with Socket.IO
  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      socket.on(`receiveMessage_${ticket.ticketId}`, (data) => {
        setChatboxStates((prev) => {
          const messageTime = data.time || new Date(data.timestamp || Date.now()).toLocaleTimeString();
          const updatedMessages = [...(prev[ticket.ticketId]?.messages || []), { sender: data.sender, text: data.message, time: messageTime }];
          localStorage.setItem(`chat_${ticket.ticketId}`, JSON.stringify(updatedMessages));
          return {
            ...prev,
            [ticket.ticketId]: {
              ...prev[ticket.ticketId],
              messages: updatedMessages,
            },
          };
        });
      });
    });

    return () => {
      selectedTickets.forEach((ticket) => {
        socket.emit("leaveTicket", { ticketId: ticket.ticketId });
        socket.off(`receiveMessage_${ticket.ticketId}`);
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
    setSelectedTickets((prev) => {
      if (prev.some((t) => t.ticketId === ticket.ticketId)) return prev;
      return [...prev, ticket];
    });
    setChatboxStates((prev) => {
      if (prev[ticket.ticketId]) return prev;
      const idx = selectedTickets.length;
      const chatboxWidth = 500;
      const left = Math.max(24, window.innerWidth - 24 - (chatboxWidth + 16) * idx - chatboxWidth);
      const top = 100;
      const storedMessages =
        JSON.parse(localStorage.getItem(`chat_${ticket.ticketId}`)) || [
          { sender: "system", text: "You are now connected to the ticket chat." },
          { sender: "system", text: "Waiting for customer to connect..." },
        ];
      return {
        ...prev,
        [ticket.ticketId]: {
          ...defaultChatboxState({ left, top }),
          messages: storedMessages,
        },
      };
    });
  };

  // Send a new message
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

  // Add closeTicket function
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
        setPendingTickets((prev) =>
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

  return (
    <div className="pending-tickets-page">
      <div className="pending-tickets-container">
        <h1>Driver Tickets</h1>
        <div className="pending-tickets-table">
        <table>
          <thead style={{position: 'sticky',top: 0,backgroundColor: 'white',zIndex: 1000}}>
            <tr>
              <th>Ticket ID</th>
              <th>Issue</th>
              <th>Status</th>
              <th>User Message</th>
              <th>Created At</th>
              <th>Updated At</th>
              <th>User Name</th>
              <th>Mobile Number</th>
            </tr>
          </thead>
          <tbody>
            {pendingTickets.length > 0 ? (
              pendingTickets.map((ticket) => (
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
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  No Driver tickets are available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
            </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0',position: 'fixed',bottom: '24px',right: '680px' }}>
        <Link to="/dashboard" className="back-button">Back to Dashboard</Link>
      </div>
      {selectedTickets.map((ticket, idx) => {
        const chatState = chatboxStates[ticket.ticketId] || defaultChatboxState();
        const chatboxWidth = 500;
        const minWidth = 500;
        const maxWidth = 500;
        const { left, top } = chatState.position || {};
        return (
          <div
            key={ticket.ticketId}
            className={`chat-box${chatState.isChatMinimized ? " minimized" : ""}`}
            style={{
              position: "fixed",
              left: left ?? (window.innerWidth - 24 - (chatboxWidth + 16) * idx - chatboxWidth),
              top: top ?? 100,
              width: chatboxWidth,
              minWidth,
              maxWidth,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              background: "#fff",
              borderRadius: 12,
              zIndex: 2000 + idx,
              cursor: chatState.dragging ? "grabbing" : "default",
              userSelect: chatState.dragging ? "none" : "auto",
              transition: chatState.dragging ? "none" : "box-shadow 0.2s",
            }}
          >
            <div
              className="chat-header"
              style={{ cursor: "grab" }}
              onMouseDown={(e) => {
                if (e.target.tagName === 'BUTTON') return;
                const rect = e.currentTarget.parentNode.getBoundingClientRect();
                const dragOffset = {
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                };
                setChatboxStates((prev) => ({
                  ...prev,
                  [ticket.ticketId]: {
                    ...prev[ticket.ticketId],
                    dragging: true,
                    dragOffset,
                    position: { left: rect.left, top: rect.top },
                  },
                }));
                const onMouseMove = (moveEvent) => {
                  setChatboxStates((prev) => {
                    if (!prev[ticket.ticketId]?.dragging) return prev;
                    const chatboxWidth = 500;
                    const chatboxHeight = 500;
                    const minLeft = 0;
                    const minTop = 0;
                    const maxLeft = window.innerWidth - chatboxWidth;
                    const maxTop = window.innerHeight - chatboxHeight;
                    let left = moveEvent.clientX - (prev[ticket.ticketId]?.dragOffset?.x || 0);
                    let top = moveEvent.clientY - (prev[ticket.ticketId]?.dragOffset?.y || 0);
                    if (left < minLeft) left = minLeft;
                    if (left > maxLeft) left = maxLeft;
                    if (top < minTop) top = minTop;
                    if (top > maxTop) top = maxTop;
                    return {
                      ...prev,
                      [ticket.ticketId]: {
                        ...prev[ticket.ticketId],
                        position: { left, top },
                      },
                    };
                  });
                };
                const onMouseUp = () => {
                  setChatboxStates((prev) => ({
                    ...prev,
                    [ticket.ticketId]: {
                      ...prev[ticket.ticketId],
                      dragging: false,
                      dragOffset: null,
                    },
                  }));
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            >
              <h2>Support Chat - Ticket {ticket.ticketId}</h2>
              <button className="minimize-chat" onClick={() => toggleMinimize(ticket.ticketId)}>{chatState.isChatMinimized ? "🔼" : "🔽"}</button>
              <button className="close-ticket-btn" onClick={() => closeTicket(ticket.ticketId)} title="Close Ticket">
                🗂️ Close Ticket
              </button>
              <button className="close-chat" onClick={() => closeChatbox(ticket.ticketId)}>
                ✖
              </button>
            </div>
            {!chatState.isChatMinimized && (
              <>
                <div className="chat-messages">
                  {chatState.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`chat-message ${msg.sender === "support" ? "support-message" : "user-message"}`}
                    >
                      <strong>{msg.sender}:</strong> {msg.text}
                    </div>
                  ))}
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
                        sendMessage(ticket.ticketId);
                      }
                    }}
                  />
                  <button onClick={() => sendMessage(ticket.ticketId)} className="send-btn">Send</button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DriverTickets;
