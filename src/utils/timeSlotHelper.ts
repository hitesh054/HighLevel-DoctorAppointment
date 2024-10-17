import moment from "moment-timezone";
import { db } from "../config/firebase";

const START_HOUR = parseInt(process.env.START_HOUR || "10", 10);
const END_HOUR = parseInt(process.env.END_HOUR || "17", 10);
const SLOT_DURATION = parseInt(process.env.SLOT_DURATION || "30", 10);

// Helper function to generate time slots
export const generateTimeSlots = (date: string, timezone: string) => {
  const slots: string[] = [];
  const start = moment
    .tz(date, timezone)
    .set({ hour: START_HOUR, minute: 0, second: 0, millisecond: 0 });
  const end = moment
    .tz(date, timezone)
    .set({ hour: END_HOUR, minute: 0, second: 0, millisecond: 0 });

  for (
    let current = start.clone();
    current.isBefore(end);
    current.add(SLOT_DURATION, "minutes")
  ) {
    slots.push(current.format("YYYY-MM-DDTHH:mm:ssZ"));
  }

  return slots;
};

export const fetchExistingSlots = async (date: string) => {
  const startOfDay = moment(date).startOf("day").toDate();
  const endOfDay = moment(date).endOf("day").toDate();

  const snapshot = await db
    .collection("DoctorAppointmentSlots")
    .where("dateTime", ">=", startOfDay)
    .where("dateTime", "<=", endOfDay)
    .get();

  const existingSlots: string[] = [];
  snapshot.forEach((doc) => {
    const slotTime = doc.data().dateTime.toDate(); // Assuming dateTime is a Firestore timestamp
    existingSlots.push(
      moment(slotTime).tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm:ssZ")
    ); // Format to match the API output
  });

  return existingSlots;
};
