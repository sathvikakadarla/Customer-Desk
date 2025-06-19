import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./TotalTickets.css";

const socket = io("https://customer-desk-backend.onrender.com");

const TotalTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [openChats, setOpenChats] = useState([]); // [{ticket, messages, newMessage, isChatMinimized}]
  const messagesEndRef = useRef(null);

  // Fetch tickets on component mount and sort by LCFS
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch("https://customer-desk-backend.onrender.com/api/tickets");
        const data = await response.json();
        if (data.success) {
          // Sort tickets by createdAt in descending order (LCFS)
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

  // Debug: Log when socket connects
  useEffect(() => {
    socket.on("connect", () => {
      console.log("[SOCKET] Connected to server with id:", socket.id);
    });
    return () => {
      socket.off("connect");
    };
  }, []);

  // Listen for incoming messages for any open chatbox
  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setOpenChats((prev) =>
        prev.map((chat) =>
          chat.ticket.ticketId === data.ticketId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { sender: data.sender, text: data.message, time: new Date(data.timestamp).toLocaleTimeString() },
                ],
              }
            : chat
        )
      );
      // Save to localStorage
      const chat = openChats.find((c) => c.ticket.ticketId === data.ticketId);
      if (chat) {
        const updatedMessages = [
          ...chat.messages,
          { sender: data.sender, text: data.message, time: new Date(data.timestamp).toLocaleTimeString() },
        ];
        localStorage.setItem(`chat_${data.ticketId}`, JSON.stringify(updatedMessages));
      }
    });
    return () => {
      socket.off("receiveMessage");
    };
  }, [openChats]);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openChats]);

  // Handle opening a chatbox for a ticket
  const getMaxChats = () => (window.innerWidth <= 900 ? 1 : 2);

  const handleTicketSelect = (ticket) => {
    // Prevent duplicate chatboxes
    if (openChats.some((chat) => chat.ticket.ticketId === ticket.ticketId)) return;
    // Limit to max open chatboxes based on screen size
    if (openChats.length >= getMaxChats()) return;
    // Load messages from localStorage if available
    const storedMessages =
      JSON.parse(localStorage.getItem(`chat_${ticket.ticketId}`)) || [
        { sender: "system", text: "You are now connected to the ticket chat." },
        { sender: "system", text: "Waiting for customer to connect..." },
      ];
    setOpenChats((prev) => [
      ...prev,
      {
        ticket,
        messages: storedMessages,
        newMessage: "",
        isChatMinimized: false,
      },
    ]);
    // Join the ticket room
    socket.emit("joinTicket", { ticketId: ticket.ticketId, role: "agent" });
  };

  // Listen for window resize to update chat limit
  useEffect(() => {
    const handleResize = () => {
      if (getMaxChats() === 1 && openChats.length > 1) {
        // Keep only the most recently opened chat
        setOpenChats((prev) => [prev[prev.length - 1]]);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [openChats]);

  // Handle closing a chatbox
  const handleCloseChat = (ticketId) => {
    setOpenChats((prev) => prev.filter((chat) => chat.ticket.ticketId !== ticketId));
    socket.emit("leaveTicket", { ticketId });
  };

  // Handle minimize
  const handleMinimizeChat = (ticketId) => {
    setOpenChats((prev) =>
      prev.map((chat) =>
        chat.ticket.ticketId === ticketId
          ? { ...chat, isChatMinimized: !chat.isChatMinimized }
          : chat
      )
    );
  };

  // Handle sending a message in a chatbox
  const sendMessage = (ticketId) => {
    const chat = openChats.find((c) => c.ticket.ticketId === ticketId);
    if (!chat || !chat.newMessage.trim()) return;
    const messageData = {
      ticketId,
      sender: "support",
      message: chat.newMessage.trim(),
      timestamp: new Date().toISOString(),
      role: "agent",
    };
    socket.emit("sendMessage", messageData, () => {});
    const newMessageObject = {
      sender: "support",
      text: chat.newMessage.trim(),
      time: new Date().toLocaleTimeString(),
    };
    setOpenChats((prev) =>
      prev.map((c) =>
        c.ticket.ticketId === ticketId
          ? {
              ...c,
              messages: [...c.messages, newMessageObject],
              newMessage: "",
            }
          : c
      )
    );
    // Save to localStorage
    const updatedMessages = [...chat.messages, newMessageObject];
    localStorage.setItem(`chat_${ticketId}`, JSON.stringify(updatedMessages));
  };

  return (
    <div className="total-tickets-page">
      <div className="total-tickets-container">
        <h2>Total Tickets</h2>
        <table className="total-tickets-table">
          <thead>
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

      {/* Render chatboxes side by side */}
      <div className="chatbox-row">
        {openChats.map((chat) => (
          <div
            key={chat.ticket.ticketId}
            className={`chat-box ${chat.isChatMinimized ? "minimized" : ""}`}
          >
            <div className="chat-header" onClick={() => handleMinimizeChat(chat.ticket.ticketId)}>
              <h2>{chat.ticket.userName} - Ticket {chat.ticket.ticketId}</h2>
              <button className="minimize-chat">{chat.isChatMinimized ? "🔼" : "🔽"}</button>
              <button className="close-chat" onClick={() => handleCloseChat(chat.ticket.ticketId)}>✖</button>
            </div>
            {!chat.isChatMinimized && (
              <>
                <div className="chat-messages">
                  {chat.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`chat-message ${msg.sender === "support" ? "support-message" : "user-message"}`}
                    >
                      <strong>{msg.sender}:</strong> {msg.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="chat-input-container">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={chat.newMessage}
                    onChange={(e) =>
                      setOpenChats((prev) =>
                        prev.map((c) =>
                          c.ticket.ticketId === chat.ticket.ticketId
                            ? { ...c, newMessage: e.target.value }
                            : c
                        )
                      )
                    }
                    className="chat-input"
                  />
                  <button onClick={() => sendMessage(chat.ticket.ticketId)} className="send-btn">
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TotalTickets;
