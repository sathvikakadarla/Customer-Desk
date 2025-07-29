// src/pages/Dashboard.jsx
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';

import './Dashboard.css';
import PropTypes from 'prop-types';

// Simple toast component
const Toast = ({ message, onClose }) => (
  <div style={{
    position: 'fixed',
    top: 32,
    right: 32,
    background: '#2563eb',
    color: '#fff',
    padding: '16px 32px',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    zIndex: 9999,
    fontWeight: 500,
    fontSize: 18,
    transition: 'opacity 0.3s',
  }}>
    {message}
    <button onClick={onClose} style={{ marginLeft: 24, background: 'none', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer' }}>✖</button>
  </div>
);

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

const Dashboard = () => {
    const [tickets, setTickets] = useState({
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        pendingTickets: 0,
        driverTickets: 0,
        waitingOnCustomerTickets: 0
    });
    const [filteredTickets, setFilteredTickets] = useState({
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        pendingTickets: 0,
        driverTickets: 0,
        waitingOnCustomerTickets: 0
    });
    const [toast, setToast] = useState(null);
    const prevTotalTickets = useRef(null); // null means "not set yet"
    const didInitialFetch = useRef(false);

    useEffect(() => {
      const fetchTickets = async () => {
        try {
          const response = await fetch("https://customer-desk-backend.onrender.com/api/tickets");
          const data = await response.json();
          if (data.success) {
            const totalTickets = data.tickets.length;
            const openTickets = data.tickets.filter(ticket => ticket.status === "open").length;
            const closedTickets = data.tickets.filter(ticket => ticket.status === "closed").length;
            const pendingTickets = data.tickets.filter(ticket => ticket.status === "pending").length;
            const waitingOnCustomerTickets = data.tickets.filter(ticket => ticket.status === "waiting for response").length;
            const driverTickets = data.tickets.filter(ticket => ticket.type === "driver").length;
            
            const ticketStats = { 
                totalTickets, 
                openTickets, 
                closedTickets, 
                pendingTickets, 
                driverTickets,
                waitingOnCustomerTickets 
            };
            setTickets(ticketStats);
            setFilteredTickets(ticketStats);
            // Only compare after the first fetch
            if (didInitialFetch.current && prevTotalTickets.current !== null) {
              if (totalTickets > prevTotalTickets.current) {
                setToast("A new ticket has been created!");
              }
            }
            prevTotalTickets.current = totalTickets;
            didInitialFetch.current = true;
          }
        } catch (error) {
          console.error("Error fetching ticket data:", error);
        }
      };
      fetchTickets();
      const interval = setInterval(fetchTickets, 5000);
      return () => clearInterval(interval);
    }, []);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
      if (toast) {
        const timer = setTimeout(() => setToast(null), 8000);
        return () => clearTimeout(timer);
      }
    }, [toast]);

    return (
        <div className="dashboard-container">
            {toast && <Toast message={toast} onClose={() => setToast(null)} />}
            <h2>Dashboard</h2>
            
            <div className="ticket-stats" style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <div className="ticket-row">
                    <Link to="/total-tickets" className="ticket-stat total-tickets">
                        <h3>Total Tickets</h3>
                        <p>{filteredTickets.totalTickets}</p>
                    </Link>
                    <Link to="/open-tickets" className="ticket-stat open-tickets">
                    <h3>Open Tickets</h3>
                    <p>{filteredTickets.openTickets}</p>
                    </Link>

                </div>
                <div className="ticket-row">
                    <Link to="/closed-tickets" className="ticket-stat closed-tickets">
                        <h3>Closed Tickets</h3>
                        <p>{filteredTickets.closedTickets}</p>
                    </Link>
                    <Link to="/pending-tickets" className="ticket-stat pending-tickets">
                        <h3>Pending Tickets</h3>
                        <p>{filteredTickets.pendingTickets}</p>
                    </Link>
                </div>
                <div className="ticket-row">
                    <Link to="/driver-tickets" className="ticket-stat driver-tickets">
                        <h3>Driver Tickets</h3>
                        <p>{filteredTickets.driverTickets}</p>
                    </Link>
                    <Link to="/waiting-on-customer" className="ticket-stat waiting-on-customer">
                    <h3>Waiting for response</h3>
                    <p>{filteredTickets.waitingOnCustomerTickets}</p>
                    </Link>

                    
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
