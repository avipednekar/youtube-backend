import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended: true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//Routes import
import router from './routes/user.route.js'
import videoRouter from "./routes/video.route.js";

//Routes implementation
app.use("/api/v1/users",router)
app.use("/api/v1/video",videoRouter)

export default app;