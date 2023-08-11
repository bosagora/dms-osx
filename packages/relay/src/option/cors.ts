import cors from "cors";

// CORS policy for Server
export const cors_options: cors.CorsOptions = {
    allowedHeaders: "*",
    credentials: true,
    methods: "GET, POST",
    origin: "*",
    preflightContinue: false,
};
