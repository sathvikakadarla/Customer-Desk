import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import "./CustomerTickets.css";

const socket = io("https://customer-desk-backend.onrender.com");

const CustomerTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [openChats, setOpenChats] = useState([]); // [{ticket, messages, newMessage, isChatMinimized}]
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get("https://customer-desk-backend.onrender.com/api/tickets");
        if (response.data.success) {
          const sortedTickets = response.data.tickets.sort((a, b) =>
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
    const handleReceiveMessage = (data) => {
      console.log('[SOCKET][receiveMessage]', data); // Debug: log every received message
      setOpenChats((prev) => {
        const updated = prev.map((chat) =>
          chat.ticket.ticketId === data.ticketId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { sender: data.sender, text: data.message, time: new Date(data.timestamp).toLocaleTimeString() },
                ],
              }
            : chat
        );
        // Save to localStorage
        const chat = updated.find((c) => c.ticket.ticketId === data.ticketId);
        if (chat) {
          localStorage.setItem(
            `chat_${data.ticketId}`,
            JSON.stringify(chat.messages)
          );
        }
        return updated;
      });
    };
    socket.on("receiveMessage", handleReceiveMessage);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, []); // Register only once

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openChats]);

  // Responsive chatbox limit
  const getMaxChats = () => (window.innerWidth <= 900 ? 1 : 2);

  // Open chatbox for a ticket
  const handleTicketSelect = (ticket) => {
    if (openChats.some((chat) => chat.ticket.ticketId === ticket.ticketId)) return;
    if (openChats.length >= getMaxChats()) return;
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
    socket.emit("joinTicket", { ticketId: ticket.ticketId, role: "agent" });
  };

  // Listen for window resize to update chat limit
  useEffect(() => {
    const handleResize = () => {
      if (getMaxChats() === 1 && openChats.length > 1) {
        setOpenChats((prev) => [prev[prev.length - 1]]);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [openChats]);

  // Close chatbox
  const handleCloseChat = (ticketId) => {
    console.log('[SOCKET][leaveTicket] Emitting leaveTicket for', ticketId); // Debug log
    socket.emit("leaveTicket", { ticketId }, (response) => {
      console.log('[SOCKET][leaveTicket] Server response:', response);
    });
    setOpenChats((prev) => prev.filter((chat) => chat.ticket.ticketId !== ticketId));
  };

  // Minimize chatbox
  const handleMinimizeChat = (ticketId) => {
    setOpenChats((prev) =>
      prev.map((chat) =>
        chat.ticket.ticketId === ticketId
          ? { ...chat, isChatMinimized: !chat.isChatMinimized }
          : chat
      )
    );
  };

  // Send message in chatbox
  const sendMessage = (ticketId) => {
    const chat = openChats.find((c) => c.ticket.ticketId === ticketId);
    if (!chat || !chat.newMessage.trim()) return;
    // TODO: Set sender/role based on actual user type
    const messageData = {
      ticketId,
      sender: "support", // Change this to "user" if this is a customer
      message: chat.newMessage.trim(),
      timestamp: new Date().toISOString(),
      role: "agent", // Change this to "customer" or "user" if this is a customer
    };
    console.log('[SOCKET][sendMessage]', messageData); // Debug: log every sent message
    socket.emit("sendMessage", messageData, () => {});
    const newMessageObject = {
      sender: messageData.sender,
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

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const response = await axios.put(`https://customer-desk-backend.onrender.com/api/tickets/${ticketId}`, { status: newStatus });
      if (response.data.success) {
        setTickets((prevTickets) => {
          const updatedTickets = prevTickets.map((ticket) =>
            ticket.ticketId === ticketId ? { ...ticket, status: newStatus } : ticket
          );
          return updatedTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });
      }
    } catch (error) {
      console.error("Error updating ticket status:", error);
    }
  };

  return (
    <div className="ticket-page">
      <div className="ticket-table-container">
        <h1>Customer Tickets</h1>
        <table className="ticket-table">
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
                <td>
                  <select
                    className="status-dropdown"
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(ticket.ticketId, e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="waiting for response">Waiting for Response</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
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
                      className={`chat-message ${msg.sender === "user" ? "user-message" : "support-message"}`}
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

export default CustomerTickets;
