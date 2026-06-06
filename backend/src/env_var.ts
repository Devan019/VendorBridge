import { configDotenv } from "dotenv";
configDotenv();
const ACCESS_KEY = process.env.ACCESS_KEY;

export { ACCESS_KEY };