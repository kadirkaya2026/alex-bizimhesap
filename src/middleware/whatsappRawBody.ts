import express from "express";

export const whatsappRawBody = express.raw({
  type: "application/json",
  limit: "2mb",
});
