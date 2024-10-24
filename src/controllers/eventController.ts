import { Request, Response } from "express";
import moment from "moment-timezone";
import { db } from "../config/firebase";
import admin from "firebase-admin";
import { fetchExistingSlots } from "../utils/timeSlotHelper";
import { startOfDay, endOfDay } from "date-fns";



export const getFreeSlots = async (req: Request, res: Response) => {
  const { date } = req.query;

  if (!date) {
    console.error("Date parameter is missing in getFreeSlots.");
    return res.status(400).json({ error: "Date is required." });
  }

  const clientTimezone = req.query.timezone?.toString() || process.env.TIMEZONE || "US/Eastern";
  if (!req.query.timezone) {
    console.warn("Timezone not provided, using default timezone (US/Eastern).");
  }

  try {
    const doctorsTimezone = process.env.TIMEZONE || "US/Eastern";
    const startHour = process.env.START_HOUR || '08:00';
    const endHour = process.env.END_HOUR || '17:00';
    const slotDuration = Number(process.env.SLOT_DURATION || 30);

    // Define the doctor's availability hours in env defined timezone
    const startEastern = moment.tz(`${date} ${startHour}`, doctorsTimezone);
    const endEastern = moment.tz(`${date} ${endHour}`, doctorsTimezone);

    console.info(`Generating time slots between ${startHour} and ${endHour} for ${date} in ${clientTimezone}.`);

    const generatedSlots: { start: string; end: string }[] = [];
    let currentSlot = startEastern.clone();

    while (currentSlot.isBefore(endEastern)) {
      const nextSlot = currentSlot.clone().add(slotDuration, 'minutes');
      generatedSlots.push({
        start: currentSlot.format(),
        end: nextSlot.format()
      });
      currentSlot = nextSlot;
    }

    const existingSlots = await fetchExistingSlots(date as string, clientTimezone as string);
    console.info(`Existing slots for ${date}: ${JSON.stringify(existingSlots)}`);

    // Convert existing slots to UTC for accurate comparison
    // const existingSlotsInUTC = existingSlots.map(slot => {
    //   const startUTC = moment.tz(slot.start, doctorsTimezone).utc(); 
    //   const endUTC = moment.tz(slot.end, doctorsTimezone).utc();   

    //   return {
    //     start: startUTC.format(), 
    //     end: endUTC.format(),
    //   };
    // });

    // Filter out any generated slot that overlaps with existing slots
    const availableSlots = generatedSlots.filter(generatedSlot => {
      const generatedStartUTC = moment.tz(generatedSlot.start, doctorsTimezone).utc();
      const generatedEndUTC = moment.tz(generatedSlot.end, doctorsTimezone).utc();
  
      return !existingSlots.some(existingSlot => {
        const existingStartUTC = moment(existingSlot.start);
        const existingEndUTC = moment(existingSlot.end);
    
        return (
          generatedStartUTC.isBefore(existingEndUTC) &&
          generatedEndUTC.isAfter(existingStartUTC)
        );
      });
    });
    

    // Format available slots in requested timezone
    const formattedSlots = availableSlots.map(slot => {
      return moment.tz(slot.start, doctorsTimezone).tz(clientTimezone).format();
    });

    console.info(`Available slots for ${date}: ${JSON.stringify(formattedSlots)}`);

    return res.status(200).json(formattedSlots);
  } catch (error) {
    console.error("Error generating slots:", error);
    return res.status(500).json({ error: "Failed to generate slots" });
  }
};

export const createEvent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { dateTime, duration, timezone } = req.body;

    if (!timezone || !dateTime || !duration) {
      console.error("Missing required fields in createEvent request.");
      return res.status(400).json({ error: "timezone, dateTime, and duration are required." });
    }

    const clientTimezone = timezone;
    const doctorTimezone = process.env.TIMEZONE || "US/Eastern";
    const START_HOUR = parseInt(process.env.START_HOUR || "8", 10);
    const END_HOUR = parseInt(process.env.END_HOUR || "17", 10);

    // Parse the dateTime in the client's timezone
    const eventStart = moment.tz(dateTime, clientTimezone);
    const eventEnd = eventStart.clone().add(duration, "minutes");

    console.info(`Attempting to create an event at ${eventStart} in ${clientTimezone}.`);

    // Convert event times to the doctor's timezone for validation
    const eventStartInDoctorTimezone = eventStart.clone().tz(doctorTimezone);
    const eventEndInDoctorTimezone = eventEnd.clone().tz(doctorTimezone);

    const startOfDayInDoctorTimezone = eventStartInDoctorTimezone.clone().startOf("day").add(START_HOUR, "hours");
    const endOfDayInDoctorTimezone = eventStartInDoctorTimezone.clone().startOf("day").add(END_HOUR, "hours");

    // Check if the event is within the doctor's working hours
    if (
      eventStartInDoctorTimezone.isBefore(startOfDayInDoctorTimezone) ||
      eventEndInDoctorTimezone.isAfter(endOfDayInDoctorTimezone)
    ) {
      console.warn(`Event time is outside of working hours in ${doctorTimezone}.`);
      return res.status(400).json({
        message: `Event must be between ${START_HOUR}:00 and ${END_HOUR}:00 in ${doctorTimezone}.`,
      });
    }

    // Check if any existing slots overlap with the new event
    const snapshot = await db
      .collection("DoctorAppointmentSlots")
      .where("dateTime", "<", admin.firestore.Timestamp.fromDate(eventEnd.toDate())) // End time check
      .where("dateTime", ">=", admin.firestore.Timestamp.fromDate(eventStart.clone().subtract(duration, 'minutes').toDate()))
      .get();

    if (!snapshot.empty) {
      console.warn(`Slot at ${eventStart} overlaps with an existing booking.`);
      return res.status(422).json({ message: "Slot is already booked or overlaps with another booking." });
    }

    await db.collection("DoctorAppointmentSlots").add({
      dateTime: admin.firestore.Timestamp.fromDate(eventStart.toDate()),
      duration,
    });

    console.info(`Event created successfully at ${eventStart} for ${duration} minutes.`);
    return res.status(200).json({ message: "Event created successfully." });
  } catch (error) {
    console.error("Error creating event:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    console.error("Missing required parameters in getEvents request.");
    return res.status(400).json({ message: "startDate and endDate are required" });
  }

  try {
    const startParsed = new Date(startDate as string);
    const endParsed = new Date(endDate as string);
    if (startParsed > endParsed) {
      console.warn("startDate must be before endDate.");
      return res.status(400).json({ message: "startDate must be before endDate." });
    }

    const timezone = typeof req.query.timezone === "string" ? req.query.timezone : process.env.TIMEZONE || "US/Eastern";
    if (!req.query.timezone) {
      console.warn("Timezone not provided, using default timezone (US/Eastern).");
    }

    console.info(`Fetching events between ${startParsed} and ${endParsed} in timezone ${timezone}.`);

    const startUTC = startOfDay(startParsed);
    const endUTC = endOfDay(endParsed);

    let query: admin.firestore.Query<admin.firestore.DocumentData> =
      db.collection("DoctorAppointmentSlots")
        .where("dateTime", ">=", admin.firestore.Timestamp.fromDate(startUTC))
        .where("dateTime", "<=", admin.firestore.Timestamp.fromDate(endUTC));

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.info("No events found for the given date range.");
      return res.status(404).json({ message: "No events found." });
    }

    const documents = snapshot.docs.map((doc) => {
      const eventDateTime = doc.data().dateTime.toDate();
      return {
        dateTime: moment.tz(eventDateTime, timezone).format(),
        duration: doc.data().duration,
      };
    });

    console.info(`Fetched ${documents.length} events.`);
    return res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
};
