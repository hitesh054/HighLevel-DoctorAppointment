import express from "express";
import bodyParser from "body-parser";
import eventRoutes from "./routes/eventRoutes";
import { healthCheck } from "./controllers/healthController";
const PORT = process.env.PORT || 3000;
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Mount the event routes
app.use("/api", eventRoutes);
app.use("/health", healthCheck);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
