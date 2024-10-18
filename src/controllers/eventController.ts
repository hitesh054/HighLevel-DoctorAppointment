import { Request, Response } from "express";
import moment from "moment-timezone";
import { db } from "../config/firebase";
import admin from "firebase-admin"; 
import { fetchExistingSlots } from "../utils/timeSlotHelper";
import { startOfDay, endOfDay } from "date-fns";


interface Event {
  dateTime: string;
  duration: number;
}

export const getFreeSlots = async (req: Request, res: Response) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date is required." });
  }

  try {
    const timezone =
      typeof req.query.timezone === "string"
        ? req.query.timezone
        : process.env.TIMEZONE || "US/Eastern";

        const startHour = process.env.START_HOUR || '08:00';
        const endHour = process.env.END_HOUR || '17:00';
    
        // Define the doctor's availability hours in US/Eastern timezone
        const startEastern = moment.tz(date + ' ' + startHour, "US/Eastern");
        const endEastern = moment.tz(date + ' ' + endHour, "US/Eastern");

    // Generate initial time slots in US/Eastern timezone
    const generatedSlots: string[] = [];
    let currentSlot = startEastern.clone();

    while (currentSlot.isBefore(endEastern)) {
      generatedSlots.push(currentSlot.format());
      currentSlot.add(30, 'minutes'); // Increment by 30 minutes
    }

    // Fetch existing slots from Firestore
    const existingSlots = await fetchExistingSlots(date as string, timezone as string);

    // Convert existing slots to UTC for accurate comparison
    const existingSlotsInUTC = existingSlots.map(slot => 
      moment.tz(slot, timezone).utc().format()
    );

    // Filter out existing slots from generated slots
    const availableSlots = generatedSlots.filter(
      (slot) => !existingSlotsInUTC.includes(moment.tz(slot, "US/Eastern").utc().format())
    );

    // Format available slots in requested timezone
    const formattedSlots = availableSlots.map(slot => {
      return moment.tz(slot, "US/Eastern").tz(timezone).format();
    });

    return res.status(200).json(formattedSlots);
  } catch (error) {
    console.error("Error generating slots:", error);
    return res.status(500).json({ error: "Failed to generate slots" });
  }
};




export const createEvent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { dateTime, duration }: Event = req.body;

    // Get the timezone from environment variables
    const timezone = process.env.TIMEZONE || "US/Eastern";

    // Parse the dateTime in the specified timezone
    const eventStart = moment.tz(dateTime, timezone);
    const eventEnd = eventStart.clone().add(duration, "minutes");

    if (eventStart.isBefore(moment.tz(timezone))) {
      return res
        .status(400)
        .json({ message: "Cannot create an event in the past." });
    }

    const START_HOUR = parseInt(process.env.START_HOUR || "10", 10);
    const END_HOUR = parseInt(process.env.END_HOUR || "17", 10);

    const startOfDayInTZ = eventStart.clone().startOf("day").add(START_HOUR, "hours");
    const endOfDayInTZ = eventStart.clone().startOf("day").add(END_HOUR, "hours");

    if (eventStart.isBefore(startOfDayInTZ) || eventEnd.isAfter(endOfDayInTZ)) {
      return res.status(400).json({
        message: `Event must be between ${START_HOUR}:00 and ${END_HOUR}:00.`,
      });
    }

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
      dateTime: admin.firestore.Timestamp.fromDate(eventStart.toDate()), // Should be in UTC
      duration,
    });

    // Return success response after creating the event
    return res.status(200).json({ message: "Event created successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "startDate and endDate are required" });
  }

  try {
    // Convert String to Date format
    const startParsed = new Date(startDate as string);
    const endParsed = new Date(endDate as string);

    // Set default timezone to UTC if not provided
    const timezone =
      typeof req.query.timezone === "string"
        ? req.query.timezone
        : process.env.TIMEZONE || "US/Eastern";

    // Calculate start and end of the day in UTC
    const startUTC = startOfDay(startParsed);
    const endUTC = endOfDay(endParsed);

    // Firestore query to filter events between startDate and endDate
    let query: admin.firestore.Query<admin.firestore.DocumentData> =
      db.collection("DoctorAppointmentSlots")
        .where("dateTime", ">=", admin.firestore.Timestamp.fromDate(startUTC))
        .where("dateTime", "<=", admin.firestore.Timestamp.fromDate(endUTC));

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "No events found." });
    }

    // Map Firestore documents to desired output format
    const documents = snapshot.docs.map((doc) => {
      const eventDateTime = doc.data().dateTime.toDate(); // Convert Firestore timestamp to JS Date
      return {
        dateTime: moment.tz(eventDateTime, timezone).format(), // Convert to specified timezone before returning
        duration: doc.data().duration,
      };
    });

    return res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
};
