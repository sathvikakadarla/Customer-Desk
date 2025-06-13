import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import orderRoute from "./routes/orderRoute.js";
import ticketRoute from "./routes/ticketRoute.js";
import userModel from "./model/userModel.js";

dotenv.config();

// App configuration
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// --- Role-based room tracking ---
const ticketRoomRoles = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a ticket room with role
  socket.on("joinTicket", ({ ticketId, role }) => {
    socket.join(ticketId);
    if (!ticketRoomRoles[ticketId]) ticketRoomRoles[ticketId] = {};
    ticketRoomRoles[ticketId][socket.id] = role;
    console.log(`Socket ${socket.id} joined room: ${ticketId} as ${role}`);
    
  });

  // Leave a ticket room
  socket.on("leaveTicket", ({ ticketId }) => {
    socket.leave(ticketId);
    if (ticketRoomRoles[ticketId]) delete ticketRoomRoles[ticketId][socket.id];
    console.log(`Socket ${socket.id} left room: ${ticketId}`);
    setTimeout(() => {
      const clientsInRoom = io.sockets.adapter.rooms.get(ticketId);
      const numClients = clientsInRoom ? clientsInRoom.size : 0;
      console.log(`After leave: Ticket room ${ticketId} has ${numClients} client(s) connected.`);
    }, 0);
  });

  // Send message to a specific ticket room
  socket.on("sendMessage", (data, callback) => {
    console.log("[SOCKET] Message received:", data); // Log incoming message
    if (data.ticketId) {
      // Log number of clients in the room
      const clientsInRoom = io.sockets.adapter.rooms.get(data.ticketId);
      const numClients = clientsInRoom ? clientsInRoom.size : 0;
      console.log(` h ${data.ticketId} ${numClients} client(s) connected.`);
      const tid= data.ticketId;
      if (numClients <= 1) {
        console.log(` 1 sending system message.`)
        io.to(tid).emit("receiveMessage", {
        ticketId:tid,
        sender: "system",
        message: "Your system message here",
        timestamp: new Date().toISOString(),
        role: "system"
      });
        if (callback) callback({ status: "ok", message: "System message sent" });
        return;
      }
      socket.to(data.ticketId).emit("receiveMessage", data);
      if (callback) callback({ status: "ok" });
    }
  });

  socket.on("disconnect", () => {
    // Remove socket from all ticketRoomRoles
    for (const ticketId in ticketRoomRoles) {
      if (ticketRoomRoles[ticketId][socket.id]) {
        delete ticketRoomRoles[ticketId][socket.id];
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Routes
app.use("/api/orders", orderRoute);
app.use("/api/tickets", ticketRoute);

// API endpoint to handle user login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (isPasswordCorrect) {
      res.status(200).json({ success: true, message: "Login successful" });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Base route for testing
app.get("/", (req, res) => {
  res.send("API Working");
});

// Server start
server.listen(port, () =>
  console.log(`Server started on http://localhost:${port}`)
);
