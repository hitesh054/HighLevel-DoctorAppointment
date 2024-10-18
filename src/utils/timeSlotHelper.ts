import moment from "moment-timezone";
import { db } from "../config/firebase";

const START_HOUR = parseInt(process.env.START_HOUR || "10", 10);
const END_HOUR = parseInt(process.env.END_HOUR || "17", 10);
const SLOT_DURATION = parseInt(process.env.SLOT_DURATION || "30", 10);


export const fetchExistingSlots = async (date: string, timezone: string) => {
  // Start and end of the day in the specified timezone
  const startOfDay = moment.tz(date, timezone).startOf("day").toDate();
  const endOfDay = moment.tz(date, timezone).endOf("day").toDate();

  // Fetch existing slots from Firestore
  const snapshot = await db
    .collection("DoctorAppointmentSlots")
    .where("dateTime", ">=", startOfDay)
    .where("dateTime", "<=", endOfDay)
    .get();

  const existingSlots: string[] = [];
  snapshot.forEach((doc) => {
    const slotTime = doc.data().dateTime.toDate();
    existingSlots.push(
      moment(slotTime).tz(timezone).format("YYYY-MM-DDTHH:mm:ssZ")
    );
  });

  return existingSlots;
};
