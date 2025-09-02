//require('dotenv').config({path:'./env'})
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({
    path:'./env'
})

const port = process.env.PORT || 8000;

connectDB()
.then(()=>{
    app.listen(port,()=>{
        console.log(`Server running on http://localhost:${port}`);
    })
})
.catch((err)=>{
    console.log("MongoDB connection failed !!", err);
})














// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";

// ;(async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
//     } catch (error) {
//         console.log("ERROR: ",error);
//         throw error;
//     }
// })();