import moment from "moment-timezone";
import { db } from "../config/firebase";

export const fetchExistingSlots = async (date: string, timezone: string) => {
  const startOfDay = moment.tz(date, timezone).startOf("day").toDate();
  const endOfDay = moment.tz(date, timezone).endOf("day").toDate();

  // Fetch existing slots from Firestore
  const snapshot = await db
    .collection("DoctorAppointmentSlots")
    .where("dateTime", ">=", startOfDay)
    .where("dateTime", "<=", endOfDay)
    .get();

  const existingSlots: { start: string; end: string }[] = [];
  snapshot.forEach((doc) => {
    const slotTime = doc.data().dateTime.toDate();
    const duration = doc.data().duration; // Assume you store slot duration in Firestore
    const endSlotTime = moment(slotTime).add(duration, 'minutes').toDate();

    existingSlots.push({
      start: moment(slotTime).tz(timezone).format("YYYY-MM-DDTHH:mm:ssZ"),
      end: moment(endSlotTime).tz(timezone).format("YYYY-MM-DDTHH:mm:ssZ")
    });
  });

  return existingSlots;
};

