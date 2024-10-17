import express, { Request, Response } from "express";

export const healthCheck = (req: Request, res: Response) => {
  try {
    res.status(200).json({
      status: true,
      message: `Server is healthy`,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: `Server is unhealthy`,
    });
  }
};
