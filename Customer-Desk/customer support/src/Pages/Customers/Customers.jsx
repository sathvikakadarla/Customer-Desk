import { useEffect, useState } from "react";
import axios from "axios";
import "./Customers.css"; // Using the same stylesheet for consistency
import { useSearchParams, Link } from "react-router-dom";

const Customer = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useSearchParams();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get("https://customer-desk-backend.onrender.com/api/orders");
        if (response.data.success) {
          setOrders(response.data.data);
        } else {
          console.error(response.data.message);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);
  
  const filterOrders = (key, value) => {
    const params = new URLSearchParams(search);
    if (value) {
      params.set(key, value);
      setFilterStatus(value);
    } else {
      params.delete(key);
      setFilterStatus("");
    }
    setSearch(params);
  };

  const filteredOrders = filterStatus
    ? orders.filter((order) => order.status === filterStatus)
    : orders;

  if (loading) {
    return <div>Loading orders...</div>;
  }

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
        </div>
        <h1>All Orders</h1>
        
        {/* Table Container - fits screen width */}
        <div className="total-tickets-table" style={{ maxWidth: '100%' }}>
          <table style={{ width: '100%' }}>
            <thead style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 1000 }}>
              <tr>
                <th style={{ minWidth: "87px" }}>Order ID</th>
                <th style={{ minWidth: "87px" }}>First Name</th>
                <th style={{ minWidth: "87px" }}>Last Name</th>
                <th style={{minWidth: "200px"}}>Email</th>
                <th style={{minWidth: "87px" }}>Street</th>
                <th style={{ minWidth: "87px"}}>City</th>
                <th style={{ minWidth: "87px"}}>State</th>
                <th style={{minWidth: "87px" }}>Zipcode</th>
                <th style={{minWidth: "87px"}}>Country</th>
                <th style={{minWidth: "87px"}}>Phone</th>
                <th style={{ minWidth: "87px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "20px" }}>
                    No orders found
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => (
                <tr key={order._id}>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.orderId}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.firstName || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.lastName || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.email || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.street || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.city || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.state || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.zipcode || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.country || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>{order.address?.phone || "N/A"}</td>
                  <td style={{ wordBreak: 'break-word', fontSize: '13px', padding: '8px 4px' }}>₹{order.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Bar - Positioned outside the table container */}
      {orders.length > 0 && (
        <div className="filter-container" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          marginBottom: '1.5rem', 
          justifyContent: 'flex-end',
          position: 'absolute',
          top: '80px',
          right: '20px',
          zIndex: 1001
        }}>
          <label htmlFor="status" style={{ fontWeight: 500, marginRight: 8 }}>Status:</label>
          <select
            name="status"
            id="status"
            value={filterStatus}
            onChange={(e) => filterOrders("status", e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#f8f9fa',
              fontSize: 14,
              fontWeight: 500,
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              minWidth: 180,
              transition: 'border-color 0.2s',
            }}
          >
            <option value="">All</option>
            <option value="Delivered">Delivered</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Food Processing">Food Processing</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default Customer;
