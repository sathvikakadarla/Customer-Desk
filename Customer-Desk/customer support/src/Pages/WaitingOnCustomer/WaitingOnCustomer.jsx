import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import "./WaitingOnCustomer.css";

const socket = io("https://customer-desk-backend.onrender.com");

const defaultChatboxState = (initPos = null) => ({
  dragging: false,
  dragOffset: null,
  isChatMinimized: false,
  messages: [],
  newMessage: "",
  position: initPos, // { left, top }
});

const WaitingOnCustomer = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]); // Array of ticket objects
  const [chatboxStates, setChatboxStates] = useState({}); // { [ticketId]: { ...state } }
  const chatBoxRefs = useRef({});
  const messagesEndRefs = useRef({});
  const hasMounted = useRef(false);

  // Fetch tickets waiting for customer response on component mount
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get("https://customer-desk-backend.onrender.com/api/tickets");
        if (response.data.success) {
          const waitingTickets = response.data.tickets
            .filter((ticket) => ticket.status === "waiting for response")
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setTickets(waitingTickets);
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

  // Draggable logic for each chatbox header
  useEffect(() => {
    selectedTickets.forEach((ticket) => {
      const chatEl = chatBoxRefs.current[ticket.ticketId];
      if (!chatEl) return;
      const header = chatEl.querySelector('.chat-header');
      if (!header) return;
      const onMouseDown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const rect = chatEl.getBoundingClientRect();
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
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
      const onMouseMove = (e) => {
        setChatboxStates((prev) => {
          if (!prev[ticket.ticketId]?.dragging) return prev;
          const chatboxWidth = 500;
          const chatboxHeight = 420; // Assuming a fixed height for now
          const minLeft = 0;
          const minTop = 0;
          const maxLeft = window.innerWidth - chatboxWidth;
          const maxTop = window.innerHeight - chatboxHeight;
          let left = e.clientX - (prev[ticket.ticketId]?.dragOffset?.x || 0);
          let top = e.clientY - (prev[ticket.ticketId]?.dragOffset?.y || 0);
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
      header.addEventListener("mousedown", onMouseDown);
      return () => {
        header.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    });
  }, [selectedTickets, chatboxStates]);

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
        setTickets((prev) =>
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

  useEffect(() => {
    if (hasMounted.current) {
      // This effect will only run after the component has mounted and the initial tickets have been set.
      // It will not run on initial load or navigation to the dashboard.
      // The toast will only appear if tickets.totalTickets increases after the initial load.
    } else {
      hasMounted.current = true;
    }
  }, [tickets.totalTickets]);

  return (
    <div>
      <div className="waiting-on-customer-page">
          <h1>Tickets Waiting for Customer Response</h1>
          <div className="waiting-ticket-table">
            <table>
              <thead style={{position: 'sticky',top: 0,backgroundColor: 'white',zIndex: 1000}}>
                <tr>
                  <th>Ticket ID</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>User Message</th>
                  <th>Created At</th>
                  <th>Updated At</th>
                  <th>User</th>
                  <th>Mobile Number</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length > 0 ? (
                  tickets.map((ticket) => (
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
                    No tickets are currently waiting for customer response.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
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
                <h2>Support Chat- Ticket {ticket.ticketId}</h2>
                <button className="minimize-chat" onClick={() => toggleMinimize(ticket.ticketId)}>{chatState.isChatMinimized ? "🔼" : "🔽"}</button>
                <button className="close-ticket-btn" onClick={() => closeTicket(ticket.ticketId)} title="End Chat">
                  💬 End Chat
                </button>
                <button className="close-chat" onClick={() => closeChatbox(ticket.ticketId)}>✖</button>
              </div>
              {!chatState.isChatMinimized && (
                <>
                  <div className="chat-messages">
                    {chatState.messages.map((msg, index) => {
                      const isSupport = msg.sender === "support";
                      const senderName = isSupport ? "Support" : ticket.userName || msg.sender;
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
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <Link to="/dashboard" className="back-button">Back to Dashboard</Link>
      </div>
    </div>
  );
};

export default WaitingOnCustomer;
