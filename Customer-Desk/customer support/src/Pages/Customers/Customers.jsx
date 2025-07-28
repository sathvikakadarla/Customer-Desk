import { useEffect, useState } from "react";
import axios from "axios";
import "./Customers.css";
import { useSearchParams } from "react-router-dom";

const Customer = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(""); // For filtering orders
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get("http://localhost:5002/api/orders");
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
  function filterOrders(key,value){
    const params=new URLSearchParams(search);
    if(value){
      params.set(key,value);
      setFilterStatus(value)
    }else{
      params.delete(key);
      setFilterStatus("")
    }
    setSearch(params);
  }

  useEffect(() => {
    console.log(orders);
  }, [orders]);

  const filteredOrders = filterStatus
    ? orders.filter((order) => order.status=== filterStatus)
    : orders;

  if (loading) {
    return <div>Loading orders...</div>;
  }

  return (
    <div>
      <h1>All Orders</h1>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <div>
          {/* Filter indicator at the top */}
          {filterStatus && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginTop: 16,
              padding: '10px 0',
              width: '100%',
              maxWidth: '1450px',
              marginLeft: '80px',
            }}>
            </div>
          )}
          {/* Filter Bar */}
          <div className="filter-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'flex-end' }}>
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

          {/* Table */}
          <div style={{
            width: '100%',
            maxWidth: '1450px',
            marginLeft: '80px',
            height: '500px',
            overflow: 'auto',
            position: 'relative',
            borderRadius: 8,
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
            background: '#fff',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
                  <th style={{ width: '80px' }}>First Name</th>
                  <th style={{ width: '80px' }}>Last Name</th>
                  <th style={{ width: '140px' }}>Email</th>
                  <th style={{ width: '140px' }}>Street</th>
                  <th style={{ width: '100px' }}>City</th>
                  <th style={{ width: '100px' }}>State</th>
                  <th style={{ width: '80px' }}>Zipcode</th>
                  <th style={{ width: '100px' }}>Country</th>
                  <th style={{ width: '120px' }}>Phone</th>
                  <th style={{ width: '120px' }}>Order ID</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '80px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <tr key={order._id}>
                      <td data-label="First Name">{order.address.firstName}</td>
                      <td data-label="Last Name">{order.address.lastName}</td>
                      <td data-label="Email">{order.address.email}</td>
                      <td data-label="Street">{order.address.street}</td>
                      <td data-label="City">{order.address.city}</td>
                      <td data-label="State">{order.address.state}</td>
                      <td data-label="Zipcode">{order.address.zipcode}</td>
                      <td data-label="Country">{order.address.country}</td>
                      <td data-label="Phone">{order.address.phone}</td>
                      <td data-label="Order ID">{order.orderId}</td>
                      <td data-label="Status">{order.status}</td>
                      <td data-label="Amount">₹{order.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center' }}>No orders found for this status.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customer;
