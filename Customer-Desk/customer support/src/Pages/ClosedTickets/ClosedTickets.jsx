import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ClosedTickets.css";

const ClosedTickets = () => {
  const [closedTickets, setClosedTickets] = useState([]);

  useEffect(() => {
    const fetchClosedTickets = async () => {
      try {
        const response = await fetch("https://customer-desk-backend.onrender.com/api/tickets");
        const data = await response.json();
        if (data.success) {
          const closedTickets = data.tickets
            .filter((ticket) => ticket.status === "closed")
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setClosedTickets(closedTickets);
        }
      } catch (error) {
        console.error("Error fetching closed tickets:", error);
      }
    };
    fetchClosedTickets();
  }, []);

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
      <h1>Closed Tickets</h1>
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
        {closedTickets.map((ticket) => (
          <tr key={ticket.ticketId}>
            <td>{ticket.ticketId}</td>
            <td>{ticket.issue}</td>
                <td>{ticket.userMessage || "No message provided"}</td>
            <td>{ticket.status}</td>
                <td>{new Date(ticket.createdAt).toLocaleString()}</td>
                <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
                <td>{ticket.userName || "N/A"}</td>
                <td>{ticket.mobileNumber || "N/A"}</td>
              </tr>
            ))
          }
        {closedTickets.length===0?<tr><td colSpan="8" style={{ textAlign: "center" }}>No closed tickets found.</td></tr>:null}

          </tbody>
        </table>
      </div>
      </div>
      </div>
  );
}
export default ClosedTickets;
