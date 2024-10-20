# Appointment Booking System

This project is a backend API service for an appointment booking system built with Node.js, Express.js, and Firestore (Firebase). It allows users to view available time slots, create appointments, and fetch existing appointments in different time zones.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [API Endpoints](#api-endpoints)
  - [Get Free Slots](#get-free-slots)
  - [Create Event](#create-event)
  - [Get Events](#Get-events)
- [Technologies Used](#technologies-used)

## Features
- **Time Slot Management**: View available time slots for a specified date, and adjust time slots based on the client's and doctor's time zones.
- **Appointment Creation**: Book appointments for a specified duration and ensure they fall within the working hours (8 AM - 5 PM) in the doctor's time zone.
- **Appointment Retrieval**: Fetch existing appointments between specific dates, returned in the requested time zone.

## Prerequisites
Before running this project, ensure you have the following installed:
- **Node.js** (>=14.x)
- **npm**
- A **Firestore** database set up in your **Firebase** project

## Environment Variables
This project requires the following environment variables to be set:

```bash
# Firebase Admin SDK configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Time zone and slot settings
TIMEZONE=US/Eastern
START_HOUR=08:00
END_HOUR=17:00
SLOT_DURATION=30
```

## Installations
```bash
git clone https://github.com/hitesh054/HighLevel-DoctorAppointment.git

cd HighLevel-DoctorAppointment

npm install
```
## API Endpoints

### 1. Get Free Slots

**Endpoint**: `GET /api/free-slots`

This endpoint is used to fetch available time slots for booking appointments on a specific date.

#### Query Parameters:
- `date` (required): The date to retrieve available slots for, in the format `YYYY-MM-DD` (e.g., `2024-10-20`).
- `timezone` (optional): The time zone in which to return the available slots. Default is the server's time zone (e.g., `US/Eastern`).

#### Example Request:
```bash
GET /api/free-slots?date=2024-10-23&timezone=Asia/Kolkata
```
#### Example Response:
```bash
[
  "2024-10-20T08:00:00-04:00",
  "2024-10-20T08:30:00-04:00",
  "2024-10-20T09:00:00-04:00"
]
```
### 2. Create Event

**Endpoint**: `POST /api/events`

This endpoint is used to create a new appointment (event) at a specific time and duration.

#### Request Body:
- `dateTime` (required): The starting time of the appointment in ISO 8601 format (e.g., `2024-10-20T10:00:00`).
- `duration` (required): The duration of the appointment in minutes (e.g., `30` for a 30-minute appointment).
- `timezone` (required): The time zone in which the `dateTime` is specified (e.g., `America/New_York`).

#### Example Request:
```bash
POST /api/events
Content-Type: application/json

{
  "dateTime": "2024-10-20T10:00:00",
  "duration": 30,
  "timezone": "Asia/Kolkata"
} 
```
#### Example Response:
```bash
{
  "message": "Event created successfully."
}
```
### Get Events

**Endpoint**: `GET /api/events`

This endpoint retrieves all scheduled events (appointments) within a specified date range, formatted in the requested timezone.

#### Query Parameters:
- `startDate` (required): The starting date of the date range to fetch events in ISO 8601 format (e.g., `2024-10-20`).
- `endDate` (required): The ending date of the date range to fetch events in ISO 8601 format (e.g., `2024-10-25`).
- `timezone` (optional): The time zone in which the event times should be displayed. If not provided, the default time zone is used (default: `US/Eastern`).

#### Example Request:
```bash
GET /api/events?startDate=2024-10-20&endDate=2024-10-25&timezone=America/Los_Angeles
```
#### Example Response:
```bash
[
  {
    "dateTime": "2024-10-20T08:30:00-07:00",
    "duration": 30
  },
  {
    "dateTime": "2024-10-20T10:00:00-07:00",
    "duration": 45
  }
]
```
### Technologies Used

- **Node.js**: JavaScript runtime for building the backend.
- **Express.js**: Web framework for building APIs.
- **Firebase Admin SDK**: For interacting with Firestore.
- **moment-timezone**: For handling time zone conversions.
- **Firestore**: NoSQL database for storing appointments.
- **date-fns**: Utility for date manipulations.

