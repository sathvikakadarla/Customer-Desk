import express from "express";
import Ticket from "../models/ticketModel.js"; // Import the Ticket model

const router = express.Router();

// Create a new ticket
import { protect } from "../middleware/auth.js";

router.post("/create", protect, async (req, res) => {
  try {
    const { issue, subissue, mobileNumber } = req.body;

    // Validate required fields (excluding userName, since we take it from req.user)
    if (!issue || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: issue and mobileNumber are mandatory."
      });
    }

    // Generate unique ticket ID
    const ticketId = "TICKET_" + Date.now();

    const newTicket = await Ticket.create({
      ticketId,
      issue,
      subissue: subissue || "",
      userName: req.user.userName, // <-- automatically from logged-in user
      mobileNumber,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not create ticket."
    });
  }
});



// Fetch all tickets
router.get("/", async (req, res) => {
  try {
    const tickets = await Ticket.find(); // Retrieve all tickets from the database
    res.status(200).json({ success: true, tickets }); // Respond with the tickets
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ success: false, message: "Server error. Unable to fetch tickets." });
  }
});

// Update ticket status
router.put("/:ticketId", async (req, res) => {
  const { ticketId } = req.params;
  const { status } = req.body;
  try {
    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticketId },
      { status, updatedAt: Date.now() },
      { new: true }
    );
    if (!updatedTicket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete all tickets
router.delete("/", async (req, res) => {
  try {
    await Ticket.deleteMany(); // Delete all tickets from the collection
    res.status(200).json({ success: true, message: "All tickets deleted successfully." });
  } catch (error) {
    console.error("Error deleting tickets:", error);
    res.status(500).json({ success: false, message: "Server error. Unable to delete tickets." });
  }
});


export default router;
