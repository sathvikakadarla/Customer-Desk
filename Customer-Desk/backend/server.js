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
const port = process.env.PORT || 5000;

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173",
  "https://customer-desk-frontend.onrender.com"
];

// CORS middleware (HTTP)
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// JSON parsing
app.use(express.json());

// DB connection
connectDB();

// WebSocket setup
export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("sendMessage", (data) => {
    io.emit("receiveMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Routes
app.use("/api/orders", orderRoute);
app.use("/api/tickets", ticketRoute);

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (isPasswordCorrect) {
      res.status(200).json({ success: true, message: "Login successful" });
    } else {
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Base route
app.get("/", (req, res) => {
  res.send("API Working");
});

// Start server
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
