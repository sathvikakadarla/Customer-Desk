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
    <div className="closed-tickets-page">
      <h1>Closed Tickets</h1>
      <div className="closed-tickets-table">
        <table>
          <thead style={{position: 'sticky',top: 0,backgroundColor: 'white',zIndex: 1000,borderRadius: '8px'}}>
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
        {closedTickets.map((ticket) => (
          <tr key={ticket.ticketId}>
            <td>{ticket.ticketId}</td>
            <td>{ticket.issue}</td>
            <td>{ticket.status}</td>
                <td>{ticket.userMessage || "No message provided"}</td>
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
        <Link to="/dashboard" className="back-to-dashboard">
          Back to Dashboard
        </Link>
      </div>
  );
}
export default ClosedTickets;
