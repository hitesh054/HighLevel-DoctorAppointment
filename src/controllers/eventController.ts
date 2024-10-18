import { Request, Response } from "express";
import moment from "moment-timezone";
import { db } from "../config/firebase";
import admin from "firebase-admin"; 
import { fetchExistingSlots } from "../utils/timeSlotHelper";
import { startOfDay, endOfDay } from "date-fns";

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

export const createEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { dateTime, duration, timezone } = req.body;

    // Client's timezone
    if (!timezone|| !dateTime || !duration) {
      return res.status(400).json({ error: "timezone,dateTime,duration are required." });
    }

    const clientTimezone = timezone;

    // Doctor's timezone from environment variables
    const doctorTimezone = process.env.TIMEZONE || "US/Eastern";

    // Parse the dateTime in the client's timezone
    const eventStart = moment.tz(dateTime, clientTimezone);
    const eventEnd = eventStart.clone().add(duration, "minutes");

    // Convert event times to the doctor's timezone for validation
    const eventStartInDoctorTimezone = eventStart.clone().tz(doctorTimezone);
    const eventEndInDoctorTimezone = eventEnd.clone().tz(doctorTimezone);

    // Doctor's availability in the doctor's timezone
    const START_HOUR = parseInt(process.env.START_HOUR || "8", 10); // Doctor's start time (e.g., 8:00 AM)
    const END_HOUR = parseInt(process.env.END_HOUR || "17", 10); // Doctor's end time (e.g., 5:00 PM)

    // Define the start and end of the doctor's day
    const startOfDayInDoctorTimezone = eventStartInDoctorTimezone.clone().startOf("day").add(START_HOUR, "hours");
    const endOfDayInDoctorTimezone = eventStartInDoctorTimezone.clone().startOf("day").add(END_HOUR, "hours");

    // Check if the event falls within the doctor's working hours in their timezone
    if (
      eventStartInDoctorTimezone.isBefore(startOfDayInDoctorTimezone) ||
      eventEndInDoctorTimezone.isAfter(endOfDayInDoctorTimezone)
    ) {
      return res.status(400).json({
        message: `Event must be between ${START_HOUR}:00 and ${END_HOUR}:00 in ${doctorTimezone}.`,
      });
    }

    // Check if any event already exists at the same time
    const snapshot = await db
      .collection("DoctorAppointmentSlots")
      .where("dateTime", ">=", admin.firestore.Timestamp.fromDate(eventStart.toDate())) // Store in UTC
      .where("dateTime", "<", admin.firestore.Timestamp.fromDate(eventEnd.toDate()))
      .get();

    if (!snapshot.empty) {
      return res.status(422).json({ message: "Slot is already booked." });
    }

    // Create the event in Firestore
    await db.collection("DoctorAppointmentSlots").add({
      dateTime: admin.firestore.Timestamp.fromDate(eventStart.toDate()), // Store in UTC
      duration,
    });

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
