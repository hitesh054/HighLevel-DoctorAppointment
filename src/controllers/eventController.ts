import { Request, Response } from "express";
import moment from "moment-timezone";
import { db } from "../config/firebase";
import admin from "firebase-admin"; // For Firebase Admin SDK
import { fetchExistingSlots, generateTimeSlots } from "../utils/timeSlotHelper";

interface Event {
  dateTime: string;
  duration: number;
}

export const getFreeSlots = async (req: Request, res: Response) => {
  const { date, timezone = "America/Los_Angeles" } = req.query;

  if (!date || !timezone) {
    return res.status(400).json({ error: "Date and timezone are required." });
  }

  try {
    // Generate initial time slots
    const generatedSlots = generateTimeSlots(
      date as string,
      timezone as string
    );

    // Fetch existing slots from Firestore
    const existingSlots = await fetchExistingSlots(date as string);

    // Filter out existing slots from generated slots
    const availableSlots = generatedSlots.filter(
      (slot) => !existingSlots.includes(slot)
    );

    return res.status(200).json(availableSlots);
  } catch (error) {
    console.error("Error generating slots:", error);
    return res.status(500).json({ error: "Failed to generate slots" });
  }
};

// Create a new event
export const createEvent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { dateTime, duration }: Event = req.body;

    const eventStart = moment(dateTime);
    const eventEnd = eventStart.clone().add(duration, "minutes");

    // Check if any event already exists at the same time
    const snapshot = await db
      .collection("DoctorAppointmentSlots")
      .where(
        "dateTime",
        ">=",
        admin.firestore.Timestamp.fromDate(eventStart.toDate())
      )
      .where(
        "dateTime",
        "<",
        admin.firestore.Timestamp.fromDate(eventEnd.toDate())
      )
      .get();

    // If there's already an event in the desired time range, return an error
    if (!snapshot.empty) {
      return res.status(422).json({ message: "Slot is already booked." });
    }

    // Create new event
    await db.collection("DoctorAppointmentSlots").add({
      dateTime: admin.firestore.Timestamp.fromDate(eventStart.toDate()), // Use Firestore Timestamp
      duration,
    });

    // Return success response after creating the event
    return res.status(200).json({ message: "Event created successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const startOfDay = (date: Date): Date => {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0
    )
  );
};
// Get events within a date range
export const getEvents = async (req: Request, res: Response) => {
  const { date } = req.query;

  try {
    let query: admin.firestore.Query<admin.firestore.DocumentData> =
      db.collection("DoctorAppointmentSlots");

    if (date) {
      const filteredDate = new Date(date as string);
      const startDate = startOfDay(filteredDate);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      // Use Firestore query to filter by date
      query = query
        .where("dateTime", ">=", startDate)
        .where("dateTime", "<", endDate);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No events found." });
    }

    const documents = snapshot.docs.map((doc) => ({
      dateTime: doc.data().dateTime.toDate(), // Convert Firestore timestamp to JavaScript Date
      duration: doc.data().duration,
    }));

    return res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
};
