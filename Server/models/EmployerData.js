import mongoose from "mongoose";

const employerDataSchema = new mongoose.Schema(
  {
    employer: { type: String, required: true, trim: true, index: true },
    numberOfListings: { type: Number, min: 0 },
    medianSalary: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "employer_data",
  }
);

export const EmployerData = mongoose.model(
  "EmployerData",
  employerDataSchema
);
