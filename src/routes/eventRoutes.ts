import { Router, Request, Response } from "express";
import {
  getFreeSlots,
  createEvent,
  getEvents,
} from "../controllers/eventController";

const router = Router();

router.get("/free-slots", (req: Request, res: Response) => {
  getFreeSlots(req, res);
});
router.post("/events", (req: Request, res: Response) => {
  createEvent(req, res);
});
router.get("/events", (req: Request, res: Response) => {
  getEvents(req, res);
});

router;
export default router;
