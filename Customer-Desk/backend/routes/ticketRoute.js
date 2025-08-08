import express from "express";
import Ticket from "../model/ticketModel.js"; // Import the Ticket model

const router = express.Router();

// Create a new ticket
router.post("/create", async (req, res) => {
  try {
    const { mainCategory, issue, mobileNumber } = req.body;
    if (!mainCategory || !issue || !mobileNumber) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Generate a unique ticket ID
    const ticketId = "TICKET_" + Date.now();

    const newTicket = await Ticket.create({
      ticketId,
      mainCategory,
      issue,
      mobileNumber,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ success: false, message: "Server error. Could not create ticket." });
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
